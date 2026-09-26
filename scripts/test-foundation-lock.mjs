import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const proxy=read("proxy.ts");
const config=read("next.config.ts");
const rpc=read("docs/rpc-surface-review.md");
const requiredProxy=["/admin/:path*","auth.getUser()","profile?.role !== \"admin\"","ADMIN_MFA_ENFORCEMENT","aal2","/admin/security"];
for(const token of requiredProxy) if(!proxy.includes(token)) throw new Error(`Admin protection missing: ${token}`);

for(const header of ["Content-Security-Policy","X-Content-Type-Options","Referrer-Policy","Permissions-Policy","X-Frame-Options","Strict-Transport-Security"]){
  if(!config.includes(header)) throw new Error(`Security header missing: ${header}`);
}
for(const directive of ["frame-ancestors 'none'","object-src 'none'","connect-src 'self' https://*.supabase.co wss://*.supabase.co"]){
  if(!config.includes(directive)) throw new Error(`CSP directive missing: ${directive}`);
}
if(!rpc.includes("approve_station_registration(uuid,boolean)`) | obsolete/overlapping")) throw new Error("RPC overlap classification missing");

const scanFiles=[".env.example","next.config.ts","proxy.ts","lib/supabase/client.ts"];
const forbidden=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/SUPABASE_SERVICE_ROLE(?:_KEY)?\s*=\s*[^\s]+/i,/sb_secret_[A-Za-z0-9_-]{20,}/];
for(const file of scanFiles){const text=read(file);for(const pattern of forbidden)if(pattern.test(text))throw new Error(`Potential secret in ${file}: ${pattern}`)}
console.log("Foundation lock static checks OK");
