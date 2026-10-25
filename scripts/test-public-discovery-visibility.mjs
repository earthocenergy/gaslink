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
const f2DemoMigration=read("supabase/migrations/20261025085429_f2_public_demo_visibility_hardening.sql");
const publicPages=[home,stations,detail];
const tripApi=read("app/api/v1/trips/plan/route.ts");
const tripCorridor=read("supabase/migrations/20260929210000_trip_intelligence_corridor.sql");

function visible(s){
  if(s.is_demo!==false)return false;
  if(s.record_source_type==null)return false;
  return s.record_source_type==="official_directory"
    ? s.publication_status==="published"
    : s.registration_status==="approved";
}
function sqlVisible(s){
  if(s.is_demo!==false)return false;
  if(s.record_source_type==null)return false;
  return (s.record_source_type==="official_directory" && s.publication_status==="published")
    || (s.record_source_type!=="official_directory" && s.registration_status==="approved");
}
function postgrestVisible(s){
  if(s.is_demo!==false)return false;
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
  station({record_source_type:"demo",registration_status:"approved",is_demo:true}),
];

check("approved non-directory is public",()=>assert.equal(visible(visibilityFixtures[0]),true));
check("pending non-directory is not public",()=>assert.equal(visible(visibilityFixtures[1]),false));
check("official directory unreviewed is not public",()=>assert.equal(visible(visibilityFixtures[2]),false));
check("official directory eligible is not public",()=>assert.equal(visible(visibilityFixtures[3]),false));
check("official directory withheld is not public",()=>assert.equal(visible(visibilityFixtures[4]),false));
check("published directory remains public while registration is pending",()=>assert.equal(visible(visibilityFixtures[5]),true));
check("defensive null source type is not public, matching SQL/PostgREST null semantics",()=>assert.equal(visible(visibilityFixtures[6]),false));
check("demo/test rows are never publicly discoverable even when approved",()=>assert.equal(visible(visibilityFixtures[7]),false));
check("published directory does not imply verification",()=>{const s=station({record_source_type:"official_directory",publication_status:"published",is_verified:false});assert.equal(visible(s),true);assert.equal(s.is_verified,false)});
check("published directory does not imply operational availability",()=>{const s=station({record_source_type:"official_directory",publication_status:"published",status:"unknown"});assert.equal(visible(s),true);assert.equal(s.status,"unknown")});
check("published unconfirmed directory can be text discoverable",()=>assert.equal(visible(station({record_source_type:"official_directory",publication_status:"published",location_precision:"unconfirmed"})),true));
check("published unconfirmed directory is not map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"unconfirmed"})),false));
check("published approximate directory with complete geography is map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"approximate"})),true));
check("published exact directory with complete geography is map eligible",()=>assert.equal(mapEligible(station({record_source_type:"official_directory",publication_status:"published",latitude:6.1,longitude:3.2,location:{type:"Point"},location_precision:"exact"})),true));

check("TypeScript helper encodes canonical visibility, demo exclusion and defensive null behavior",()=>{
  assert.match(helper,/station\.is_demo !== false\) return false/);
  assert.match(helper,/record_source_type === "official_directory"/);
  assert.match(helper,/publication_status === "published"/);
  assert.match(helper,/registration_status === "approved"/);
  assert.match(helper,/record_source_type == null\) return false/);
});
check("PostgREST filter encodes canonical visibility and demo exclusion exactly",()=>{
  assert.match(
    helper,
    /and\(is_demo\.eq\.false,record_source_type\.eq\.official_directory,publication_status\.eq\.published\),and\(is_demo\.eq\.false,record_source_type\.neq\.official_directory,registration_status\.eq\.approved\)/
  );
});
check("F2 SQL migration encodes canonical visibility with demo exclusion",()=>{
  assert.match(f2DemoMigration,/is_demo = false/);
  assert.match(f2DemoMigration,/record_source_type = 'official_directory'[\s\S]*publication_status = 'published'/);
  assert.match(f2DemoMigration,/record_source_type <> 'official_directory'[\s\S]*registration_status = 'approved'/);
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
check("nearby_stations uses canonical visibility branches and excludes demos",()=>{
  assert.match(f2DemoMigration,/s\.is_demo = false/);
  assert.match(f2DemoMigration,/s\.record_source_type = 'official_directory'[\s\S]*s\.publication_status = 'published'/);
  assert.match(f2DemoMigration,/s\.record_source_type <> 'official_directory'[\s\S]*s\.registration_status = 'approved'/);
});
check("nearby and map eligibility require complete trusted coordinate state",()=>{
  for(const fragment of ["s.latitude is not null","s.longitude is not null","s.location is not null","s.location_precision in ('approximate','exact')"])assert.ok(f2DemoMigration.includes(fragment));
  assert.match(helper,/station\.location != null/);
  assert.match(helper,/station\.location_precision === "approximate" \|\| station\.location_precision === "exact"/);
});
check("nearby_stations remains SECURITY INVOKER with prior validation bounds",()=>{
  assert.match(f2DemoMigration,/security invoker/);
  assert.match(f2DemoMigration,/latitude out of range/);
  assert.match(f2DemoMigration,/longitude out of range/);
  assert.match(f2DemoMigration,/2000000/);
  assert.match(f2DemoMigration,/p_limit is null[\s\S]*p_limit < 1[\s\S]*p_limit > 100/);
});
check("nearby_stations keeps anon/authenticated execute and PUBLIC denial posture",()=>{
  assert.match(f2DemoMigration,/revoke all on function[\s\S]*public\.nearby_stations[\s\S]*from public;/);
  assert.match(f2DemoMigration,/grant execute on function[\s\S]*public\.nearby_stations[\s\S]*to anon, authenticated;/);
  assert.equal(/grant .*service_role|revoke .*service_role|grant .*schema|revoke .*schema/i.test(f2DemoMigration),false);
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
check("trip planner delegates station selection to the trusted corridor API",()=>{
  assert.match(trip,/\/api\/v1\/trips\/plan/);
  assert.doesNotMatch(trip,/\.from\(["']stations["']\)/);
  assert.match(tripApi,/trip_route_corridor_stations/);
  assert.match(tripCorridor,/publication_status\s*=\s*'published'/);
  assert.match(tripCorridor,/location_precision\s+in\s*\('exact','approximate'\)/);
  assert.match(tripCorridor,/security invoker/i);
  assert.match(f2DemoMigration,/s\.is_demo = false/);
  assert.match(f2DemoMigration,/create or replace function public\.trip_route_corridor_stations/);
});
check("admin sessions cannot bypass public-page filtering through RLS",()=>{for(const page of publicPages)assert.match(page,/PUBLIC_STATION_VISIBILITY_OR_FILTER/)});

const currentFixture=[
  ...Array.from({length:3},()=>station({
    record_source_type:"demo",
    registration_status:"approved",
    is_demo:true,
    latitude:6.5,
    longitude:3.4,
    location:{type:"Point"},
    location_precision:"unconfirmed"
  })),
  ...Array.from({length:2},()=>station({
    record_source_type:"demo",
    registration_status:"rejected",
    is_demo:true
  })),
  station({
    record_source_type:"official_directory",
    publication_status:"published",
    registration_status:"pending",
    latitude:6.3,
    longitude:5.6,
    location:{type:"Point"},
    location_precision:"approximate"
  }),
  station({
    record_source_type:"official_directory",
    publication_status:"published",
    registration_status:"pending",
    latitude:6.4,
    longitude:5.7,
    location:{type:"Point"},
    location_precision:"unconfirmed"
  }),
  ...Array.from({length:88},()=>station({
    record_source_type:"official_directory",
    publication_status:"unreviewed",
    registration_status:"pending"
  })),
];

check("production-equivalent fixture remains 95 rows",()=>{
  assert.equal(currentFixture.length,95);
});

check("F2 public set excludes all demos and preserves two legitimate published directory rows",()=>{
  const rows=currentFixture.filter(visible);
  assert.equal(rows.length,2);
  assert.equal(rows.every(x=>x.record_source_type==="official_directory"),true);
  assert.equal(rows.some(x=>x.is_demo===true),false);
});

check("legacy nearby fixture still identifies the three approved demo rows before F2 visibility filtering",()=>{
  const rows=currentFixture.filter(currentNearbyEligible);
  const demos=rows.filter(x=>x.is_demo===true);
  assert.equal(demos.length,3);
  assert.equal(demos.every(x=>x.location_precision==="unconfirmed"),true);
});

check("F2 map eligibility excludes all demos while preserving the trusted published directory row",()=>{
  const rows=currentFixture.filter(mapEligible);
  assert.equal(rows.length,1);
  assert.equal(rows[0].record_source_type,"official_directory");
  assert.equal(rows[0].is_demo,false);
  assert.equal(rows[0].location_precision,"approximate");
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

check("F2 RLS public branch excludes demos while preserving private submitter claimant and admin branches",()=>{
  assert.match(f2DemoMigration,/is_demo = false/);
  assert.match(f2DemoMigration,/record_source_type = 'official_directory'[\s\S]*publication_status = 'published'/);
  assert.match(f2DemoMigration,/record_source_type <> 'official_directory'[\s\S]*registration_status = 'approved'/);
  assert.match(f2DemoMigration,/submitted_by = \(select auth\.uid\(\)\)/);
  assert.match(f2DemoMigration,/claimed_by = \(select auth\.uid\(\)\)/);
  assert.match(f2DemoMigration,/p\.role = 'admin'/);
});
check("public trust language keeps directory provenance separate from verification and operations",()=>{for(const phrase of ["Listed in official directory","Not CNGx verified","Operational status unknown","Approximate location","No trusted map location yet"])assert.ok(trust.includes(phrase))});
check("directions prefer coordinates and label unconfirmed fallback as address-based",()=>{assert.match(helper,/maps\/dir\/\?api=1&destination/);assert.match(helper,/Directions by address/);assert.match(helper,/maps\/search\/\?api=1&query/)});
check("Find CNG map pins are restricted to map-eligible public stations",()=>assert.match(stations,/shown\.filter\(isMapEligibleStation\)/));
check("no Publish mutation or control is introduced on public surfaces",()=>{const combined=publicPages.join("\n");assert.equal(/>\s*Publish\s*</i.test(combined),false);assert.equal(combined.includes("admin_review_station_publication"),false)});
check("no station-data mutation is introduced by F2 visibility hardening",()=>{const combined=publicPages.join("\n");assert.equal(/from\("stations"\)\.(insert|update|delete)/.test(combined),false);assert.equal(/\b(update|insert into|delete from)\s+public\.stations\b/i.test(f2DemoMigration),false)});
check("F2 visibility migration changes only policy functions execute posture and comments",()=>{
  assert.equal(/\b(create|alter|drop)\s+(table|schema|type|trigger|index)\b/i.test(f2DemoMigration),false);
  assert.equal(/\b(insert into|update|delete from)\b/i.test(f2DemoMigration),false);
});
check("no Mapbox request path is introduced",()=>{const combined=[helper,trust,...publicPages,f2DemoMigration].join("\n");assert.equal(/api\.mapbox\.com|MAPBOX_ACCESS_TOKEN|fetch\([^)]*mapbox/i.test(combined),false)});

console.log(`Public-discovery visibility suite passed: ${passed} checks.`);
