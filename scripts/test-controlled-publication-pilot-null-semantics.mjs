#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const migration=read("supabase/migrations/20260925165500_controlled_publication_publish_unpublish.sql");
const ui=read("app/admin/stations/publication/page.tsx");
const manifest=JSON.parse(read("data/enrichment/cngx-publication-pilot-2026-09-25.json"));

const publishStart=migration.indexOf("create or replace function public.admin_publish_station");
const unpublishStart=migration.indexOf("create or replace function public.admin_unpublish_station");
assert.ok(publishStart>=0&&unpublishStart>publishStart);
const publish=migration.slice(publishStart,unpublishStart);
const unpublish=migration.slice(unpublishStart);
const pilotRefs=manifest.entries.map(x=>x.record_source_reference).sort();
const migrationPilotRefs=[...new Set([...publish.matchAll(/'(picng-[0-9a-f]+)'/g)].map(m=>m[1]))].sort();
const lockIndex=publish.indexOf("for update;");
const nullGuardIndex=publish.indexOf("if v_record_source_reference is null then");
const allowlistGuardIndex=publish.indexOf("if v_record_source_reference not in");
const updateIndex=publish.indexOf("update public.stations");
const auditIndex=publish.indexOf("insert into public.station_publication_reviews");
const isAuthorized=value=>value!==null&&pilotRefs.includes(value);

let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS NULL ${passed}: ${label}`);}

check("pilot A exact reference is authorized",()=>assert.equal(isAuthorized("picng-7acdd2023622ddc15506e499"),true));
check("pilot B exact reference is authorized",()=>assert.equal(isAuthorized("picng-8156d44c6cd771ead33e9f0d"),true));
check("third non-pilot reference is rejected",()=>assert.equal(isAuthorized("picng-nonpilot-eligible-test"),false));
check("NULL record_source_reference is explicitly rejected in SQL",()=>{assert.ok(nullGuardIndex>=0);assert.match(publish,/if v_record_source_reference is null then[\s\S]*Station is not authorized for the controlled publication pilot\./);assert.equal(isAuthorized(null),false)});
check("empty record_source_reference is rejected by allowlist",()=>{assert.equal(isAuthorized(""),false);assert.ok(allowlistGuardIndex>=0)});
check("whitespace and other non-matching references are rejected",()=>{assert.equal(isAuthorized("   "),false);assert.equal(isAuthorized("picng-not-authorized"),false)});
check("NULL rejection occurs after locked target load and before station UPDATE",()=>assert.ok(lockIndex>=0&&lockIndex<nullGuardIndex&&nullGuardIndex<updateIndex));
check("NULL rejection occurs before audit INSERT",()=>assert.ok(nullGuardIndex>=0&&nullGuardIndex<auditIndex));
check("UI treats null source reference as non-pilot",()=>assert.match(ui,/function isControlledPilot\(row:Pick<StationRow,"record_source_reference">\)\{return row\.record_source_reference!==null&&PILOT_SOURCE_REFERENCES\.has\(row\.record_source_reference\);\}/));
check("manifest migration and UI retain exact two-reference equivalence",()=>{assert.equal(pilotRefs.length,2);assert.deepEqual(migrationPilotRefs,pilotRefs);assert.match(ui,/pilotManifest\.entries\.map\(entry=>entry\.record_source_reference\)/);assert.equal(/picng-[0-9a-f]+/.test(ui),false)});
check("Unpublish remains unrestricted by pilot allowlist",()=>{assert.equal(/picng-[0-9a-f]+/.test(unpublish),false);assert.match(unpublish,/if v_previous_status <> 'published'/)});
check("null-semantics hardening introduces no automatic production mutation path",()=>{const outsideBodies=migration.replace(/\$\$[\s\S]*?\$\$/g,"");assert.equal(/\b(?:update|insert\s+into|delete\s+from)\s+public\.(?:stations|station_publication_reviews)/i.test(outsideBodies),false);assert.equal(/from\("stations"\)\.(?:insert|update|delete)/.test(ui),false)});

console.log(`Controlled publication pilot null-semantics suite passed: ${passed} checks.`);
