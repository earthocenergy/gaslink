import {getReleaseMetadata} from "./release";
type Level="info"|"warn"|"error";
const BLOCKED=/password|token|cookie|authorization|otp|totp|secret|private.?key|form.?text|message|latitude|longitude/i;
function sanitize(value:unknown):unknown{
 if(Array.isArray(value))return value.map(sanitize);
 if(value&&typeof value==="object"){const out:Record<string,unknown>={};for(const [k,v] of Object.entries(value as Record<string,unknown>))out[k]=BLOCKED.test(k)?"[REDACTED]":sanitize(v);return out;}
 return value;
}
export function serverLog(level:Level,event:string,fields:Record<string,unknown>={}){
 const record={timestamp:new Date().toISOString(),level,event,...getReleaseMetadata(),...(sanitize(fields) as Record<string,unknown>)};
 const line=JSON.stringify(record); if(level==="error")console.error(line);else if(level==="warn")console.warn(line);else console.info(line);
}
