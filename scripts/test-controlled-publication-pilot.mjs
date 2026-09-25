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
const manifestPath="data/enrichment/cngx-publication-pilot-2026-09-25.json";
const manifestText=read(manifestPath);
const manifest=JSON.parse(manifestText);
const importer=read("scripts/import-station-snapshot.mjs");
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
function filesUnder(dir){
  const absolute=path.join(root,dir);
  if(!fs.existsSync(absolute))return [];
  return fs.readdirSync(absolute,{withFileTypes:true}).flatMap(entry=>{
    const rel=path.join(dir,entry.name);
    return entry.isDirectory()?filesUnder(rel):[rel];
  });
}
let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS ${passed}: ${label}`);}

const review=section("create or replace function public.admin_review_station_publication","create or replace function public.admin_publish_station");
const publish=section("create or replace function public.admin_publish_station","create or replace function public.admin_unpublish_station");
const unpublish=section("create or replace function public.admin_unpublish_station",null);
const publishMutation=publish.slice(publish.indexOf("update public.stations"),publish.indexOf("insert into public.station_publication_reviews"));
const unpublishMutation=unpublish.slice(unpublish.indexOf("update public.stations"),unpublish.indexOf("insert into public.station_publication_reviews"));
const pilotRefs=manifest.entries.map(x=>x.record_source_reference).sort();
const migrationPilotRefs=[...new Set([...publish.matchAll(/'(picng-[0-9a-f]+)'/g)].map(m=>m[1]))].sort();
const candidateA=manifest.entries.find(x=>x.record_source_reference==="picng-7acdd2023622ddc15506e499");
const candidateB=manifest.entries.find(x=>x.record_source_reference==="picng-8156d44c6cd771ead33e9f0d");
const publishUi=ui.slice(ui.indexOf("async function publishStation"),ui.indexOf("async function unpublishStation"));
const unpublishUi=ui.slice(ui.indexOf("async function unpublishStation"),ui.indexOf("if(access===null"));
const publishLock=publish.indexOf("for update;");
const publishPilotGuard=publish.indexOf("if v_record_source_reference not in");
const publishStateGuard=publish.indexOf("if v_previous_status <> 'eligible'");
const publishUpdate=publish.indexOf("update public.stations");
const publishAudit=publish.indexOf("insert into public.station_publication_reviews");
const reviewLock=review.indexOf("for update;");
const reviewPublishedGuard=review.indexOf("if v_previous_status = 'published'");
const reviewSameStateGuard=review.indexOf("if v_previous_status = p_decision");
const reviewUpdate=review.indexOf("update public.stations");
const reviewAudit=review.indexOf("insert into public.station_publication_reviews");
const unpublishLock=unpublish.indexOf("for update;");
const unpublishStateGuard=unpublish.indexOf("if v_previous_status <> 'published'");
const unpublishUpdate=unpublish.indexOf("update public.stations");
const unpublishAudit=unpublish.indexOf("insert into public.station_publication_reviews");

check("pilot manifest contains exactly two authorized references",()=>assert.equal(pilotRefs.length,2));
check("pilot references are the exact frozen pair",()=>assert.deepEqual(pilotRefs,["picng-7acdd2023622ddc15506e499","picng-8156d44c6cd771ead33e9f0d"].sort()));
check("Candidate A is present in the pilot manifest",()=>assert.ok(candidateA));
check("Candidate B is present in the pilot manifest",()=>assert.ok(candidateB));
check("Candidate A can publish only from eligible",()=>{assert.ok(migrationPilotRefs.includes(candidateA.record_source_reference));assert.match(publish,/v_previous_status <> 'eligible'/)});
check("Candidate B can publish only from eligible",()=>{assert.ok(migrationPilotRefs.includes(candidateB.record_source_reference));assert.match(publish,/v_previous_status <> 'eligible'/)});
check("third non-pilot eligible directory record is not authorized",()=>assert.equal(pilotRefs.includes("picng-nonpilot-eligible-test"),false));
check("publish RPC loads status and source reference under one row lock",()=>assert.match(publish,/select publication_status, record_source_reference[\s\S]*into v_previous_status, v_record_source_reference[\s\S]*record_source_type = 'official_directory'[\s\S]*for update/));
check("database publish allowlist exactly matches pilot manifest",()=>assert.deepEqual(migrationPilotRefs,pilotRefs));
check("non-pilot rejection is explicit",()=>assert.match(publish,/Station is not authorized for the controlled publication pilot\./));
check("non-pilot rejection occurs after the row lock",()=>assert.ok(publishLock>=0&&publishLock<publishPilotGuard));
check("non-pilot rejection occurs before station UPDATE",()=>assert.ok(publishPilotGuard>=0&&publishPilotGuard<publishUpdate));
check("non-pilot rejection occurs before audit INSERT",()=>assert.ok(publishPilotGuard>=0&&publishPilotGuard<publishAudit));
check("unreviewed pilot cannot publish",()=>assert.match(publish,/if v_previous_status <> 'eligible'[\s\S]*Only eligible official-directory stations can be published/));
check("withheld pilot cannot publish",()=>assert.match(publish,/if v_previous_status <> 'eligible'[\s\S]*Only eligible official-directory stations can be published/));
check("published pilot cannot republish",()=>assert.match(publish,/if v_previous_status <> 'eligible'[\s\S]*Only eligible official-directory stations can be published/));
check("eligible pilot reaches only the publication mutation after both guards",()=>assert.ok(publishPilotGuard<publishStateGuard&&publishStateGuard<publishUpdate));
check("unpublish remains available regardless of pilot allowlist",()=>{assert.equal(/picng-[0-9a-f]+/.test(unpublish),false);assert.match(unpublish,/v_previous_status <> 'published'/)});
check("unpublish returns published to eligible",()=>assert.match(unpublishMutation,/set publication_status = 'eligible'/));
check("review RPC retains only review decisions",()=>assert.match(review,/p_decision not in \('eligible', 'withheld', 'unreviewed'\)/));
check("review RPC cannot change published state",()=>assert.ok(reviewLock>=0&&reviewLock<reviewPublishedGuard&&reviewPublishedGuard<reviewUpdate));
check("review RPC retains same-state guard",()=>assert.ok(reviewSameStateGuard>=0&&reviewSameStateGuard<reviewUpdate&&reviewSameStateGuard<reviewAudit));
check("review RPC retains withheld reason requirement",()=>assert.match(review,/p_decision = 'withheld' and v_notes is null[\s\S]*A reason is required when withholding a station/));
check("review RPC retains note length bound",()=>assert.match(review,/char_length\(v_notes\) > 2000/));
check("all three mutation RPCs require authentication",()=>assert.equal((migration.match(/Authentication required/g)||[]).length,3));
check("all three mutation RPCs require admin role",()=>assert.equal((migration.match(/select 1 from public\.profiles where id = auth\.uid\(\) and role = 'admin'/g)||[]).length,3));
check("all three mutation RPCs are official-directory scoped",()=>assert.equal((migration.match(/record_source_type = 'official_directory'/g)||[]).length,3));
check("all three mutation RPCs use row locks",()=>assert.equal((migration.match(/for update;/g)||[]).length,3));
check("all three mutation RPCs are SECURITY DEFINER with pinned search path",()=>{assert.equal((migration.match(/security definer/g)||[]).length,3);assert.equal((migration.match(/set search_path = public, pg_temp/g)||[]).length,3)});
check("publish note is required and trimmed",()=>{assert.match(publish,/v_notes := nullif\(btrim\(coalesce\(p_notes, ''\)\), ''\)/);assert.match(publish,/if v_notes is null[\s\S]*A publication note is required/)});
check("unpublish reason is required and trimmed",()=>{assert.match(unpublish,/v_notes := nullif\(btrim\(coalesce\(p_notes, ''\)\), ''\)/);assert.match(unpublish,/if v_notes is null[\s\S]*An unpublish reason is required/)});
check("publish and unpublish notes are bounded to 2000 characters",()=>{assert.match(publish,/char_length\(v_notes\) > 2000/);assert.match(unpublish,/char_length\(v_notes\) > 2000/)});
check("publish changes no registration field",()=>assert.equal(/\bregistration_status\s*=/.test(publishMutation),false));
check("publish changes no verification field",()=>assert.equal(/\bis_verified\s*=/.test(publishMutation),false));
check("publish changes no operational fields",()=>{for(const field of ["status","price_per_scm","queue_minutes","open_now","last_verified_at"])assert.equal(new RegExp(`\\b${field}\\s*=`).test(publishMutation),false)});
check("publish changes no coordinate or provenance fields",()=>{for(const field of ["latitude","longitude","location","location_precision","location_source_type","location_source_name","record_source_type","record_source_name","record_source_reference"])assert.equal(new RegExp(`\\b${field}\\s*=`).test(publishMutation),false)});
check("unpublish changes only publication fields",()=>{for(const field of ["registration_status","is_verified","claimed_by","submitted_by","last_verified_at","status","price_per_scm","queue_minutes","open_now","latitude","longitude","location","location_precision","location_source_type","record_source_type"])assert.equal(new RegExp(`\\b${field}\\s*=`).test(unpublishMutation),false)});
check("publish appends exactly one audit event path",()=>assert.equal((publish.match(/insert into public\.station_publication_reviews/g)||[]).length,1));
check("publish audit is eligible to published",()=>assert.match(publish,/p_station_id, 'eligible', 'published', auth\.uid\(\), v_notes/));
check("unpublish appends exactly one audit event path",()=>assert.equal((unpublish.match(/insert into public\.station_publication_reviews/g)||[]).length,1));
check("unpublish audit is published to eligible",()=>assert.match(unpublish,/p_station_id, 'published', 'eligible', auth\.uid\(\), v_notes/));
check("publish/publish race is serialized by lock-before-state-check",()=>assert.ok(publishLock>=0&&publishLock<publishStateGuard&&publishStateGuard<publishUpdate&&publishUpdate<publishAudit));
check("publish/review race is serialized with both RPCs re-reading locked state",()=>{assert.ok(publishLock<publishStateGuard);assert.ok(reviewLock<reviewPublishedGuard);assert.ok(reviewLock<reviewSameStateGuard);assert.match(review,/Published stations must be unpublished before changing review state/)});
check("unpublish/unpublish race is serialized by lock-before-state-check",()=>assert.ok(unpublishLock>=0&&unpublishLock<unpublishStateGuard&&unpublishStateGuard<unpublishUpdate&&unpublishUpdate<unpublishAudit));
check("only one audit path follows one successful transition",()=>{assert.equal((publish.match(/insert into public\.station_publication_reviews/g)||[]).length,1);assert.equal((unpublish.match(/insert into public\.station_publication_reviews/g)||[]).length,1);assert.equal((review.match(/insert into public\.station_publication_reviews/g)||[]).length,1)});
check("UI derives pilot references directly from the canonical manifest",()=>{assert.match(ui,/import pilotManifest from "@\/data\/enrichment\/cngx-publication-pilot-2026-09-25\.json"/);assert.match(ui,/const PILOT_SOURCE_REFERENCES=new Set<string>\(pilotManifest\.entries\.map\(entry=>entry\.record_source_reference\)\)/)});
check("UI does not maintain a separate literal pilot reference list",()=>assert.equal(/picng-[0-9a-f]+/.test(ui),false));
check("UI pilot badge is driven by canonical pilot authorization",()=>{assert.match(ui,/const pilotAuthorized=isControlledPilot\(station\)/);assert.match(ui,/pilotAuthorized&&<span[^>]*>Controlled pilot<\/span>/)});
check("pilot badge exists only through the exact manifest-derived set",()=>assert.match(ui,/function isControlledPilot[\s\S]*PILOT_SOURCE_REFERENCES\.has\(row\.record_source_reference\)/));
check("non-pilot eligible Publish is disabled",()=>assert.match(ui,/disabled=\{mutationPending\|\|!eligibleCurrent\|\|!pilotAuthorized\}[\s\S]*>Publish<\/button>/));
check("non-pilot eligible disabled explanation is visible",()=>assert.match(ui,/eligibleCurrent&&!pilotAuthorized[\s\S]*Not authorized for current publication pilot/));
check("pilot eligible Publish is enabled by action matrix",()=>assert.match(ui,/disabled=\{mutationPending\|\|!eligibleCurrent\|\|!pilotAuthorized\}/));
check("published record Unpublish is not pilot-scoped",()=>{assert.match(ui,/disabled=\{mutationPending\|\|!publishedCurrent\}[\s\S]*>Unpublish<\/button>/);assert.equal(/pilotAuthorized[^\n]*Unpublish/.test(ui),false)});
check("published review controls are disabled",()=>{assert.match(ui,/eligibleCurrent\|\|publishedCurrent/);assert.match(ui,/withheldCurrent\|\|publishedCurrent/);assert.match(ui,/unreviewedCurrent\|\|publishedCurrent/)});
check("normal review controls remain available for non-pilot records",()=>{assert.match(ui,/onClick=\{\(\)=>review\(station,"eligible"\)\}/);assert.match(ui,/onClick=\{\(\)=>review\(station,"withheld"\)\}/);assert.match(ui,/onClick=\{\(\)=>review\(station,"unreviewed"\)\}/)});
check("UI publish flow checks eligible before pilot authorization before note",()=>{const eligible=publishUi.indexOf('station.publication_status!=="eligible"');const pilot=publishUi.indexOf('!isControlledPilot(station)');const note=publishUi.indexOf('Publication note (required)');assert.ok(eligible>=0&&eligible<pilot&&pilot<note)});
check("typed PUBLISH confirmation is retained exactly",()=>{assert.match(publishUi,/Type PUBLISH to confirm/);assert.match(publishUi,/confirmation!=="PUBLISH"/)});
check("publish confirmation shows station name",()=>assert.match(publishUi,/Station: \$\{station\.name\}/));
check("publish confirmation shows source reference",()=>assert.match(publishUi,/Source reference: \$\{station\.record_source_reference/));
check("publish confirmation shows location precision",()=>assert.match(publishUi,/Location precision: \$\{station\.location_precision\}/));
check("publish confirmation shows verification state",()=>assert.match(publishUi,/Verification: \$\{verificationLabel\}/));
check("publish confirmation shows operational state",()=>assert.match(publishUi,/Operations: \$\{operationalLabel\}/));
check("publish warning separates visibility from verification and live operations",()=>assert.match(publishUi,/Publishing makes this directory record visible in CNGx\. It does not verify the station or confirm live operating conditions\./));
check("publish flow makes one protected RPC call only",()=>assert.equal((publishUi.match(/rpc\("admin_publish_station"/g)||[]).length,1));
check("unpublish flow makes one protected RPC call only",()=>assert.equal((unpublishUi.match(/rpc\("admin_unpublish_station"/g)||[]).length,1));
check("no direct client stations update fallback exists",()=>assert.equal(/from\("stations"\)\.(?:insert|update|delete)/.test(ui),false));
check("shared per-station in-flight mutation protection remains",()=>{assert.match(ui,/function beginStationMutation/);assert.match(ui,/pendingMutationRef\.current\.has\(station\.id\)/);assert.match(ui,/Updating…/)});
check("missing publication RPC schema fails safely",()=>assert.match(ui,/Publication action schema not applied yet\./));
check("not-eligible error is sanitized",()=>assert.match(ui,/Only eligible official-directory stations can be published\./));
check("not-pilot-authorized error is sanitized",()=>assert.match(ui,/Not authorized for current publication pilot\./));
check("not-published unpublish error is sanitized",()=>assert.match(ui,/Only published official-directory stations can be unpublished\./));
check("published review-state error is sanitized",()=>assert.match(ui,/Published stations must be unpublished before changing review state\./));
check("missing publish note and unpublish reason errors are sanitized",()=>{assert.match(ui,/A publication note is required\./);assert.match(ui,/An unpublish reason is required\./)});
check("authentication and admin errors are sanitized",()=>{assert.match(ui,/Authentication required\./);assert.match(ui,/Admin access required\./)});
check("missing official-directory target error is sanitized",()=>assert.match(ui,/Official-directory station not found\./));
check("publication action errors do not return raw unknown database text",()=>assert.match(ui,/function safePublicationActionError[\s\S]*return fallback;/));
check("raw reviewer UUID is not selected or displayed",()=>assert.equal(/reviewer_id/.test(ui),false));
check("RPC EXECUTE is revoked from PUBLIC and anon",()=>{assert.match(migration,/revoke all on function public\.admin_publish_station\(uuid, text\) from public, anon/);assert.match(migration,/revoke all on function public\.admin_unpublish_station\(uuid, text\) from public, anon/)});
check("RPC EXECUTE is granted only to authenticated caller role",()=>{assert.match(migration,/grant execute on function public\.admin_publish_station\(uuid, text\) to authenticated/);assert.match(migration,/grant execute on function public\.admin_unpublish_station\(uuid, text\) to authenticated/)});
check("migration adds no direct UPDATE privilege on stations or audit table",()=>assert.equal(/grant\s+update[\s\S]*public\.(?:stations|station_publication_reviews)/i.test(migration),false));
check("migration logical order is review then publish then unpublish with privileges after each",()=>{const r=migration.indexOf("create or replace function public.admin_review_station_publication");const rp=migration.indexOf("grant execute on function public.admin_review_station_publication");const p=migration.indexOf("create or replace function public.admin_publish_station");const pp=migration.indexOf("grant execute on function public.admin_publish_station");const u=migration.indexOf("create or replace function public.admin_unpublish_station");const up=migration.indexOf("grant execute on function public.admin_unpublish_station");assert.ok(r<rp&&rp<p&&p<pp&&pp<u&&u<up)});
check("migration application executes no station or audit DML",()=>{const outsideBodies=migration.replace(/\$\$[\s\S]*?\$\$/g,"");assert.equal(/\b(?:update|insert\s+into|delete\s+from)\s+public\.(?:stations|station_publication_reviews)/i.test(outsideBodies),false)});
check("migration contains no explicit transaction-breaking COMMIT",()=>assert.equal(/\bcommit\b\s*;/i.test(migration),false));
check("eligible remains non-public doctrine",()=>assert.match(doctrine,/eligible.*not public|eligible.*does not make.*public/is));
check("Candidate A future public list behavior is visible",()=>assert.equal(candidateA.expected_public_list_behavior,"visible_after_publication"));
check("Candidate A future map behavior is mapped approximate",()=>{assert.equal(candidateA.expected_location_precision,"approximate");assert.equal(candidateA.expected_map_behavior,"eligible");assert.equal(candidateA.expected_directions_behavior,"coordinate_based");assert.equal(candidateA.expected_verification_label,"Not CNGx verified");assert.equal(candidateA.expected_operational_label,"Operational status unknown")});
check("Candidate B future public list behavior is visible",()=>assert.equal(candidateB.expected_public_list_behavior,"visible_after_publication"));
check("Candidate B future map behavior is text-only unconfirmed",()=>{assert.equal(candidateB.expected_location_precision,"unconfirmed");assert.equal(candidateB.expected_map_behavior,"ineligible");assert.equal(candidateB.expected_directions_behavior,"address_based");assert.equal(candidateB.expected_verification_label,"Not CNGx verified");assert.equal(candidateB.expected_operational_label,"Operational status unknown")});
check("manifest/migration/UI pilot-reference sets cannot silently diverge",()=>{assert.deepEqual(migrationPilotRefs,pilotRefs);assert.match(ui,/pilotManifest\.entries\.map\(entry=>entry\.record_source_reference\)/);assert.equal(/picng-[0-9a-f]+/.test(ui),false)});
check("pilot manifest contains no station/user/reviewer UUID or secrets",()=>{assert.equal(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(manifestText),false);assert.equal(/station_id|user_id|reviewer_id|jwt|token|credential|secret|password/i.test(manifestText),false)});
check("pilot doctrine explicitly documents temporary two-record publication scope",()=>{assert.match(doctrine,/temporary/i);assert.match(doctrine,/exactly two/i)});
check("pilot doctrine keeps unpublish as unrestricted safety rollback",()=>assert.match(doctrine,/unpublish[\s\S]*any published official-directory/i));
check("pilot doctrine defines reversible published to eligible rollback",()=>assert.match(doctrine,/published → eligible/));
check("pilot doctrine rejects verification/live-operation implications",()=>{for(const phrase of ["CNGx verified","currently operational","open now","price confirmed","queue confirmed"])assert.ok(doctrine.includes(phrase))});
check("no bulk publish or publish-all control/path exists",()=>assert.equal(/bulk publish|publish all|publish-all/i.test(ui+"\n"+migration),false));
check("non-test scripts contain no publication RPC or direct published mutation escape hatch",()=>{const files=filesUnder("scripts").filter(p=>!path.basename(p).startsWith("test-")&&/\.(?:mjs|js|ts|tsx)$/.test(p));const source=files.map(read).join("\n");assert.equal(/admin_publish_station|admin_unpublish_station/.test(source),false);assert.equal(/publication_status\s*[:=]\s*["']published["']/.test(source),false)});
check("importer has no publication behavior",()=>{assert.equal(/publication_status/.test(importer),false);assert.equal(/admin_publish_station|admin_unpublish_station/.test(importer),false)});
check("publication remains an individual admin action",()=>{assert.match(ui,/onClick=\{\(\)=>publishStation\(station\)\}/);assert.equal(/\.map\([^)]*=>[^\n]*admin_publish_station/.test(ui),false)});
check("existing publication migrations remain byte-identical",()=>{
  const expected={
    "supabase/migrations/20260924192838_station_publication_foundation.sql":"3d751364b2634348d8c1a9b329f36ef8be0d72c5",
    "supabase/migrations/20260924192910_station_publication_admin_review.sql":"d5ebaa64379da1736a8a0d240f34d11c6c807005",
    "supabase/migrations/20260925133006_station_publication_same_state_guard.sql":"544914397e33e09c469aad7acd428870cb388d92",
    "supabase/migrations/20260925143953_public_discovery_visibility_cutover.sql":"9ab6f8a4377a86ac7a96f165d4b1e0b93ee81a00"
  };
  for(const [p,sha] of Object.entries(expected))assert.equal(gitBlobSha(p),sha,p);
});
check("all existing test gates remain wired into prebuild",()=>{for(const script of ["test:publication-pilot","test:public-discovery","test:publication-workflow","test:publication-manifest","test:directory-import","validate:directory-import"])assert.ok(pkg.scripts.prebuild.includes(script),script)});
check("build scripts do not apply migrations or publish stations",()=>assert.equal(/apply[_:-]?migration|supabase\s+db\s+push|admin_publish_station|admin_unpublish_station/i.test(Object.values(pkg.scripts).join(" ")),false));

console.log(`Controlled publication pilot suite passed: ${passed} checks.`);
