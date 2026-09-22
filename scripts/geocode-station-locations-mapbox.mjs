#!/usr/bin/env node
/**
 * CNGx Mapbox Permanent Geocoding pilot.
 * Offline by default. External calls require BOTH --pilot and --execute.
 * Never reads or writes Supabase and never accepts NEXT_PUBLIC_* tokens.
 */
import fs from "node:fs/promises";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const pilot = args.has("--pilot");
const execute = args.has("--execute");
const token = process.env.MAPBOX_ACCESS_TOKEN;
const inputPath = path.resolve("data/enrichment/picng-stations-requiring-geocoding-2026-09-22.json");
const outputPath = path.resolve("data/enrichment/mapbox-permanent-geocoding-pilot-2026-09-22.json");
const MAX_REQUESTS = 24;
const observedAt = new Date().toISOString();

const selected = [
  "picng-7acdd2023622ddc15506e499",
  "picng-7313d7f428cb7e41a9f21be1",
  "picng-380832acf4d33ef3ad1b52fd",
  "picng-eda2c536f5b850d1fc330d40",
  "picng-bd3fa674b66d3759f5272c21",
  "picng-9ebf3baa95c1f566035390cb",
  "picng-dfe3185168c181ed4e824888",
  "picng-a251565a45f39fe2dd7fec77",
  "picng-37d3e778634055ab49376adb",
  "picng-c08f466cbb9dfd2cb6c691bf",
  "picng-bc95a10edf058f1158064010",
  "picng-325ccdc6f2864cf556ab3bbb"
];

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const source = JSON.parse(await fs.readFile(inputPath, "utf8"));
const byRef = new Map(source.records.map(record => [record.source_reference, record]));
const sample = selected.map(ref => {
  const record = byRef.get(ref);
  if (!record) throw new Error(`Missing pilot source_reference: ${ref}`);
  if (/^address pending confirmation$/i.test(clean(record.address))) {
    throw new Error(`Placeholder address prohibited: ${ref}`);
  }
  return record;
});

if (!pilot || !execute) {
  console.log(JSON.stringify({
    mode: "dry_run",
    external_requests: 0,
    sample_count: sample.length,
    max_requests: MAX_REQUESTS,
    execute_requires: ["--pilot", "--execute", "MAPBOX_ACCESS_TOKEN"]
  }, null, 2));
  process.exit(0);
}
if (!token) throw new Error("MAPBOX_ACCESS_TOKEN is required for external pilot execution.");
if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN === token) {
  throw new Error("Refusing a token duplicated in NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
}

let requestCount = 0;
const results = [];
function contextValue(feature, prefix) {
  const all = [feature, ...(feature.properties?.context ?? [])];
  const item = all.find(x => String(x.id ?? "").startsWith(prefix) || String(x.mapbox_id ?? "").includes(prefix));
  return item?.name ?? item?.text ?? null;
}
function classify(feature, expectedState) {
  if (!feature) return { decision: "unresolved", note: "No useful permanent result." };
  const props = feature.properties ?? {};
  const featureType = props.feature_type ?? feature.place_type?.[0] ?? null;
  const confidence = props.match_code?.confidence ?? null;
  const accuracy = props.coordinates?.accuracy ?? null;
  const region = contextValue(feature, "region") ?? props.context?.region?.name ?? null;
  const stateOk = !region || clean(region).toLowerCase().includes(clean(expectedState).replace(/^fct\s+/i,"").toLowerCase());
  const broad = ["region","place","district","locality"].includes(featureType);
  if (!stateOk) return { decision:"rejected", note:"Returned region/state contradicts source." };
  if (broad) return { decision:"unresolved", note:"Result is broad place/state/locality level." };
  if (featureType === "address" && ["exact","high"].includes(confidence) && ["rooftop","parcel","point"].includes(accuracy)) {
    return { decision:"candidate_exact", note:"Address-level candidate meets automated exact gate; product-lead review still required." };
  }
  if (featureType === "address" || ["street","secondary_address"].includes(featureType)) {
    return { decision:"candidate_approximate", note:"Plausible address/street candidate without facility-level exact gate." };
  }
  return { decision:"manual_review", note:"Potentially useful result requires human review." };
}
async function geocode(record, variant=1) {
  if (++requestCount > MAX_REQUESTS) throw new Error("Hard request ceiling exceeded.");
  const query = variant === 1 ? `${clean(record.address)}, ${clean(record.state)}` : clean(record.address);
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", query);
  url.searchParams.set("country", "NG");
  url.searchParams.set("autocomplete", "false");
  url.searchParams.set("permanent", "true");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mapbox request failed (${response.status})`);
  const payload = await response.json();
  return { query, feature: payload.features?.[0] ?? null };
}
for (const record of sample) {
  let attempt = await geocode(record, 1);
  let feature = attempt.feature;
  let classification = classify(feature, record.state);
  let variant = 1;
  if ((!feature || ["rejected","unresolved"].includes(classification.decision)) && requestCount < MAX_REQUESTS) {
    attempt = await geocode(record, 2); feature = attempt.feature; variant = 2;
    classification = classify(feature, record.state);
  }
  const p = feature?.properties ?? {};
  const coords = p.coordinates ?? {};
  results.push({
    source_reference:record.source_reference, operator:record.operator, source_address:record.address, state:record.state,
    query_used:attempt.query, query_variant_number:variant, provider:"mapbox", provider_product:"geocoding_v6", storage_mode:"permanent",
    permanent:true, mapbox_id:p.mapbox_id ?? feature?.id ?? null, feature_type:p.feature_type ?? feature?.place_type?.[0] ?? null,
    candidate_latitude:coords.latitude ?? feature?.geometry?.coordinates?.[1] ?? null,
    candidate_longitude:coords.longitude ?? feature?.geometry?.coordinates?.[0] ?? null,
    coordinates_accuracy:coords.accuracy ?? null, returned_name:p.name ?? feature?.text ?? null,
    returned_full_address:p.full_address ?? feature?.place_name ?? null, returned_place:contextValue(feature,"place"),
    returned_region:contextValue(feature,"region"), returned_country:contextValue(feature,"country"),
    match_code:p.match_code ?? null, match_confidence:p.match_code?.confidence ?? null, observed_at:observedAt,
    candidate_decision:classification.decision, review_notes:classification.note
  });
}
await fs.writeFile(outputPath, JSON.stringify({observed_at:observedAt,permanent:true,total_requests:requestCount,records:results},null,2)+"\n");
console.log(JSON.stringify({mode:"executed_permanent_pilot",requests:requestCount,records:results.length,output:outputPath},null,2));
