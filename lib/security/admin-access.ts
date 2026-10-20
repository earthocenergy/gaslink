export type AdminAccessInput = {
  hasUser: boolean;
  userError: boolean;
  profileRole: string | null;
  profileError: boolean;
  mfaMode: string;
  aalLevel?: string | null;
  aalError?: boolean;
  pathname: string;
};

export type AdminAccessDecision =
  | { kind: "allow" }
  | { kind: "auth" }
  | { kind: "dashboard" }
  | { kind: "security" }
  | { kind: "unavailable"; message: string };

export function decideAdminAccess(
  input: AdminAccessInput,
): AdminAccessDecision {
  if (input.userError || !input.hasUser) {
    return { kind: "auth" };
  }

  if (input.profileError) {
    return {
      kind: "unavailable",
      message: "Admin access is temporarily unavailable.",
    };
  }

  if (input.profileRole !== "admin") {
    return { kind: "dashboard" };
  }

  if (input.mfaMode === "required") {
    if (input.aalError) {
      return {
        kind: "unavailable",
        message: "Admin MFA verification is temporarily unavailable.",
      };
    }

    if (
      input.aalLevel !== "aal2" &&
      input.pathname !== "/admin/security"
    ) {
      return { kind: "security" };
    }
  }

  return { kind: "allow" };
}
