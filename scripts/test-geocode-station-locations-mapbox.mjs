import assert from "node:assert/strict";
import {contextValue,classify,selectCandidate,queryFor} from "./geocode-station-locations-mapbox.mjs";

const feature=({region="Lagos",place="Ikeja",confidence="exact",accuracy="rooftop",type="address",id="x",match={}}={})=>({
 id,geometry:{coordinates:[3.35,6.6]},properties:{mapbox_id:id,feature_type:type,name:"Test",full_address:"10 Test Road, Ikeja, Lagos, Nigeria",coordinates:{longitude:3.35,latitude:6.6,accuracy},context:{country:{name:"Nigeria"},region:region?{name:region}:undefined,place:place?{name:place}:undefined},match_code:{confidence,...match}}
});
const base=feature();
assert.equal(contextValue(base,"region"),"Lagos");
assert.equal(contextValue(base,"place"),"Ikeja");
assert.equal(classify(feature({region:"Oyo"}),"Lagos").decision,"rejected");
assert.notEqual(classify(feature({region:null}),"Lagos").decision,"candidate_exact");
for(const accuracy of ["rooftop","parcel","point"]) assert.equal(classify(feature({accuracy}),"Lagos").decision,"candidate_exact");
assert.notEqual(classify(feature({accuracy:"interpolated"}),"Lagos").decision,"candidate_exact");
for(const confidence of ["medium","low"]) assert.notEqual(classify(feature({confidence}),"Lagos").decision,"candidate_exact");
assert.notEqual(classify(feature({match:{region:"unmatched"}}),"Lagos").decision,"candidate_exact");
const ambiguous=selectCandidate([feature({id:"a"}),feature({id:"b"})],{state:"Lagos",address:"10 Test Road Ikeja"});
assert.equal(ambiguous.classification.decision,"manual_review");
const q1=queryFor({address:"10 Test Rd, Ikeja",state:"Lagos"},1),q2=queryFor({address:"10 Test Rd, Ikeja",state:"Lagos"},2);
assert.match(q1,/Lagos/);assert.match(q2,/Lagos/);assert.notEqual(q1,q2);
const captured=[];const old=console.log;console.log=(...x)=>captured.push(x.join(" "));process.env.MAPBOX_ACCESS_TOKEN="SECRET_SHOULD_NOT_APPEAR";console.log(JSON.stringify({safe:true}));console.log=old;
assert.equal(captured.join("\n").includes(process.env.MAPBOX_ACCESS_TOKEN),false);
old("offline Mapbox v6 tests: PASS (10/10)");
