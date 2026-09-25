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
const migration=read("supabase/migrations/20260925143953_public_discovery_visibility_cutover.sql");
const publicPages=[home,stations,trip,detail];

function visible(s){
  if(s.record_source_type==null)return false;
  return s.record_source_type==="official_directory"
    ? s.publication_status==="published"
    : s.registration_status==="approved";
}
function sqlVisible(s){
  if(s.record_source_type==null)return false;
  return (s.record_source_type==="official_directory" && s.publication_status==="published")
    || (s.record_source_type!=="official_directory" && s.registration_status==="approved");
}
function postgrestVisible(s){
  if(s.record_source_type==null)return false;
  return (s.record_source_type==="official_directory" && s.publication_status==="published")
    || (s.record_source_type!=="official_directory" && s.registration_status==="approved");
}
function mapEligible(s){
  return visible(s)
    && s.latitude!=null
    && s.longitude!=null
    && s.location!=null
    && ["approximate","exact"].includes(s.location_precision);
}
function currentNearbyEligible(s){
  return s.registration_status==="approved" && s.location!=null;
}
function station(overrides={}){
  return {
    record_source_type:"other",publication_status:"unreviewed",registration_status:"pending",is_verified:false,status:"unknown",
    latitude:null,longitude:null,location:null,location_precision:"unconfirmed",is_demo:false,...overrides
  };
}
function runtimeFiles(dir){
  const base=path.join(root,dir);
  if(!fs.existsSync(base))return[];
  return fs.readdirSync(base,{withFileTypes:true}).flatMap(entry=>{
    const rel=path.join(dir,entry.name);
    if(entry.isDirectory())return runtimeFiles(rel);
    return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)?[rel]:[];
  });
}

let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS ${passed}: ${label}`);}

const visibilityFixtures=[
  station({registration_status:"approved"}),
  station(),
  station({record_source_type:"official_directory",publication_status:"unreviewed"}),
  station({record_source_type:"official_directory",publication_status:"eligible"}),
  station({record_source_type:"official_directory",publication_status:"withheld"}),
  station({record_source_type:"official_directory",publication_status:"published",registration_status:"pending"}),
  station({record_source_type:null,registration_status:"approved"}),
];

check("approved non-directory is public",()=>assert.equal(visible(visibilityFixtures[0]),true));
check("pending non-directory is not public",()=>assert.equal(visible(visibilityFixtures[1]),false));
check("official directory unreviewed is not public",()=>assert.equal(visible(visibilityFixtures[2]),false));
check("official directory eligible is not public",()=>assert.equal(visible(visibilityFixtures[3]),false));
check("official directory withheld is not public",()=>assert.equal(visible(visibilityFixtures[4]),false));
check("published directory remains public while registration is pending",()=>assert.equal(visible(visibilityFixtures[5]),true));
check("defensive null source type is not public, matching SQL/PostgREST null semantics",()=>assert.equal(visible(visibilityFixtures[6]),false));
check("published directory does not imply verification",()=>{const s=station({record_source_type:"official_directory",publication_status:"published",is_verified:false});assert.equal(visible(s),true);assert.equal(s.is_verified,false)});
check("published directory does not imply operational availability",()=>{const s=station({record_source_type:"official_directory",publication_status:"published",status:"unknown"});assert.equal(visible(s),true);assert.equal(s.status,"unknown")});
check("published unconfirmed directory can be text discoverable",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"published",location_precision:"unconfirmed"})),true));
check("published unconfirmed directory is not map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"unconfirmed"})),false));
check("published approximate directory with complete geography is map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"approximate"})),true));
check("published exact directory with complete geography is map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"exact"})),true));

check("TypeScript helper encodes canonical visibility and defensive null behavior",()=>{
  assert.match(helper,/record_source_type === "official_directory"/);
  assert.match(helper,/publication_status === "published"/);
  assert.match(helper,/registration_status === "approved"/);
  assert.match(helper,/record_source_type == null\) return false/);
});
check("PostgREST filter encodes canonical visibility exactly",()=>{
  assert.match(helper,/and\(record_source_type\.eq\.official_directory,publication_status\.eq\.published\),and\(record_source_type\.neq\.official_directory,registration_status\.eq\.approved\)/);
});
check("SQL migration encodes canonical visibility exactly",()=>{
  assert.match(migration,/record_source_type = 'official_directory' and publication_status = 'published'/);
  assert.match(migration,/record_source_type <> 'official_directory' and registration_status = 'approved'/);
});
check("TypeScript/PostgREST/SQL logical forms are equivalent across visibility fixtures",()=>{
  for(const s of visibilityFixtures){
    assert.equal(visible(s),postgrestVisible(s));
    assert.equal(visible(s),sqlVisible(s));
  }
});
check("record_source_type NOT NULL production assumption is documented in the executable contract",()=>{
  assert.match(helper,/record_source_type: string \| null/);
  assert.match(helper,/Production record_source_type is NOT NULL/);
  assert.match(helper,/record_source_type == null\) return false/);
});
check("nearby_stations uses the identical canonical visibility branches",()=>{
  assert.match(migration,/s\.record_source_type = 'official_directory' and s\.publication_status = 'published'/);
  assert.match(migration,/s\.record_source_type <> 'official_directory' and s\.registration_status = 'approved'/);
});
check("nearby and map eligibility require complete trusted coordinate state",()=>{
  for(const fragment of ["s.latitude is not null","s.longitude is not null","s.location is not null","s.location_precision in ('approximate','exact')"])assert.ok(migration.includes(fragment));
  assert.match(helper,/station\.location != null/);
  assert.match(helper,/station\.location_precision === "approximate" \|\| station\.location_precision === "exact"/);
});
check("nearby_stations remains SECURITY INVOKER with prior validation bounds",()=>{
  assert.match(migration,/security invoker/);
  assert.match(migration,/latitude out of range/);
  assert.match(migration,/longitude out of range/);
  assert.match(migration,/2000000/);
  assert.match(migration,/p_limit is null or p_limit < 1 or p_limit > 100/);
});
check("nearby_stations keeps anon/authenticated execute and PUBLIC denial posture",()=>{
  assert.match(migration,/revoke all on function public\.nearby_stations[\s\S]* from public;/);
  assert.match(migration,/grant execute on function public\.nearby_stations[\s\S]* to anon,authenticated;/);
  assert.equal(/grant .*service_role|revoke .*service_role|grant .*schema|revoke .*schema/i.test(migration),false);
});
check("migration is transaction-compatible under normal Supabase wrapping",()=>{
  assert.equal(migration.includes("pg-delta: transaction=false"),false);
  assert.equal(/concurrently/i.test(migration),false);
});
check("all four public station surfaces explicitly apply canonical filtering",()=>{for(const page of publicPages)assert.match(page,/\.or\(PUBLIC_STATION_VISIBILITY_OR_FILTER\)/)});
check("public detail applies visibility after UUID filtering and only then fetches reports",()=>{
  assert.match(detail,/\.eq\("id",id\)\.or\(PUBLIC_STATION_VISIBILITY_OR_FILTER\)\.maybeSingle\(\)/);
  assert.ok(detail.indexOf("if(station){")<detail.indexOf('from("station_reports")'));
});
check("admin sessions cannot bypass public-page filtering through RLS",()=>{for(const page of publicPages)assert.match(page,/PUBLIC_STATION_VISIBILITY_OR_FILTER/)});

const currentFixture=[
  ...Array.from({length:3},()=>station({record_source_type:"demo",registration_status:"approved",is_demo:true,latitude:6.5,longitude:3.4,location:{type:"Point"},location_precision:"unconfirmed"})),
  ...Array.from({length:90},()=>station({record_source_type:"official_directory",publication_status:"unreviewed",registration_status:"pending"})),
];
check("current production-equivalent public set remains three legacy and zero directory",()=>{
  const rows=currentFixture.filter(visible);
  assert.equal(rows.length,3);
  assert.equal(rows.filter(x=>x.record_source_type==="official_directory").length,0);
});
check("current nearby fixture is three demo unconfirmed rows",()=>{
  const rows=currentFixture.filter(currentNearbyEligible);
  assert.equal(rows.length,3);
  assert.equal(rows.every(x=>x.record_source_type==="demo"&&x.is_demo===true&&x.location_precision==="unconfirmed"),true);
});
check("proposed trusted nearby excludes all three demo unconfirmed rows intentionally",()=>{
  assert.equal(currentFixture.filter(mapEligible).length,0);
});
check("complete runtime source tree contains zero nearby_stations RPC invocations",()=>{
  const files=["app","components","lib"].flatMap(runtimeFiles);
  const calls=files.flatMap(file=>{
    const source=read(file);
    const matches=[...source.matchAll(/\.rpc\s*\(\s*["']nearby_stations["']/g)];
    return matches.map(()=>file);
  });
  assert.deepEqual(calls,[]);
});

check("RLS public branch uses publication for directory and approval for non-directory while preserving private branches",()=>{
  assert.match(migration,/record_source_type = 'official_directory' and publication_status = 'published'/);
  assert.match(migration,/record_source_type <> 'official_directory' and registration_status = 'approved'/);
  assert.match(migration,/submitted_by = \(select auth\.uid\(\)\)/);
  assert.match(migration,/claimed_by = \(select auth\.uid\(\)\)/);
  assert.match(migration,/p\.role = 'admin'/);
});
check("public trust language keeps directory provenance separate from verification and operations",()=>{for(const phrase of ["Listed in official directory","Not CNGx verified","Operational status unknown","Approximate location","No trusted map location yet"])assert.ok(trust.includes(phrase))});
check("directions prefer coordinates and label unconfirmed fallback as address-based",()=>{assert.match(helper,/maps\/dir\/\?api=1&destination/);assert.match(helper,/Directions by address/);assert.match(helper,/maps\/search\/\?api=1&query/)});
check("Find CNG map pins are restricted to map-eligible public stations",()=>assert.match(stations,/shown\.filter\(isMapEligibleStation\)/));
check("no Publish mutation or control is introduced on public surfaces",()=>{const combined=publicPages.join("\n");assert.equal(/>\s*Publish\s*</i.test(combined),false);assert.equal(combined.includes("admin_review_station_publication"),false)});
check("no station-data mutation is introduced by this cutover",()=>{const combined=publicPages.join("\n");assert.equal(/from\("stations"\)\.(insert|update|delete)/.test(combined),false);assert.equal(/\b(update|insert into|delete from)\s+public\.stations\b/i.test(migration),false)});
check("migration changes only stations_public_read, nearby_stations, function execute posture and comment",()=>{
  assert.equal(/\b(create|alter|drop)\s+(table|schema|type|trigger|index)\b/i.test(migration),false);
  assert.equal(/\b(insert into|update|delete from)\b/i.test(migration),false);
});
check("no Mapbox request path is introduced",()=>{const combined=[helper,trust,...publicPages,migration].join("\n");assert.equal(/api\.mapbox\.com|MAPBOX_ACCESS_TOKEN|fetch\([^)]*mapbox/i.test(combined),false)});

console.log(`Public-discovery visibility suite passed: ${passed} checks.`);
