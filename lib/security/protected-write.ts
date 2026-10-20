import type { WriteAction } from "./abuse";

export type ProtectedWriteResult = {
  ok: boolean;
  reason?: string;
  message: string;
  retryAfter?: number;
};

export async function protectedWrite(
  action: WriteAction,
  payload: Record<string, unknown>,
): Promise<ProtectedWriteResult> {
  try {
    const response = await fetch(`/api/write/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!data || typeof data !== "object") {
      return {
        ok: false,
        reason: "service_unavailable",
        message: "Submission service is temporarily unavailable.",
      };
    }

    return {
      ok: response.ok && data.ok === true,
      reason: data.reason,
      message:
        typeof data.message === "string"
          ? data.message
          : response.ok
            ? "Submission received."
            : "Submission could not be completed.",
      retryAfter:
        typeof data.retryAfter === "number"
          ? data.retryAfter
          : undefined,
    };
  } catch {
    return {
      ok: false,
      reason: "service_unavailable",
      message: "Submission service is temporarily unavailable.",
    };
  }
}
