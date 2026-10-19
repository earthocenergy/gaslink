import fs from "node:fs";

function read(path) {
  if (!fs.existsSync(path)) {
    throw new Error("Missing account-deletion file: " + path);
  }
  return fs.readFileSync(path, "utf8");
}

const contract = read("lib/account-deletion.ts");
const preflight = read("app/api/account/deletion/preflight/route.ts");
const page = read("app/account-deletion/page.tsx");
const privacy = read("app/privacy/page.tsx");
const terms = read("app/terms/page.tsx");
const support = read("app/support/page.tsx");
const layout = read("app/layout.tsx");
const footer = read("components/SiteFooter.tsx");

for (const token of [
  "ACCOUNT_DELETION_CONTRACT_VERSION",
  "destructiveDeletionEnabled: false",
  "REQUIRES LEGAL/PRODUCT DECISION",
  "retention_review_pending",
  "Supabase Storage ownership",
]) {
  if (!contract.includes(token)) {
    throw new Error("Deletion contract missing token: " + token);
  }
}

for (const token of [
  "supabase.auth.getUser()",
  '.from("profiles")',
  '.from("user_roles")',
  '.from("stations")',
  '.from("station_claims")',
  '.from("station_reports")',
  '.from("business_enquiries")',
  '.from("marketplace_sellers")',
  '.from("marketplace_enquiries")',
  '.from("service_providers")',
  '.from("service_enquiries")',
]) {
  if (!preflight.includes(token)) {
    throw new Error("Preflight missing read boundary: " + token);
  }
}

for (const forbidden of [
  "auth.admin.deleteUser",
  "SUPABASE_SERVICE_ROLE",
  "service_role",
  ".insert(",
  ".update(",
  ".upsert(",
  ".delete(",
  ".rpc(",
]) {
  if (preflight.includes(forbidden)) {
    throw new Error("Preflight contains forbidden destructive/privileged token: " + forbidden);
  }
}

if (!page.includes("/api/account/deletion/preflight")) {
  throw new Error("Account deletion page is not wired to the canonical preflight");
}

for (const source of [page, privacy, terms, support, footer]) {
  if (!source.includes("support@cngx.ng") && source !== footer) {
    throw new Error("Public legal/support surface missing support contact");
  }
}

for (const href of ["/privacy", "/terms", "/support", "/account-deletion"]) {
  if (!footer.includes(href)) {
    throw new Error("Footer missing public route: " + href);
  }
}

if (!layout.includes("<SiteFooter />")) {
  throw new Error("Global layout does not expose legal/support routes");
}

for (const protectedRef of [
  "picng-7acdd2023622ddc15506e499",
  "picng-8156d44c6cd771ead33e9f0d",
]) {
  if (preflight.includes(protectedRef) || contract.includes(protectedRef)) {
    throw new Error("Deletion contract must not special-case controlled-publication fixture " + protectedRef);
  }
}

console.log("Account-deletion contract checks passed");
