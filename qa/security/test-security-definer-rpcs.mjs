const url = process.env.QA_SUPABASE_URL;
const key = process.env.QA_SUPABASE_PUBLISHABLE_KEY;
const token = process.env.QA_ORDINARY_USER_TOKEN;

if (process.env.QA_ALLOW_RPC_MUTATION !== "STAGING_ONLY") {
  throw new Error(
    "RPC adversarial execution requires QA_ALLOW_RPC_MUTATION=STAGING_ONLY",
  );
}

if (!url || !key || !token) {
  throw new Error("Staging Supabase URL/key/ordinary-user token required");
}

if (/knhrgugextsmisyxzdgc/.test(url)) {
  throw new Error("Production GasLink Supabase target is prohibited");
}

const uuid = "00000000-0000-4000-8000-000000000001";

const rejectionCases = [
  ["activate_user_role", { p_role: "operator" }],
  ["admin_equipment_verification", { p_id: uuid, p_status: "verified" }],
  ["admin_marketplace_listing", { p_id: uuid, p_status: "approved" }],
  ["admin_marketplace_seller", { p_id: uuid, p_status: "verified" }],
  ["admin_moderate_station_report", { p_report_id: uuid, p_apply: true }],
  ["admin_publish_station", { p_station_id: uuid, p_notes: "qa adversarial" }],
  [
    "admin_review_station_publication",
    {
      p_station_id: uuid,
      p_decision: "eligible",
      p_notes: "qa adversarial",
    },
  ],
  [
    "admin_review_station_registration",
    { p_station_id: uuid, p_approve: true },
  ],
  ["admin_service_offering", { p_id: uuid, p_status: "approved" }],
  ["admin_service_provider", { p_id: uuid, p_status: "verified" }],
  [
    "admin_unpublish_station",
    { p_station_id: uuid, p_notes: "qa adversarial" },
  ],
  ["admin_update_business_enquiry", { p_id: uuid, p_status: "closed" }],
  ["approve_station_claim", { p_claim_id: uuid, p_approve: true }],
  [
    "admin_set_station_verification",
    { p_station_id: uuid, p_verified: true },
  ],
  [
    "operator_update_station_operational",
    {
      p_station_id: uuid,
      p_status: "operational",
      p_price_per_scm: 1,
      p_queue_minutes: 0,
      p_opening_hours: "QA synthetic fixture",
      p_open_now: true,
    },
  ],
];

let failed = 0;

for (const [name, args] of rejectionCases) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  if (response.ok) {
    console.error("FAIL", name, "ordinary unauthorized call unexpectedly succeeded");
    failed++;
  } else {
    console.log("PASS", name, "rejected", response.status);
  }
}

if (failed) process.exit(1);

console.log(
  `${rejectionCases.length} SECURITY DEFINER ordinary-user rejection probes passed`,
);
console.log(
  "Fixture-aware staging validation remains required for before/after state, legitimate claimant operational updates, and check_write_abuse bounded behavior.",
);
