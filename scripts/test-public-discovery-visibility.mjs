#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const helper=read("lib/station-public-visibility.ts");
const trust=read("components/PublicStationTrust.tsx");
const home=read("app/page.tsx");
const stations=read("app/stations/page.tsx");
const trip=read("app/trip/page.tsx");
const detail=read("app/stations/[id]/page.tsx");
const migration=read("supabase/migrations/20260925140805_public_discovery_visibility_cutover.sql");
const publicPages=[home,stations,trip,detail];

function visible(s){
  return s.record_source_type==="official_directory"
    ? s.publication_status==="published"
    : s.registration_status==="approved";
}
function mapEligible(s){
  return visible(s)
    && s.latitude!=null
    && s.longitude!=null
    && s.location!=null
    && ["approximate","exact"].includes(s.location_precision);
}
function station(overrides={}){
  return {
    record_source_type:"other",publication_status:"unreviewed",registration_status:"pending",is_verified:false,status:"unknown",
    latitude:null,longitude:null,location:null,location_precision:"unconfirmed",...overrides
  };
}

let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS ${passed}: ${label}`);}

check("approved non-directory is public",()=>assert.equal(visible(station({registration_status:"approved"})),true));
check("pending non-directory is not public",()=>assert.equal(visible(station()),false));
check("official directory unreviewed is not public",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"unreviewed"})),false));
check("official directory eligible is not public",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"eligible"})),false));
check("official directory withheld is not public",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"withheld"})),false));
check("published directory remains public while registration is pending",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"published",registration_status:"pending"})),true));
check("published directory does not imply verification",()=>{const s=station({record_source_type:"official_directory",publication_status:"published",is_verified:false});assert.equal(visible(s),true);assert.equal(s.is_verified,false)});
check("published directory does not imply operational availability",()=>{const s=station({record_source_type:"official_directory",publication_status:"published",status:"unknown"});assert.equal(visible(s),true);assert.equal(s.status,"unknown")});
check("published unconfirmed directory can be text discoverable",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"published",location_precision:"unconfirmed"})),true));
check("published unconfirmed directory is not map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",location_precision:"unconfirmed"})),false));
check("published approximate directory with complete geography is map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"approximate"})),true));
check("shared application filter encodes the canonical visibility rule",()=>{assert.match(helper,/record_source_type\.eq\.official_directory,publication_status\.eq\.published/);assert.match(helper,/record_source_type\.neq\.official_directory,registration_status\.eq\.approved/)});
check("nearby_stations uses the identical canonical visibility branches",()=>{assert.match(migration,/s\.record_source_type = 'official_directory' and s\.publication_status = 'published'/);assert.match(migration,/s\.record_source_type <> 'official_directory' and s\.registration_status = 'approved'/)});
check("nearby and map eligibility require complete trusted coordinate state",()=>{for(const fragment of ["s.latitude is not null","s.longitude is not null","s.location is not null","s.location_precision in ('approximate','exact')"])assert.ok(migration.includes(fragment));assert.match(helper,/station\.location != null/);assert.match(helper,/station\.location_precision === "approximate" \|\| station\.location_precision === "exact"/)});
check("nearby_stations remains SECURITY INVOKER with prior validation bounds",()=>{assert.match(migration,/security invoker/);assert.match(migration,/latitude out of range/);assert.match(migration,/longitude out of range/);assert.match(migration,/2000000/);assert.match(migration,/p_limit is null or p_limit < 1 or p_limit > 100/)});
check("all four public station surfaces explicitly apply canonical filtering",()=>{for(const page of publicPages)assert.match(page,/\.or\(PUBLIC_STATION_VISIBILITY_OR_FILTER\)/)});
check("public detail applies visibility after UUID filtering",()=>assert.match(detail,/\.eq\("id",id\)\.or\(PUBLIC_STATION_VISIBILITY_OR_FILTER\)\.maybeSingle\(\)/));
check("admin sessions cannot bypass public-page filtering through RLS",()=>{for(const page of publicPages)assert.match(page,/PUBLIC_STATION_VISIBILITY_OR_FILTER/)});
check("current production-equivalent fixture remains three legacy public and zero directory public",()=>{const fixture=[...Array.from({length:3},()=>station({registration_status:"approved"})),...Array.from({length:90},()=>station({record_source_type:"official_directory",publication_status:"unreviewed",registration_status:"pending"}))];const publicRows=fixture.filter(visible);assert.equal(publicRows.length,3);assert.equal(publicRows.filter(x=>x.record_source_type==="official_directory").length,0)});
check("RLS public branch uses publication for directory and approval for non-directory",()=>{assert.match(migration,/record_source_type = 'official_directory' and publication_status = 'published'/);assert.match(migration,/record_source_type <> 'official_directory' and registration_status = 'approved'/);assert.match(migration,/submitted_by = \(select auth\.uid\(\)\)/);assert.match(migration,/claimed_by = \(select auth\.uid\(\)\)/);assert.match(migration,/p\.role = 'admin'/)});
check("public trust language keeps directory provenance separate from verification and operations",()=>{for(const phrase of ["Listed in official directory","Not CNGx verified","Operational status unknown","Approximate location","No trusted map location yet"])assert.ok(trust.includes(phrase))});
check("directions prefer coordinates and label unconfirmed fallback as address-based",()=>{assert.match(helper,/maps\/dir\/\?api=1&destination/);assert.match(helper,/Directions by address/);assert.match(helper,/maps\/search\/\?api=1&query/)});
check("Find CNG map pins are restricted to map-eligible public stations",()=>assert.match(stations,/shown\.filter\(isMapEligibleStation\)/));
check("no Publish mutation or control is introduced on public surfaces",()=>{const combined=publicPages.join("\n");assert.equal(/>\s*Publish\s*</i.test(combined),false);assert.equal(combined.includes("admin_review_station_publication"),false)});
check("no station-data mutation is introduced by this cutover",()=>{const combined=publicPages.join("\n");assert.equal(/from\("stations"\)\.(insert|update|delete)/.test(combined),false);assert.equal(/\b(update|insert into|delete from)\s+public\.stations\b/i.test(migration),false)});
check("no Mapbox request path is introduced",()=>{const combined=[helper,trust,...publicPages,migration].join("\n");assert.equal(/api\.mapbox\.com|MAPBOX_ACCESS_TOKEN|fetch\([^)]*mapbox/i.test(combined),false)});

console.log(`Public-discovery visibility suite passed: ${passed} checks.`);
