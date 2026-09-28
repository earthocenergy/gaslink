import fs from "node:fs";
import path from "node:path";

const migrationPath =
  "supabase/migrations/20260928193000_trust_contract_hardening.sql";

const migration = fs.readFileSync(migrationPath, "utf8");
const operatorPage = fs.readFileSync("app/operator/page.tsx", "utf8");

function fail(message) {
  throw new Error(message);
}

function functionBody(name) {
  const marker = `create or replace function public.${name}(`;
  const start = migration.toLowerCase().indexOf(marker);

  if (start < 0) fail(`Function missing from trust migration: ${name}`);

  const end = migration.indexOf("\nrevoke all on function", start);

  if (end < 0)
    fail(`Could not isolate function body for ${name}`);

  return migration.slice(start, end).toLowerCase();
}

const registration = functionBody("admin_review_station_registration");
const legacyRegistration = functionBody("approve_station_registration");
const claim = functionBody("approve_station_claim");
const moderation = functionBody("admin_moderate_station_report");
const operator = functionBody("operator_update_station_operational");
const verification = functionBody("admin_set_station_verification");

for (const [label, body] of [
  ["registration approval", registration],
  ["legacy registration approval", legacyRegistration],
  ["claim approval", claim],
]) {
  if (body.includes("is_verified"))
    fail(`${label} must not mutate is_verified`);

  if (body.includes("last_verified_at"))
    fail(`${label} must not mutate last_verified_at`);
}

if (!registration.includes("registration_status"))
  fail("Registration approval must still govern registration_status");

if (!claim.includes("claimed_by"))
  fail("Claim approval must still assign ownership authority");

if (!moderation.includes("moderated_at"))
  fail("Community moderation must stamp moderated_at");

if (moderation.includes("last_verified_at"))
  fail("Community moderation must not refresh CNGx verification time");

if (moderation.includes("is_verified"))
  fail("Community moderation must not confer CNGx verification");

for (const token of [
  "status = p_status",
  "price_per_scm = p_price_per_scm",
  "queue_minutes = p_queue_minutes",
  "opening_hours = p_opening_hours",
  "open_now = p_open_now",
]) {
  if (!operator.includes(token))
    fail(`Operator operational field missing: ${token}`);
}

for (const forbidden of [
  "publication_status",
  "publication_reviewed_at",
  "is_verified",
  "last_verified_at",
  "record_source",
  "location_precision",
  "location_source",
  "latitude =",
  "longitude =",
  "registration_status",
  "submitted_by",
  "claimed_by =",
]) {
  if (operator.includes(forbidden))
    fail(`Trust-sensitive operator mutation present: ${forbidden}`);
}

if (!operator.includes("v_station.claimed_by is distinct from v_user"))
  fail("Operator RPC must enforce station ownership server-side");

if (!migration.includes(
  "drop policy if exists stations_operator_update on public.stations"
))
  fail("Unsafe generic operator UPDATE policy must be removed");

if (!migration.includes(
  "revoke update on table public.stations"
))
  fail("Authenticated raw stations UPDATE privilege must be revoked");

if (!migration.includes("station_operator_update_audit"))
  fail("Immutable operator audit primitive is missing");

if (!migration.includes("station_verification_audit"))
  fail("Verification audit primitive is missing");

if (!verification.includes("role = 'admin'"))
  fail("Verification RPC must contain an admin authorization check");

if (!verification.includes("is_verified = p_verified"))
  fail("Verification RPC must explicitly own is_verified");

if (!verification.includes("last_verified_at = v_new_verified_at"))
  fail("Verification RPC must explicitly own verification timestamp");

if (
  !migration.includes(
    "grant execute on function\n  public.admin_set_station_verification(uuid, boolean)\nto authenticated"
  )
)
  fail("Verification RPC authenticated-call surface missing");

if (
  !migration.includes(
    "grant execute on function\n  public.operator_update_station_operational"
  )
)
  fail("Operator RPC authenticated-call surface missing");

if (
  !operatorPage.includes(
    'rpc("operator_update_station_operational"'
  )
)
  fail("Web operator flow must use the field-restricted RPC");

if (operatorPage.includes('.from("stations").update('))
  fail("Raw browser stations.update remains in operator flow");

if (operatorPage.includes("verification time"))
  fail("Operator UI still conflates operations with verification");

const candidateDoctrine = [
  "picng-7acdd2023622ddc15506e499",
  "picng-8156d44c6cd771ead33e9f0d",
];

for (const candidate of candidateDoctrine) {
  if (migration.includes(candidate))
    fail(`Candidate doctrine ID must not appear in migration: ${candidate}`);
}

if (migration.includes("station_publication_reviews"))
  fail("Trust/operator audit must not overload publication review audit");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) return walk(full);

    return [full];
  });
}

for (const file of walk("app").filter((x) => x.endsWith(".tsx") || x.endsWith(".ts"))) {
  const source = fs.readFileSync(file, "utf8");

  if (source.includes('.from("stations").update('))
    fail(`Direct browser stations.update remains: ${file}`);
}

console.log("Trust contract regression checks OK");
