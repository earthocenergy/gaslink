import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const proxy=read("proxy.ts");
const config=read("next.config.ts");
const rpc=read("docs/rpc-surface-review.md");
const requiredProxy=["/admin/:path*","auth.getUser()","decideAdminAccess(","ADMIN_MFA_ENFORCEMENT","/admin/security"];
for(const token of requiredProxy) if(!proxy.includes(token)) throw new Error(`Admin protection missing: ${token}`);

for(const header of ["Content-Security-Policy","X-Content-Type-Options","Referrer-Policy","Permissions-Policy","X-Frame-Options","Strict-Transport-Security"]){
  if(!config.includes(header)) throw new Error(`Security header missing: ${header}`);
}
for(const directive of ["frame-ancestors 'none'","object-src 'none'","connect-src 'self' https://*.supabase.co wss://*.supabase.co"]){
  if(!config.includes(directive)) throw new Error(`CSP directive missing: ${directive}`);
}
if(!rpc.includes("`approve_station_registration(uuid,boolean)` | obsolete/overlapping")) throw new Error("RPC overlap classification missing");

const scanFiles=[".env.example","next.config.ts","proxy.ts","lib/supabase/client.ts"];
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/SUPABASE_SERVICE_ROLE(?:_KEY)?\s*=\s*[^\s]+/i,/sb_secret_[A-Za-z0-9_-]{20,}/];
for(const file of scanFiles){const text=read(file);for(const pattern of forbidden)if(pattern.test(text))throw new Error(`Potential secret in ${file}: ${pattern}`)}
const dashboard=read("app/dashboard/page.tsx");
const accountSecurity=read("app/account/security/page.tsx");
const updatePassword=read("app/auth/update-password/page.tsx");

if(!dashboard.includes('signOut({scope:"local"})'))
  throw new Error("Dashboard signout must be current-session only");

for(const scope of ['scope: "local"','scope: "others"','scope: "global"']){
  if(!accountSecurity.includes(scope))
    throw new Error(`Account session control missing: ${scope}`);
}

if(!updatePassword.includes('signOut({scope:"others"})'))
  throw new Error("Password recovery must revoke other sessions");

const adminSecurity=read("app/admin/security/page.tsx");

for(const token of [
  "mfa.getAuthenticatorAssuranceLevel()",
  "mfa.listFactors()",
  'factor.status === "verified"',
  'factorType: "totp"',
  "mfa.challenge(",
  "mfa.verify(",
  "verifiedFactorId",
  "challengeExistingFactor",
  '"Verify authenticator"',
  'level === "aal2"'
]){
  if(!adminSecurity.includes(token))
    throw new Error(`Admin MFA flow missing: ${token}`);
}

if(!proxy.includes('ADMIN_MFA_ENFORCEMENT ?? "enrolment"'))
  throw new Error("Admin MFA default must remain enrolment");

if(!proxy.includes('ADMIN_MFA_ENFORCEMENT === "required"'))
  throw new Error("Admin MFA required-mode enforcement missing");

if(!adminSecurity.includes('level === "aal2"'))
  throw new Error("Admin MFA AAL2 UI state missing");

const abuseFoundation=read("lib/security/abuse.ts");
const protectedWriteRoute=read("app/api/write/[action]/route.ts");
const protectedWriteClient=read("lib/security/protected-write.ts");
const abuseMigration=read("supabase/migrations/20260927200000_rate_abuse_foundation.sql");

for(const action of [
  "station_report",
  "station_claim",
  "station_registration",
  "marketplace_listing",
  "marketplace_enquiry",
  "provider_onboarding",
  "service_offering",
  "service_enquiry",
  "business_enquiry"
]){
  if(!abuseFoundation.includes(`"${action}"`))
    throw new Error(`Protected write action missing: ${action}`);
  if(!protectedWriteRoute.includes(`case "${action}"`))
    throw new Error(`Protected write route missing: ${action}`);
}

for(const token of [
  "networkFingerprint(request)",
  "duplicateFingerprint(",
  'rpc("check_write_abuse"',
  '"authentication_required"',
  '"rate_limited"',
  '"duplicate"',
  '"temporarily_blocked"'
]){
  if(!protectedWriteRoute.includes(token))
    throw new Error(`Protected write gateway control missing: ${token}`);
}

if(!protectedWriteClient.includes("/api/write/"))
  throw new Error("Protected write client does not use server gateway");

for(const token of [
  "abuse_write_events",
  "enable row level security",
  "security definer",
  "auth.uid()",
  "rate_limited",
  "duplicate",
  "temporarily_blocked",
  "interval '5 seconds'",
  "v_recent_burst",
  "p_action not in ("
]){
  if(!abuseMigration.includes(token))
    throw new Error(`Abuse migration control missing: ${token}`);
}

const stationPage=read("app/stations/[id]/page.tsx");
const stationRegistrationPage=read("app/register-station/page.tsx");
const businessPage=read("app/business/page.tsx");

for(const [source,action] of [
  [stationPage,'protectedWrite("station_report"'],
  [stationPage,'protectedWrite("station_claim"'],
  [stationRegistrationPage,'protectedWrite("station_registration"'],
  [businessPage,'protectedWrite("business_enquiry"']
]){
  if(!source.includes(action))
    throw new Error(`Protected client write missing: ${action}`);
}

for(const [source,forbidden] of [
  [stationPage,'.from("station_reports").insert('],
  [stationPage,'.from("station_claims").insert('],
  [stationRegistrationPage,'.from("stations").insert('],
  [businessPage,'.from("business_enquiries").insert(']
]){
  if(source.includes(forbidden))
    throw new Error(`Direct protected browser write remains: ${forbidden}`);
}

const providerJoinPage=read("app/services/join/page.tsx");
const serviceDetailPage=read("app/services/[id]/page.tsx");
const providerPage=read("app/services/provider/page.tsx");
const marketplaceSellPage=read("app/marketplace/sell/page.tsx");
const marketplaceDetailPage=read("app/marketplace/[id]/page.tsx");

for(const [source,action] of [
  [providerJoinPage,'protectedWrite("provider_onboarding"'],
  [serviceDetailPage,'protectedWrite("service_enquiry"'],
  [providerPage,'protectedWrite("service_offering"'],
  [marketplaceSellPage,'protectedWrite("marketplace_listing"'],
  [marketplaceDetailPage,'protectedWrite("marketplace_enquiry"']
]){
  if(!source.includes(action))
    throw new Error(`Protected client write missing: ${action}`);
}

for(const [source,forbidden] of [
  [providerJoinPage,'.from("service_providers").insert('],
  [serviceDetailPage,'.from("service_enquiries").insert('],
  [providerPage,'.from("service_offerings").insert('],
  [marketplaceSellPage,'.from("marketplace_sellers").insert('],
  [marketplaceSellPage,'.from("marketplace_listings").insert('],
  [marketplaceDetailPage,'.from("marketplace_enquiries").insert(']
]){
  if(source.includes(forbidden))
    throw new Error(`Direct protected browser write remains: ${forbidden}`);
}

const adminAccess=read("lib/security/admin-access.ts");

for(const token of [
  'profileError',
  'kind: "unavailable"',
  'kind: "dashboard"',
  'kind: "security"',
  'input.aalError',
  'input.aalLevel !== "aal2"'
]){
  if(!adminAccess.includes(token))
    throw new Error(`Admin access policy missing: ${token}`);
}

if(!proxy.includes("decideAdminAccess("))
  throw new Error("Proxy must use centralized admin access policy");

console.log("Foundation lock static checks OK");
