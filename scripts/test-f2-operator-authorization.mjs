import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migrations = fs.readdirSync("supabase/migrations");
const file = migrations.find(
  x => x.endsWith("_f2_operator_authorization_hardening.sql"),
);

assert.ok(file, "F2 operator hardening migration must exist");

const sql = fs.readFileSync(
  path.join("supabase/migrations", file),
  "utf8",
);

const operatorPage = fs.readFileSync(
  "app/operator/page.tsx",
  "utf8",
);

const trust = fs.readFileSync(
  "supabase/migrations/20260928193000_trust_contract_hardening.sql",
  "utf8",
);

let passed = 0;

function check(label, fn) {
  fn();
  passed++;
  console.log(`PASS ${passed}: ${label}`);
}

check("trust migration remains present as prerequisite", () => {
  assert.match(
    trust,
    /operator_update_station_operational/,
  );
});

check("authenticated caller identity remains mandatory", () => {
  assert.match(sql, /v_user uuid := auth\.uid\(\)/);
  assert.match(sql, /Authentication required/);
});

check("admin entitlement is profile-role based", () => {
  assert.match(
    sql,
    /p\.role = 'admin'::public\.app_role/,
  );
});

check("operator entitlement accepts canonical profile operator", () => {
  assert.match(
    sql,
    /p\.role = 'operator'::public\.app_role/,
  );
});

check("operator entitlement accepts approved multi-role assignment", () => {
  assert.match(sql, /from public\.user_roles ur/);
  assert.match(sql, /ur\.role = 'operator'/);
});

check("ownership alone is insufficient", () => {
  assert.match(sql, /Active operator role required/);
  assert.match(
    sql,
    /v_station\.claimed_by is distinct from v_user/,
  );
});

check("non-admin mutation requires approved station", () => {
  assert.match(
    sql,
    /v_station\.registration_status <> 'approved'/,
  );
  assert.match(sql, /Approved station ownership required/);
});

check("operator cannot update verification fields", () => {
  const update = sql.match(
    /update public\.stations[\s\S]*?where id = p_station_id;/,
  )?.[0] || "";

  assert.ok(update);
  assert.doesNotMatch(update, /\bis_verified\b/);
  assert.doesNotMatch(update, /\blast_verified_at\b/);
  assert.doesNotMatch(update, /\bclaimed_by\b/);
  assert.doesNotMatch(update, /\bregistration_status\b/);
  assert.doesNotMatch(update, /\bpublication_status\b/);
});

check("operator update remains attributable", () => {
  assert.match(sql, /station_operator_update_audit/);
  assert.match(sql, /actor_user_id/);
});

check("PUBLIC and anon execution are revoked", () => {
  assert.match(
    sql,
    /from public, anon;/,
  );
});

check("only authenticated API role receives operator RPC execute", () => {
  assert.match(
    sql,
    /to authenticated;/,
  );
});

check("operator UI entitlement model matches database contract", () => {
  assert.match(
    operatorPage,
    /\["operator","admin"\]\.includes\(p\?\.role/,
  );
  assert.match(
    operatorPage,
    /roles\.includes\("operator"\)/,
  );
});

check("operator UI only loads approved stations", () => {
  assert.match(
    operatorPage,
    /\.eq\("registration_status","approved"\)/,
  );
});

console.log(
  `F2 operator authorization static contract passed: ${passed} checks.`,
);
