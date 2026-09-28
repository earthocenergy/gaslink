import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  "lib/security/admin-access.ts",
  "utf8",
);

const js = source
  .replace(/export type AdminAccessInput = \{[\s\S]*?\};\n\n/, "")
  .replace(/export type AdminAccessDecision =[\s\S]*?;\n\n/, "")
  .replace(
    /export function decideAdminAccess\(\s*input: AdminAccessInput,\s*\): AdminAccessDecision/,
    "function decideAdminAccess(input)"
  );

const module = new Function(
  `${js}\nreturn { decideAdminAccess };`,
)();

const { decideAdminAccess } = module;

function decision(overrides = {}) {
  return decideAdminAccess({
    hasUser: true,
    userError: false,
    profileRole: "admin",
    profileError: false,
    mfaMode: "enrolment",
    aalLevel: null,
    aalError: false,
    pathname: "/admin",
    ...overrides,
  });
}

assert.deepEqual(
  decision({ hasUser: false }),
  { kind: "auth" },
  "anonymous users must be sent to auth"
);

assert.deepEqual(
  decision({ profileRole: "driver" }),
  { kind: "dashboard" },
  "authenticated non-admin users must leave admin routes"
);

assert.deepEqual(
  decision({
    mfaMode: "enrolment",
    aalLevel: "aal1",
  }),
  { kind: "allow" },
  "AAL1 admin must remain allowed during enrolment mode"
);

assert.deepEqual(
  decision({
    mfaMode: "required",
    aalLevel: "aal1",
  }),
  { kind: "security" },
  "required-mode AAL1 admin must be sent to MFA security"
);

assert.deepEqual(
  decision({
    mfaMode: "required",
    aalLevel: "aal1",
    pathname: "/admin/security",
  }),
  { kind: "allow" },
  "required-mode AAL1 admin must be allowed onto MFA security page"
);

assert.deepEqual(
  decision({
    mfaMode: "required",
    aalLevel: "aal2",
  }),
  { kind: "allow" },
  "required-mode AAL2 admin must be allowed"
);

assert.deepEqual(
  decision({ profileError: true }),
  {
    kind: "unavailable",
    message: "Admin access is temporarily unavailable.",
  },
  "profile backend failure must fail closed"
);

assert.deepEqual(
  decision({
    mfaMode: "required",
    aalError: true,
  }),
  {
    kind: "unavailable",
    message: "Admin MFA verification is temporarily unavailable.",
  },
  "MFA backend failure must fail closed"
);

console.log("Admin access policy checks OK");
