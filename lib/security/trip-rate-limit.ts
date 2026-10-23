import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export type TripRateAction = "trip_plan" | "place_resolution";

export type TripRateResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number }
  | { allowed: false; unavailable: true };

type Counter = {
  start: number;
  count: number;
};

const WINDOW_MS = 60_000;
const MAX_KEYS = 4_096;
const counters = new Map<string, Counter>();

function configuredSecret(): string | null {
  const secret = process.env.ABUSE_FINGERPRINT_SECRET;

  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32 || secret === "development-only") {
      return null;
    }
  }

  return secret || "development-only";
}

function prune(now: number): void {
  for (const [key, value] of counters) {
    if (now - value.start >= WINDOW_MS) {
      counters.delete(key);
    }
  }
}

function fingerprint(
  action: TripRateAction,
  secret: string,
): string {
  // No caller-supplied IP, forwarded header or User-Agent is
  // accepted as an independently verified client identity.
  return crypto
    .createHmac("sha256", secret)
    .update(`trip:v1:${action}:anonymous`)
    .digest("hex");
}

export function checkTripRateLimit(
  _request: NextRequest,
  action: TripRateAction,
): TripRateResult {
  const secret = configuredSecret();

  if (!secret) {
    return { allowed: false, unavailable: true };
  }

  // Process-local enforcement is not globally reliable across
  // distributed instances. Production requires a shared backend
  // and an approved trusted-identity configuration.
  if (process.env.NODE_ENV === "production") {
    return { allowed: false, unavailable: true };
  }

  const now = Date.now();
  const limit = action === "trip_plan" ? 12 : 60;
  const key = fingerprint(action, secret);

  prune(now);

  const existing = counters.get(key);

  if (!existing || now - existing.start >= WINDOW_MS) {
    if (counters.size >= MAX_KEYS) {
      return { allowed: false, unavailable: true };
    }

    counters.set(key, { start: now, count: 1 });
    return { allowed: true };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(
        1,
        Math.ceil((WINDOW_MS - (now - existing.start)) / 1000),
      ),
    };
  }

  existing.count += 1;
  return { allowed: true };
}
