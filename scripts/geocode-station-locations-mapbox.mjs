#!/usr/bin/env node
/**
 * CNGx Mapbox Permanent Geocoding pilot.
 * Offline by default. External calls require BOTH --pilot and --execute.
 * Never reads or writes Supabase and never accepts NEXT_PUBLIC_* tokens.
 */
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_REQUESTS = 24;
export const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

export function contextValue(feature, type) {
  const context = feature?.properties?.context;
  if (context && !Array.isArray(context) && typeof context === "object") {
    const item = context[type];
    return item?.name ?? item?.text ?? item?.short_code ?? null;
  }
  if (Array.isArray(context)) {
    const item = context.find(x => String(x?.id ?? "").startsWith(type) || String(x?.mapbox_id ?? "").includes(type));
    return item?.name ?? item?.text ?? null;
  }
  return null;
}

const normalizedState = value => clean(value).replace(/^fct\s+/i, "").replace(/\s+state$/i, "").toLowerCase();
export function stateMatches(feature, expectedState) {
  const region = contextValue(feature, "region");
  if (!region) return false;
  const actual = normalizedState(region);
  const expected = normalizedState(expectedState);
  return actual === expected || actual.includes(expected) || expected.includes(actual);
}

function componentContradiction(feature) {
  const match = feature?.properties?.match_code;
  if (!match || typeof match !== "object") return false;
  if (match.region === "unmatched") return true;
  return ["address","street","place","locality","district"].some(k => match[k] === "unmatched");
}

export function compactCandidate(feature) {
  if (!feature) return null;
  const p = feature.properties ?? {};
  const coords = p.coordinates ?? {};
  return {
    mapbox_id:p.mapbox_id ?? feature.id ?? null,
    feature_type:p.feature_type ?? feature.place_type?.[0] ?? null,
    candidate_latitude:coords.latitude ?? feature.geometry?.coordinates?.[1] ?? null,
    candidate_longitude:coords.longitude ?? feature.geometry?.coordinates?.[0] ?? null,
    coordinates_accuracy:coords.accuracy ?? null,
    returned_name:p.name ?? feature.text ?? null,
    returned_full_address:p.full_address ?? feature.place_name ?? null,
    returned_place:contextValue(feature,"place"),
    returned_district:contextValue(feature,"district"),
    returned_locality:contextValue(feature,"locality"),
    returned_region:contextValue(feature,"region"),
    returned_country:contextValue(feature,"country"),
    match_code:p.match_code ?? null,
    match_confidence:p.match_code?.confidence ?? null
  };
}

export function classify(feature, expectedState) {
  if (!feature) return { decision:"unresolved", note:"No useful permanent result." };
  const p = feature.properties ?? {};
  const featureType = p.feature_type ?? feature.place_type?.[0] ?? null;
  const confidence = p.match_code?.confidence ?? null;
  const accuracy = p.coordinates?.accuracy ?? null;
  const region = contextValue(feature,"region");
  const broad = ["region","place","district","locality"].includes(featureType);
  if (region && !stateMatches(feature, expectedState)) return {decision:"rejected",note:"Returned region/state contradicts source."};
  if (broad) return {decision:"unresolved",note:"Result is broad place/state/locality level."};
  const exactGate = featureType === "address" && Boolean(region) && stateMatches(feature, expectedState)
    && ["exact","high"].includes(confidence) && ["rooftop","parcel","point"].includes(accuracy)
    && !componentContradiction(feature);
  if (exactGate) return {decision:"candidate_exact",note:"Address-level candidate meets automated exact gate; product-lead review still required."};
  if (featureType === "address" || ["street","secondary_address"].includes(featureType)) {
    return {decision:"candidate_approximate",note:!region ? "Address/street candidate lacks positive region evidence; cannot be exact." : "Plausible address/street candidate without facility-level exact gate."};
  }
  return {decision:"manual_review",note:"Potentially useful result requires human review."};
}

function localityEvidence(feature) {
  return [contextValue(feature,"place"),contextValue(feature,"district"),contextValue(feature,"locality")].filter(Boolean).map(clean);
}
function sourceTokens(record) {
  return clean(record.address).toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3);
}
function plausibility(feature, record) {
  const c=classify(feature,record.state);
  if (c.decision==="rejected"||c.decision==="unresolved") return 0;
  const text=[feature?.properties?.full_address,feature?.place_name,...localityEvidence(feature)].filter(Boolean).join(" ").toLowerCase();
  const hits=sourceTokens(record).filter(t=>text.includes(t)).length;
  return (stateMatches(feature,record.state)?4:0)+(c.decision==="candidate_exact"?4:c.decision==="candidate_approximate"?2:1)+Math.min(hits,3);
}
export function selectCandidate(features, record) {
  const ranked=(features??[]).map((feature,index)=>({feature,index,score:plausibility(feature,record)})).sort((a,b)=>b.score-a.score);
  if (!ranked.length || ranked[0].score===0) return {primary:null,classification:{decision:"unresolved",note:"No useful permanent result."},ambiguous:false};
  const top=ranked[0], second=ranked[1];
  const ambiguous=Boolean(second && second.score>0 && top.score-second.score<=1);
  if (ambiguous) return {primary:top.feature,classification:{decision:"manual_review",note:"Two or more provider candidates remain materially plausible; manual review required."},ambiguous:true};
  return {primary:top.feature,classification:classify(top.feature,record.state),ambiguous:false};
}

export function queryFor(record, variant=1) {
  const address=clean(record.address);
  const state=clean(record.state);
  if (variant===1) return `${address}, ${state}`;
  const normalized=address.replace(/\s*,\s*/g,", ").replace(/\bRd\b/gi,"Road").replace(/\bSt\b/gi,"Street").replace(/\bOpposite\b/gi,"Opp.").replace(/\s+/g," ");
  return `${normalized}, ${state}`;
}

async function main() {
  const args=new Set(process.argv.slice(2));
  const pilot=args.has("--pilot"), execute=args.has("--execute");
  const token=process.env.MAPBOX_ACCESS_TOKEN;
  const inputPath=path.resolve("data/enrichment/picng-stations-requiring-geocoding-2026-09-22.json");
  const outputPath=path.resolve("data/enrichment/mapbox-permanent-geocoding-pilot-2026-09-22.json");
  const observedAt=new Date().toISOString();
  const selected=["picng-7acdd2023622ddc15506e499","picng-7313d7f428cb7e41a9f21be1","picng-380832acf4d33ef3ad1b52fd","picng-eda2c536f5b850d1fc330d40","picng-bd3fa674b66d3759f5272c21","picng-9ebf3baa95c1f566035390cb","picng-dfe3185168c181ed4e824888","picng-a251565a45f39fe2dd7fec77","picng-37d3e778634055ab49376adb","picng-c08f466cbb9dfd2cb6c691bf","picng-bc95a10edf058f1158064010","picng-325ccdc6f2864cf556ab3bbb"];
  const source=JSON.parse(await fs.readFile(inputPath,"utf8")); const byRef=new Map(source.records.map(r=>[r.source_reference,r]));
  const sample=selected.map(ref=>{const r=byRef.get(ref);if(!r)throw new Error(`Missing pilot source_reference: ${ref}`);if(/^address pending confirmation$/i.test(clean(r.address)))throw new Error(`Placeholder address prohibited: ${ref}`);return r;});
  if(!pilot||!execute){console.log(JSON.stringify({mode:"dry_run",external_requests:0,sample_count:sample.length,max_requests:MAX_REQUESTS,execute_requires:["--pilot","--execute","MAPBOX_ACCESS_TOKEN"]},null,2));return;}
  if(!token)throw new Error("MAPBOX_ACCESS_TOKEN is required for external pilot execution.");
  if(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN)throw new Error("Refusing execution while NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is present; use server-only MAPBOX_ACCESS_TOKEN.");
  let requestCount=0; const results=[];
  async function geocode(record,variant){
    if(++requestCount>MAX_REQUESTS)throw new Error("Hard request ceiling exceeded.");
    const query=queryFor(record,variant); const url=new URL("https://api.mapbox.com/search/geocode/v6/forward");
    for(const [k,v] of [["q",query],["country","NG"],["autocomplete","false"],["permanent","true"],["limit","5"],["access_token",token]])url.searchParams.set(k,v);
    const response=await fetch(url);if(!response.ok)throw new Error(`Mapbox request failed (${response.status})`);
    const payload=await response.json();return {query,features:payload.features??[]};
  }
  for(const record of sample){
    let variant=1,attempt=await geocode(record,1),selection=selectCandidate(attempt.features,record);
    if((!selection.primary||["rejected","unresolved"].includes(selection.classification.decision))&&requestCount<MAX_REQUESTS){
      variant=2;attempt=await geocode(record,2);selection=selectCandidate(attempt.features,record);
    }
    const primary=compactCandidate(selection.primary);
    results.push({source_reference:record.source_reference,operator:record.operator,source_address:record.address,state:record.state,query_used:attempt.query,query_variant_number:variant,provider:"mapbox",provider_product:"geocoding_v6",storage_mode:"permanent",permanent:true,...(primary??{}),provider_candidates:attempt.features.slice(0,5).map(compactCandidate),observed_at:observedAt,candidate_decision:selection.classification.decision,review_notes:selection.classification.note});
  }
  await fs.writeFile(outputPath,JSON.stringify({observed_at:observedAt,permanent:true,total_requests:requestCount,records:results},null,2)+"\n");
  console.log(JSON.stringify({mode:"executed_permanent_pilot",requests:requestCount,records:results.length,output:outputPath},null,2));
}
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) main().catch(e=>{console.error(e.message);process.exitCode=1;});
