import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const dir=path.join(root,"supabase","migrations");
const files=fs.readdirSync(dir).filter(x=>x.endsWith(".sql")).sort();
const timestamped=files.map(file=>({file,match:file.match(/^(\d{14})_(.+)\.sql$/)})).filter(x=>x.match);
const versions=timestamped.map(x=>x.match[1]);
const duplicates=versions.filter((v,i)=>versions.indexOf(v)!==i);
if(duplicates.length) throw new Error(`Duplicate migration versions: ${[...new Set(duplicates)].join(", ")}`);

const ledger=JSON.parse(fs.readFileSync(path.join(root,"docs","production-migration-ledger.json"),"utf8"));
const prod=new Set(ledger.migrations.map(x=>x.version));
const allowedMismatch=new Set((ledger.knownLogicalVersionMismatches||[]).map(x=>x.repository));
const unexpected=timestamped.filter(x=>!prod.has(x.match[1])&&!allowedMismatch.has(x.file));
if(unexpected.length) throw new Error(`Repository migrations absent from recorded production ledger: ${unexpected.map(x=>x.file).join(", ")}`);

const exact=versions.filter(v=>prod.has(v));
const missing=ledger.migrations.filter(x=>!versions.includes(x.version));
if(missing.length!==ledger.missingProductionSourceVersionCount){
  throw new Error(`Ledger missing-source count ${ledger.missingProductionSourceVersionCount} != computed ${missing.length}`);
}
if(ledger.head!==ledger.migrations.at(-1)?.version) throw new Error("Production migration head does not match ledger tail");
console.log(`Migration integrity OK: ${ledger.migrations.length} production, ${files.length} repository files, ${exact.length} exact version matches, ${missing.length} production versions without exact repository source.`);
