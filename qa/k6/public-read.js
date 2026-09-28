import http from "k6/http";import {check} from "k6";import {budgets,profiles} from "./config.js";
const profile=__ENV.K6_PROFILE||"smoke";if(!profiles[profile])throw new Error("Unknown K6_PROFILE");
export const options={...profiles[profile],thresholds:budgets};
const base=__ENV.QA_BASE_URL;if(!base)throw new Error("QA_BASE_URL required; production is not an approved target");
if(/gaslink-orcin\.vercel\.app|cngx\.earthoc\.com/i.test(base)&&__ENV.ALLOW_PRODUCTION_LOAD!=="I_UNDERSTAND_THIS_IS_PROHIBITED")throw new Error("Production load testing is blocked");
export default function(){for(const path of ["/","/stations","/marketplace","/services","/business","/api/health/live"]){const r=http.get(base+path);check(r,{[path+" <500"]:(x)=>x.status<500})}}
