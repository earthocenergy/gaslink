#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
async function importTsModule(source){
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2020}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

const projectionSource=read("lib/nigeria-map-projection.ts");
const visibilitySource=read("lib/station-public-visibility.ts");
const stationsPage=read("app/stations/page.tsx");
const css=read("app/globals.css");
const projection=await importTsModule(projectionSource);
const visibility=await importTsModule(visibilitySource);
const {NIGERIA_OVERVIEW_BOUNDS,projectNigeriaCoordinate}=projection;
const {isPubliclyDiscoverableStation,isMapEligibleStation,publicStationDirections}=visibility;

let passed=0;
function check(label,fn){fn();passed++;console.log(`PASS MAP ${passed}: ${label}`);}
function close(actual,expected,tolerance=0.001){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} not within ${tolerance} of ${expected}`);}

check("Nigeria visualization bounds are explicit and documented",()=>assert.deepEqual(NIGERIA_OVERVIEW_BOUNDS,{westLongitude:2.5,eastLongitude:14.8,southLatitude:4,northLatitude:14}));
check("Candidate A projects from its stored coordinate",()=>{const p=projectNigeriaCoordinate(6.27893238488379,5.63317010586543);assert.ok(p);close(p.xPercent,25.47292769);close(p.yPercent,77.42902483)});
check("Candidate A is placed in the southern/southwestern overview",()=>{const p=projectNigeriaCoordinate(6.27893238488379,5.63317010586543);assert.ok(p&&p.xPercent<35&&p.yPercent>65)});
check("Candidate A projection is not the historical fixed p1 top position",()=>{const p=projectNigeriaCoordinate(6.27893238488379,5.63317010586543);assert.ok(p&&Math.abs(p.yPercent-29)>30)});

const fixtures={
 Lagos:{lat:6.5244,lon:3.3792},
 Benin:{lat:6.3350,lon:5.6037},
 Abuja:{lat:9.0765,lon:7.3986},
 Kano:{lat:12.0022,lon:8.5920},
};
const projected=Object.fromEntries(Object.entries(fixtures).map(([name,c])=>[name,projectNigeriaCoordinate(c.lat,c.lon)]));
check("Lagos fixture is projectable",()=>assert.ok(projected.Lagos));
check("Benin fixture is projectable",()=>assert.ok(projected.Benin));
check("Abuja fixture is projectable",()=>assert.ok(projected.Abuja));
check("Kano fixture is projectable",()=>assert.ok(projected.Kano));
check("different coordinates produce different positions",()=>assert.equal(new Set(Object.values(projected).map(p=>`${p.xPercent.toFixed(4)},${p.yPercent.toFixed(4)}`)).size,4));
check("northern coordinates plot above southern coordinates",()=>assert.ok(projected.Kano.yPercent<projected.Abuja.yPercent&&projected.Abuja.yPercent<projected.Benin.yPercent));
check("eastern coordinates plot right of western coordinates",()=>assert.ok(projected.Kano.xPercent>projected.Abuja.xPercent&&projected.Benin.xPercent>projected.Lagos.xPercent));
check("list ordering cannot alter geographic projection",()=>{const a=Object.entries(fixtures).map(([name,c])=>[name,projectNigeriaCoordinate(c.lat,c.lon)]);const b=[...Object.entries(fixtures)].reverse().map(([name,c])=>[name,projectNigeriaCoordinate(c.lat,c.lon)]);assert.deepEqual(Object.fromEntries(a),Object.fromEntries(b))});
check("filtering cannot alter a station projection",()=>{const all=Object.entries(fixtures).map(([name,c])=>({name,p:projectNigeriaCoordinate(c.lat,c.lon)}));const filtered=all.filter(x=>x.name==="Benin");assert.deepEqual(filtered[0].p,projectNigeriaCoordinate(fixtures.Benin.lat,fixtures.Benin.lon))});

check("null latitude yields no projection",()=>assert.equal(projectNigeriaCoordinate(null,5.6),null));
check("null longitude yields no projection",()=>assert.equal(projectNigeriaCoordinate(6.3,null),null));
check("NaN coordinates yield no projection",()=>{assert.equal(projectNigeriaCoordinate(Number.NaN,5.6),null);assert.equal(projectNigeriaCoordinate(6.3,Number.NaN),null)});
check("invalid global latitude yields no projection",()=>assert.equal(projectNigeriaCoordinate(91,5.6),null));
check("invalid global longitude yields no projection",()=>assert.equal(projectNigeriaCoordinate(6.3,181),null));
check("valid global coordinate outside Nigeria bounds yields no projection",()=>assert.equal(projectNigeriaCoordinate(5.6037,-0.1870),null));
check("outside-Nigeria coordinates are not edge clamped",()=>assert.equal(projectNigeriaCoordinate(6.5,2.0),null));

const base={record_source_type:"official_directory",publication_status:"published",registration_status:"pending",latitude:6.3,longitude:5.6,location:{},location_precision:"approximate",address:"Benin City"};
check("unconfirmed public record receives no map eligibility",()=>assert.equal(isMapEligibleStation({...base,location_precision:"unconfirmed"}),false));
check("published approximate record with complete coordinates is map eligible",()=>assert.equal(isMapEligibleStation(base),true));
check("published exact record with complete coordinates is map eligible",()=>assert.equal(isMapEligibleStation({...base,location_precision:"exact"}),true));
check("eligible but unpublished official-directory record is not public",()=>{const row={...base,publication_status:"eligible"};assert.equal(isPubliclyDiscoverableStation(row),false);assert.equal(isMapEligibleStation(row),false)});
check("published unconfirmed official-directory record is public text/list but has no pin",()=>{const row={...base,location_precision:"unconfirmed"};assert.equal(isPubliclyDiscoverableStation(row),true);assert.equal(isMapEligibleStation(row),false)});
check("trusted coordinates preserve coordinate Directions",()=>{const result=publicStationDirections(base);assert.equal(result.mode,"coordinates");assert.equal(result.label,"Directions")});
check("unconfirmed coordinates preserve Directions by address",()=>{const result=publicStationDirections({...base,latitude:null,longitude:null,location:null,location_precision:"unconfirmed"});assert.equal(result.mode,"address");assert.equal(result.label,"Directions by address")});

check("stations page imports reusable projection helper",()=>assert.match(stationsPage,/projectNigeriaCoordinate/));
check("pin left/top are derived from projection percentages",()=>assert.match(stationsPage,/style=\{\{left:`\$\{projection\.xPercent\}%`,top:`\$\{projection\.yPercent\}%`\}\}/));
check("stations page has no index-position p1 p2 p3 mechanism",()=>{assert.doesNotMatch(stationsPage,/mapPin p/);assert.doesNotMatch(stationsPage,/p\$\{(?:i|index)\+1\}/)});
check("stations page has no fixed three-pin slice cap",()=>assert.doesNotMatch(stationsPage,/slice\(0\s*,\s*3\)/));
check("map CSS has no p1 p2 p3 geographic placement rules",()=>{assert.doesNotMatch(css,/\.mapPin\.p[123]\s*\{/);assert.doesNotMatch(css,/\.mapPin[^\{]*:nth-(?:child|of-type)[^\{]*\{[^}]*\b(?:left|top)\s*:/s)});
check("old obstructing map overlay is removed",()=>{assert.doesNotMatch(stationsPage,/mapOverlay/);assert.doesNotMatch(css,/\.mapOverlay/);assert.match(stationsPage,/mapHeader/);assert.match(stationsPage,/mapPlot/);assert.match(stationsPage,/mapCaption/)});
check("all projectable map items render without silent fixed marker cap",()=>{assert.match(stationsPage,/mapPins\.map/);assert.doesNotMatch(stationsPage,/mapPins\.slice/)});
check("approximate and exact marker treatments are distinct",()=>{assert.match(stationsPage,/mapPinApproximate/);assert.match(stationsPage,/mapPinExact/);assert.match(css,/\.mapPinApproximate/);assert.match(css,/\.mapPinExact/)});
check("pin accessibility derives station name and precision",()=>assert.match(stationsPage,/aria-label=\{`\$\{station\.name\} — \$\{precisionLabel\}`\}/));
check("overview states trusted-coordinate and navigation limits",()=>{assert.match(stationsPage,/Pins are positioned from stored trusted coordinates/);assert.match(stationsPage,/not turn-by-turn navigation/);assert.match(stationsPage,/Unconfirmed locations do not receive map pins/)});
check("out-of-bounds trusted coordinates are intentionally not plotted",()=>{assert.match(stationsPage,/outsideOverviewCount/);assert.match(stationsPage,/outside the current Nigeria overview bounds/)});
check("map integrity fix adds no external mapping provider or token",()=>assert.doesNotMatch(projectionSource+stationsPage,/Mapbox|Google Maps JS|Google Maps Embed|MapTiler|Leaflet|OpenStreetMap|access[_-]?token/i));

console.log(`Station map coordinate-integrity suite passed: ${passed} checks.`);
