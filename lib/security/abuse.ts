import crypto from "node:crypto";
import { NextRequest } from "next/server";

export const WRITE_ACTIONS = [
  "station_report",
  "station_claim",
  "station_registration",
  "marketplace_listing",
  "marketplace_enquiry",
  "provider_onboarding",
  "service_offering",
  "service_enquiry",
  "business_enquiry",
] as const;

export type WriteAction = (typeof WRITE_ACTIONS)[number];

export function isWriteAction(value: string): value is WriteAction {
  return (WRITE_ACTIONS as readonly string[]).includes(value);
}

function networkSource(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");

  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const userAgent = request.headers.get("user-agent") || "unknown";

  return `${ip}|${userAgent}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }

  return value;
}

export function networkFingerprint(request: NextRequest) {
  const secret = process.env.ABUSE_FINGERPRINT_SECRET;

  if (!secret) {
    throw new Error("ABUSE_FINGERPRINT_SECRET is not configured");
  }

  return crypto
    .createHmac("sha256", secret)
    .update(networkSource(request))
    .digest("hex");
}

export function duplicateFingerprint(
  action: WriteAction,
  userId: string,
  payload: unknown,
) {
  const normalized = JSON.stringify(canonicalize(payload));

  return crypto
    .createHash("sha256")
    .update(`${action}|${userId}|${normalized}`)
    .digest("hex");
}
