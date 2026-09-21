#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
// CNGx curated station importer. DRY RUN by default; --apply requires explicit approval.
const apply=process.argv.includes("--apply");
const fileArg=process.argv.find(x=>x.endsWith(".json"))||"data/sources/picng-refuelling-stations-2026-09-21.json";
const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL fallback) and SUPABASE_SERVICE_ROLE_KEY are required (server/admin only).");
const snapshot=JSON.parse(fs.readFileSync(fileArg,"utf8"));
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const norm=v=>(v||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
const fingerprint=r=>[norm(r.operator_name??r.operator),norm(r.address),norm(r.state)].join("|");
const stats={new:0,possible_duplicate:0,unchanged:0,conflict:0,invalid:0},planned=[];
const {data:existing,error}=await db.from("stations").select("id,name,operator_name,address,state,record_source_type,record_source_reference,claimed_by,status,price_per_scm,queue_minutes,open_now");
if(error) throw error;
const byRef=new Map(),byFingerprint=new Map();
for(const s of existing||[]){if(s.record_source_reference)byRef.set((s.record_source_type||"")+"|"+s.record_source_reference,s);const f=fingerprint(s);if(!byFingerprint.has(f))byFingerprint.set(f,[]);byFingerprint.get(f).push(s);}
for(const r of snapshot.records){
 const invalid=!r.source_reference||!r.operator||!r.address||!r.state||!["exact","approximate","unconfirmed"].includes(r.location_precision)||((r.latitude==null)!=(r.longitude==null))||(r.latitude!=null&&(r.latitude< -90||r.latitude>90||r.longitude< -180||r.longitude>180));
 if(invalid){stats.invalid++;planned.push({action:"invalid",source_reference:r.source_reference});continue;}
 const ref=byRef.get("official_directory|"+r.source_reference);
 if(ref){if(fingerprint(ref)===fingerprint(r)){stats.unchanged++;planned.push({action:"unchanged",source_reference:r.source_reference,id:ref.id});}else{stats.conflict++;planned.push({action:"conflict",source_reference:r.source_reference,id:ref.id});}continue;}
 const matches=byFingerprint.get(fingerprint(r))||[];
 if(matches.length){stats.possible_duplicate++;planned.push({action:"possible_duplicate",source_reference:r.source_reference,ids:matches.map(x=>x.id),claimed:matches.some(x=>!!x.claimed_by)});continue;}
 stats.new++;planned.push({action:"new",source_reference:r.source_reference});
 if(apply){const payload={name:r.operator+" — "+(r.address==="Address pending confirmation"?r.state:r.address),operator_name:r.operator,address:r.address,state:r.state,latitude:r.latitude,longitude:r.longitude,status:"unknown",price_per_scm:null,queue_minutes:null,open_now:null,is_demo:false,is_verified:false,registration_status:"pending",record_source_type:"official_directory",record_source_name:snapshot.source_name,record_source_url:r.source_url,record_source_reference:r.source_reference,record_source_observed_at:snapshot.observed_at,location_precision:r.location_precision,location_source_type:r.location_source_type??null,location_source_name:r.location_source_name??null,location_source_url:r.location_source_url??null,location_source_observed_at:r.location_source_observed_at??null,status_updated_at:null,price_updated_at:null,queue_updated_at:null,last_verified_at:null};const {error:e}=await db.from("stations").insert(payload);if(e)throw e;}
}
console.log(JSON.stringify({mode:apply?"APPLY":"DRY_RUN",source:fileArg,counts:stats,details:planned},null,2));
if(!apply)console.error("DRY RUN only. No rows inserted. --apply requires explicit product-lead approval.");
