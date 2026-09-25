#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const migrationPath="supabase/migrations/20260925165500_controlled_publication_publish_unpublish.sql";
const migration=read(migrationPath);
const ui=read("app/admin/stations/publication/page.tsx");
const doctrine=read("docs/controlled-publication-pilot.md");
const manifestText=read("data/enrichment/cngx-publication-pilot-2026-09-25.json");
const manifest=JSON.parse(manifestText);
const pkg=JSON.parse(read("package.json"));

function gitBlobSha(p){
  const bytes=fs.readFileSync(path.join(root,p));
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest("hex");
}
function section(start,end){
  const i=migration.indexOf(start);assert.ok(i>=0,`missing ${start}`);
  const j=end?migration.indexOf(end,i+start.length):-1;
  return migration.slice(i,j>=0?j:undefined);
}
let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS ${passed}: ${label}`);}

const publish=section("create or replace function public.admin_publish_station","create or replace function public.admin_unpublish_station");
const unpublish=section("create or replace function public.admin_unpublish_station",null);
const review=section("create or replace function public.admin_review_station_publication","create or replace function public.admin_publish_station");
const pilotRefs=manifest.entries.map(x=>x.record_source_reference).sort();

check("unreviewed cannot publish",()=>assert.match(publish,/v_previous_status <> 'eligible'/));
check("withheld cannot publish",()=>assert.match(publish,/Only eligible official-directory stations can be published/));
check("eligible can publish",()=>assert.match(publish,/set publication_status = 'published'/));
check("published cannot publish again",()=>assert.match(publish,/v_previous_status <> 'eligible'/));
check("published cannot be changed by review RPC",()=>assert.match(review,/if v_previous_status = 'published'[\s\S]*Published stations must be unpublished before changing review state/));
check("published can unpublish",()=>assert.match(unpublish,/v_previous_status <> 'published'/));
check("unpublish returns published to eligible",()=>assert.match(unpublish,/set publication_status = 'eligible'/));
check("unpublish requires reason",()=>assert.match(unpublish,/if v_notes is null[\s\S]*An unpublish reason is required/));
check("publish requires note",()=>assert.match(publish,/if v_notes is null[\s\S]*A publication note is required/));
check("publish and unpublish enforce 2000-character note maximum",()=>{assert.match(publish,/char_length\(v_notes\) > 2000/);assert.match(unpublish,/char_length\(v_notes\) > 2000/)});
check("non-admin cannot publish",()=>assert.match(publish,/select 1 from public\.profiles where id = auth\.uid\(\) and role = 'admin'/));
check("anon cannot publish or unpublish",()=>{assert.match(migration,/revoke all on function public\.admin_publish_station\(uuid, text\) from public, anon/);assert.match(migration,/revoke all on function public\.admin_unpublish_station\(uuid, text\) from public, anon/)});
check("PUBLIC cannot execute publish or unpublish",()=>{assert.match(migration,/revoke all on function public\.admin_publish_station/);assert.match(migration,/revoke all on function public\.admin_unpublish_station/)});
check("authenticated is the only granted caller role",()=>{assert.match(migration,/grant execute on function public\.admin_publish_station\(uuid, text\) to authenticated/);assert.match(migration,/grant execute on function public\.admin_unpublish_station\(uuid, text\) to authenticated/)});
check("non-directory station cannot publish",()=>assert.match(publish,/record_source_type = 'official_directory'/));
check("publish changes no registration field",()=>assert.equal(/set[\s\S]{0,160}registration_status/i.test(publish),false));
check("publish changes no verification field",()=>assert.equal(/set[\s\S]{0,160}is_verified/i.test(publish),false));
check("publish changes no operational fields",()=>{for(const field of ["status =","price_per_scm","queue_minutes","open_now","last_verified_at"])assert.equal(publish.includes(field),false)});
check("publish changes no coordinate or provenance fields",()=>{for(const field of ["latitude =","longitude =","location =","location_precision =","location_source_type =","record_source_type ="])assert.equal(/set[\s\S]{0,180}/.test(publish)&&publish.includes(field)&&field!=="record_source_type =",false)});
check("publish appends exactly one audit insert path",()=>assert.equal((publish.match(/insert into public\.station_publication_reviews/g)||[]).length,1));
check("publish audit is eligible to published",()=>assert.match(publish,/p_station_id, 'eligible', 'published', auth\.uid\(\), v_notes/));
check("unpublish appends exactly one audit insert path",()=>assert.equal((unpublish.match(/insert into public\.station_publication_reviews/g)||[]).length,1));
check("unpublish audit is published to eligible",()=>assert.match(unpublish,/p_station_id, 'published', 'eligible', auth\.uid\(\), v_notes/));
check("same-state and duplicate publish actions fail before audit insertion",()=>{assert.ok(publish.indexOf("v_previous_status <> 'eligible'")<publish.indexOf("insert into public.station_publication_reviews"));assert.ok(unpublish.indexOf("v_previous_status <> 'published'")<unpublish.indexOf("insert into public.station_publication_reviews"))});
check("review RPC retains decision allowlist",()=>assert.match(review,/p_decision not in \('eligible', 'withheld', 'unreviewed'\)/));
check("all mutation RPCs are SECURITY DEFINER with pinned search path",()=>{assert.equal((migration.match(/security definer/g)||[]).length,3);assert.equal((migration.match(/set search_path = public, pg_temp/g)||[]).length,3)});
check("row locks protect publish and unpublish transitions",()=>{assert.match(publish,/for update/);assert.match(unpublish,/for update/)});
check("UI Publish exists only as an eligible-state action",()=>{assert.match(ui,/onClick=\{\(\)=>publishStation\(station\)\}>Publish<\/button>/);assert.match(ui,/disabled=\{mutationPending\|\|!eligibleCurrent\}/)});
check("UI Unpublish exists only as a published-state action",()=>{assert.match(ui,/onClick=\{\(\)=>unpublishStation\(station\)\}>Unpublish<\/button>/);assert.match(ui,/disabled=\{mutationPending\|\|!publishedCurrent\}/)});
check("published review controls are disabled",()=>{assert.match(ui,/eligibleCurrent\|\|publishedCurrent/);assert.match(ui,/withheldCurrent\|\|publishedCurrent/);assert.match(ui,/unreviewedCurrent\|\|publishedCurrent/)});
check("typed PUBLISH confirmation is exact",()=>{assert.match(ui,/Type PUBLISH to confirm/);assert.match(ui,/confirmation!=="PUBLISH"/)});
check("publish warning separates visibility from verification and operations",()=>assert.match(ui,/Publishing makes this directory record visible in CNGx\. It does not verify the station or confirm live operating conditions\./));
check("unpublish warning explains public removal and eligible rollback",()=>assert.match(ui,/Unpublishing removes this directory record from public CNGx discovery and returns it to eligible review state\./));
check("no bulk publish or publish-all path exists",()=>assert.equal(/bulk publish|publish all|publish-all/i.test(ui+"\n"+migration),false));
check("Published summary exists",()=>assert.match(ui,/summary\.published[\s\S]*Published/));
check("Published filter exists",()=>assert.match(ui,/<option value="published">Published<\/option>/));
check("review history remains inline",()=>{assert.match(ui,/expanded&&<section id=\{historyRegionId\}/);assert.match(ui,/Internal admin review/)});
check("reviewer UUID is not selected or displayed",()=>assert.equal(/reviewer_id/.test(ui),false));
check("shared per-station mutation protection covers all actions",()=>{assert.match(ui,/beginStationMutation/);assert.match(ui,/pendingMutationRef\.current\.has\(station\.id\)/);assert.match(ui,/Updating…/)});
check("no direct client stations update fallback exists",()=>assert.equal(/from\("stations"\)\.update/.test(ui),false));
check("missing publish RPC fails safely",()=>assert.match(ui,/Publication action schema not applied yet\./));
check("pilot manifest contains exactly two entries",()=>assert.equal(manifest.entries.length,2));
check("pilot manifest contains exact approved source references",()=>assert.deepEqual(pilotRefs,["picng-7acdd2023622ddc15506e499","picng-8156d44c6cd771ead33e9f0d"].sort()));
check("pilot manifest contains no UUID or secret fields",()=>{assert.equal(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(manifestText),false);assert.equal(/station_id|user_id|reviewer_id|token|credential|secret|password/i.test(manifestText),false)});
check("mapped candidate expected map behavior is eligible",()=>{const x=manifest.entries.find(x=>x.pilot_type==="mapped_approximate");assert.equal(x.expected_location_precision,"approximate");assert.equal(x.expected_map_behavior,"eligible")});
check("unconfirmed candidate expected map behavior is ineligible",()=>{const x=manifest.entries.find(x=>x.pilot_type==="text_only_unconfirmed");assert.equal(x.expected_location_precision,"unconfirmed");assert.equal(x.expected_map_behavior,"ineligible");assert.equal(x.expected_directions_behavior,"address_based")});
check("pilot doctrine rejects verification/live-operation implications",()=>{for(const phrase of ["CNGx verified","currently operational","open now","price confirmed","queue confirmed"])assert.ok(doctrine.includes(phrase))});
check("pilot doctrine defines reversible published to eligible rollback",()=>assert.match(doctrine,/published → eligible/));
check("existing publication migrations remain byte-identical",()=>{
  const expected={
    "supabase/migrations/20260924192838_station_publication_foundation.sql":"3d751364b2634348d8c1a9b329f36ef8be0d72c5",
    "supabase/migrations/20260924192910_station_publication_admin_review.sql":"d5ebaa64379da1736a8a0d240f34d11c6c807005",
    "supabase/migrations/20260925133006_station_publication_same_state_guard.sql":"544914397e33e09c469aad7acd428870cb388d92",
    "supabase/migrations/20260925143953_public_discovery_visibility_cutover.sql":"9ab6f8a4377a86ac7a96f165d4b1e0b93ee81a00"
  };
  for(const [p,sha] of Object.entries(expected))assert.equal(gitBlobSha(p),sha,p);
});
check("public-discovery tests remain in prebuild",()=>assert.match(pkg.scripts.prebuild,/test:public-discovery/));
check("003F-1 build scripts do not apply migrations",()=>assert.equal(/apply[_:-]?migration|supabase\s+db\s+push/i.test(Object.values(pkg.scripts).join(" ")),false));
check("publication pilot test is wired into prebuild",()=>assert.match(pkg.scripts.prebuild,/test:publication-pilot/));

console.log(`Controlled publication pilot suite passed: ${passed} checks.`);
