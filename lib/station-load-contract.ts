export type StationReadTarget =
  | "directory"
  | "detail"
  | "reports";

export type StationReadIssueKind =
  | "not_found"
  | "authentication"
  | "authorization"
  | "network"
  | "upstream"
  | "request";

export type StationReadIssue = {
  kind: StationReadIssueKind;
  title: string;
  message: string;
  retryable: boolean;
};

type StationReadFailureInput = {
  target: StationReadTarget;
  status: number | null | undefined;
  error: unknown;
};

function errorRecord(error: unknown): Record<string, unknown> | null {
  return error && typeof error === "object"
    ? error as Record<string, unknown>
    : null;
}

function errorCode(error: unknown) {
  const record = errorRecord(error);
  return typeof record?.code === "string" ? record.code : "";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  const record = errorRecord(error);
  if (typeof record?.message === "string") return record.message;

  return typeof error === "string" ? error : "";
}

function normalizedStatus(
  status: number | null | undefined,
  error: unknown,
) {
  if (typeof status === "number" && Number.isFinite(status)) {
    return status;
  }

  const record = errorRecord(error);
  const errorStatus = record?.status;

  return typeof errorStatus === "number" && Number.isFinite(errorStatus)
    ? errorStatus
    : null;
}

function subject(target: StationReadTarget) {
  if (target === "directory") return "station directory";
  if (target === "reports") return "recent station reports";
  return "station details";
}

export function stationReadSucceeded(
  status: number | null | undefined,
  error: unknown,
) {
  return !error
    && typeof status === "number"
    && status >= 200
    && status < 300;
}

export function stationReadIssue({
  target,
  status,
  error,
}: StationReadFailureInput): StationReadIssue | null {
  if (stationReadSucceeded(status, error)) return null;

  const resolvedStatus = normalizedStatus(status, error);
  const code = errorCode(error);
  const message = errorMessage(error).toLowerCase();
  const targetSubject = subject(target);

  if (
    target === "detail"
    && (resolvedStatus === 404 || code === "22P02")
  ) {
    return {
      kind: "not_found",
      title: "Station not found",
      message:
        "This station is not currently available through public CNGx discovery.",
      retryable: false,
    };
  }

  if (
    resolvedStatus === 401
    || code === "PGRST301"
    || code === "PGRST302"
  ) {
    return {
      kind: "authentication",
      title: "Station service authentication failed",
      message:
        `CNGx could not authenticate the ${targetSubject} request. ` +
        "Public station discovery should not be interpreted as empty when this happens. Try again.",
      retryable: true,
    };
  }

  if (resolvedStatus === 403 || code === "42501") {
    return {
      kind: "authorization",
      title: "Station service access denied",
      message:
        `CNGx could not access the ${targetSubject}. ` +
        "The request was denied by the data service, so no empty or not-found result has been assumed. Try again.",
      retryable: true,
    };
  }

  if (
    resolvedStatus === 0
    || resolvedStatus == null
      && /failed to fetch|fetch failed|network|econn|timeout|timed out|abort/.test(
        message,
      )
  ) {
    return {
      kind: "network",
      title: "Cannot reach the station service",
      message:
        `CNGx could not reach the ${targetSubject}. ` +
        "Check your connection and try again.",
      retryable: true,
    };
  }

  if (
    resolvedStatus != null
    && (
      resolvedStatus >= 500
      || resolvedStatus === 408
      || resolvedStatus === 429
    )
  ) {
    return {
      kind: "upstream",
      title: "Station service temporarily unavailable",
      message:
        `The ${targetSubject} service is temporarily unavailable. ` +
        "CNGx has not treated this failure as an empty or not-found result. Try again.",
      retryable: true,
    };
  }

  return {
    kind: "request",
    title: "Could not load station information",
    message:
      `CNGx could not load the ${targetSubject}. ` +
      "No empty or not-found result has been assumed. Try again.",
    retryable: true,
  };
}
