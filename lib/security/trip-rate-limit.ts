import crypto from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export type TripRateAction =
  | "trip_plan"
  | "place_resolution";

export type TripRateResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }
  | { allowed: false; unavailable: true };

type SharedDecision = {
  allowed?: boolean;
  retry_after_seconds?: number | null;
};

type RpcResult = {
  data: unknown;
  error: unknown;
};

export type TripRateRpc = (
  args: {
    p_action: TripRateAction;
    p_subject_key: string;
    p_network_key: string;
  },
) => Promise<RpcResult>;

export type TripRateDependencies = {
  userId?: string | null;
  rpc?: TripRateRpc;
};

function configuredSecret(): string | null {
  const secret = process.env.ABUSE_FINGERPRINT_SECRET;

  if (!secret || secret.length < 32) {
    return null;
  }

  if (
    process.env.NODE_ENV === "production"
    && secret === "development-only"
  ) {
    return null;
  }

  return secret;
}

function trustedNetworkAddress(
  request: NextRequest,
): string | null {
  const trusted =
    request.headers.get("x-vercel-forwarded-for");

  if (!trusted) {
    return process.env.NODE_ENV === "production"
      ? null
      : "127.0.0.1";
  }

  const first = trusted.split(",")[0]?.trim() || "";

  return isIP(first) ? first : null;
}

function fingerprint(
  scope: string,
  value: string,
  secret: string,
) {
  return crypto
    .createHmac("sha256", secret)
    .update(`cngx:trip:v2:${scope}:${value}`)
    .digest("hex");
}

async function authenticatedUserId(
  request: NextRequest,
): Promise<string | null> {
  try {
    const { createRouteSupabase } =
      await import("@/lib/supabase/server-route");

    const { supabase } = createRouteSupabase(request);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return user?.id || null;
  } catch {
    return null;
  }
}

async function sharedRateRpc(
  args: {
    p_action: TripRateAction;
    p_subject_key: string;
    p_network_key: string;
  },
): Promise<RpcResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return {
      data: null,
      error: new Error(
        "Shared rate-limit backend unavailable",
      ),
    };
  }

  const client = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client.rpc(
    "check_trip_rate_limit_shared",
    args,
  );
}

function normalizeDecision(
  data: unknown,
): SharedDecision | null {
  const value = Array.isArray(data)
    ? data[0]
    : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as SharedDecision;
}

export async function checkTripRateLimit(
  request: NextRequest,
  action: TripRateAction,
  dependencies: TripRateDependencies = {},
): Promise<TripRateResult> {
  const secret = configuredSecret();

  if (!secret) {
    return {
      allowed: false,
      unavailable: true,
    };
  }

  const networkAddress =
    trustedNetworkAddress(request);

  if (!networkAddress) {
    return {
      allowed: false,
      unavailable: true,
    };
  }

  const userId =
    dependencies.userId !== undefined
      ? dependencies.userId
      : await authenticatedUserId(request);

  const networkKey = fingerprint(
    "network",
    networkAddress,
    secret,
  );

  const subjectKey = userId
    ? fingerprint("user", userId, secret)
    : fingerprint(
        "anonymous-network",
        networkAddress,
        secret,
      );

  const rpc = dependencies.rpc || sharedRateRpc;

  let result: RpcResult;

  try {
    result = await rpc({
      p_action: action,
      p_subject_key: subjectKey,
      p_network_key: networkKey,
    });
  } catch {
    return {
      allowed: false,
      unavailable: true,
    };
  }

  if (result.error) {
    return {
      allowed: false,
      unavailable: true,
    };
  }

  const decision = normalizeDecision(result.data);

  if (!decision || typeof decision.allowed !== "boolean") {
    return {
      allowed: false,
      unavailable: true,
    };
  }

  if (decision.allowed) {
    return { allowed: true };
  }

  if (
    typeof decision.retry_after_seconds !== "number"
    || !Number.isFinite(decision.retry_after_seconds)
  ) {
    return {
      allowed: false,
      unavailable: true,
    };
  }

  return {
    allowed: false,
    retryAfter: Math.max(
      1,
      Math.ceil(decision.retry_after_seconds),
    ),
  };
}
