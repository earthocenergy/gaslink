#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const foundation=read("supabase/migrations/20260924190100_station_publication_foundation.sql");
const adminMigration=read("supabase/migrations/20260924193000_station_publication_admin_review.sql");
const adminPage=read("app/admin/page.tsx");
const reviewPage=read("app/admin/stations/publication/page.tsx");
const importer=read("scripts/import-station-snapshot.mjs");
const manifest=JSON.parse(read("data/enrichment/picng-publication-review-manifest-2026-09-24.json"));
let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS ${passed}: ${label}`);}

check("foundation migration no longer adds publication_reviewed_by to stations",()=>assert.equal(foundation.includes("publication_reviewed_by"),false));
check("foundation migration no longer adds publication_notes to stations",()=>assert.equal(foundation.includes("publication_notes"),false));
check("publication_status remains on stations",()=>assert.match(foundation,/add column publication_status text not null default 'unreviewed'/));
check("publication_reviewed_at remains on stations",()=>assert.match(foundation,/add column publication_reviewed_at timestamp with time zone/));
check("official-directory registration-status constraint exists",()=>assert.match(foundation,/stations_official_directory_registration_pending_check[\s\S]*record_source_type <> 'official_directory' or registration_status = 'pending'/));
check("all current directory imports are staged pending and the review manifest remains 90 official-directory rows",()=>{assert.match(importer,/registration_status:\s*"pending"/);assert.equal(manifest.records.length,90);assert.equal(manifest.records.every(r=>r.record_source_type==="official_directory"),true)});
check("admin registration RPC rejects official_directory records",()=>assert.match(adminMigration,/Official-directory stations require the publication review workflow/));
check("ordinary submitted-registration behavior remains preserved",()=>{assert.match(adminMigration,/registration_status = 'approved'[\s\S]*is_verified = true[\s\S]*claimed_by = submitted_by[\s\S]*last_verified_at = now\(\)/);assert.match(adminMigration,/insert into public\.user_roles\(user_id, role\)/);assert.match(adminMigration,/registration_status = 'rejected'[\s\S]*is_verified = false/)});
check("publication review audit table has RLS enabled",()=>assert.match(adminMigration,/alter table public\.station_publication_reviews enable row level security/));
check("anon cannot read review audit records by policy design",()=>assert.match(adminMigration,/revoke all on table public\.station_publication_reviews from public, anon, authenticated/));
check("non-admin authenticated users cannot read review history",()=>assert.match(adminMigration,/create policy station_publication_reviews_admin_select[\s\S]*p\.role = 'admin'/));
check("direct authenticated INSERT UPDATE DELETE are not authorized",()=>{assert.match(adminMigration,/revoke all on table public\.station_publication_reviews from public, anon, authenticated/);assert.match(adminMigration,/grant select on table public\.station_publication_reviews to authenticated/)});
const publicationFn=adminMigration.slice(adminMigration.indexOf("create or replace function public.admin_review_station_publication"));
check("publication RPC is admin-only",()=>assert.match(publicationFn,/role = 'admin'/));
check("publication RPC accepts eligible",()=>assert.match(publicationFn,/p_decision not in \('eligible', 'withheld', 'unreviewed'\)/));
check("publication RPC accepts withheld",()=>assert.match(publicationFn,/p_decision = 'withheld'/));
check("publication RPC accepts unreviewed",()=>assert.match(publicationFn,/p_decision = 'unreviewed'/));
check("publication RPC rejects published",()=>assert.equal(/p_decision not in \([^)]*published/.test(publicationFn),false));
check("publication RPC rejects non-directory stations",()=>assert.match(publicationFn,/record_source_type = 'official_directory'[\s\S]*for update/));
check("withheld requires notes",()=>assert.match(publicationFn,/p_decision = 'withheld' and v_notes is null[\s\S]*A reason is required/));
check("review mutation never changes registration_status",()=>assert.equal(/set[\s\S]{0,120}registration_status/.test(publicationFn),false));
check("review mutation never changes is_verified",()=>assert.equal(/set[\s\S]{0,120}is_verified/.test(publicationFn),false));
check("review mutation never changes coordinates or provenance",()=>{for(const key of ["latitude =","longitude =","record_source_type = p","record_source_reference =","location_source_type =","location_source_name ="])assert.equal(publicationFn.includes(key),false)});
check("review mutation never changes operational fields",()=>{for(const key of ["status = 'open'","price_per_scm =","queue_minutes =","open_now =","status_updated_at =","price_updated_at =","queue_updated_at ="])assert.equal(publicationFn.includes(key),false)});
check("audit events are append-only through the workflow",()=>{assert.match(publicationFn,/insert into public\.station_publication_reviews/);assert.equal(/update public\.station_publication_reviews/i.test(adminMigration),false);assert.equal(/delete from public\.station_publication_reviews/i.test(adminMigration),false)});
check("main registration queue excludes official_directory",()=>assert.match(adminPage,/\.neq\("record_source_type","official_directory"\)/));
check("admin publication page has no publish action",()=>{assert.equal(/>Publish</.test(reviewPage),false);assert.equal(reviewPage.includes("Go live"),false);assert.equal(reviewPage.includes("Make public"),false);assert.equal(reviewPage.includes("Approve listing"),false)});
check("pre-migration schema absence is handled without crash",()=>{assert.match(reviewPage,/Publication review schema has not been applied yet\./);assert.match(reviewPage,/schemaUnavailable/)});
check("manifest remains 90 total 4 mapped 86 directory-only all-unreviewed",()=>{assert.deepEqual({total:manifest.summary.total,mapped:manifest.summary.mapped_candidate,directoryOnly:manifest.summary.directory_only_candidate,unreviewed:manifest.summary.unreviewed,eligible:manifest.summary.eligible,published:manifest.summary.published,withheld:manifest.summary.withheld},{total:90,mapped:4,directoryOnly:86,unreviewed:90,eligible:0,published:0,withheld:0})});
check("no secrets or PII are added to generated review artifact",()=>{const forbidden=/email|phone|secret|token|credential|reviewer_id|user_id/i;const walk=v=>{if(Array.isArray(v))return v.forEach(walk);if(v&&typeof v==="object")for(const [k,val] of Object.entries(v)){assert.equal(forbidden.test(k),false,`forbidden artifact key: ${k}`);walk(val)}};walk(manifest)});

console.log(`Publication workflow safety suite passed: ${passed} checks.`);
