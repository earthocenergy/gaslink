"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import {createClient} from "@/lib/supabase/client";
import {BookOpenCheck,MapPin,ShieldCheck} from "lucide-react";

type PublicationStatus="unreviewed"|"eligible"|"published"|"withheld";
type ReviewDecision="unreviewed"|"eligible"|"withheld";
type StationRow={
  id:string;name:string;operator_name:string|null;address:string;city:string|null;state:string|null;
  record_source_type:string;record_source_name:string|null;record_source_reference:string|null;
  latitude:number|null;longitude:number|null;location_precision:string;location_source_type:string|null;location_source_name:string|null;
  publication_status:PublicationStatus;publication_reviewed_at:string|null;is_verified:boolean;status:string;
};
type ReviewRow={previous_status:string;new_status:string;created_at:string;notes:string|null};
const PAGE_SIZE=12;

function isMapped(row:StationRow){return row.latitude!==null&&row.longitude!==null;}
function schemaUnavailable(error:any){
  const message=String(error?.message||"").toLowerCase();
  return error?.code==="42703"||error?.code==="PGRST204"||message.includes("publication_status")||message.includes("schema cache");
}
function publicationActionSchemaUnavailable(error:any){
  const message=String(error?.message||"").toLowerCase();
  return error?.code==="PGRST202"||message.includes("admin_publish_station")||message.includes("admin_unpublish_station")||message.includes("could not find the function")||message.includes("schema cache");
}
function safeDatabaseMessage(error:any,fallback:string){
  return String(error?.message||fallback)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,"[redacted id]")
    .replace(/\beyJ[A-Za-z0-9._-]+/g,"[redacted token]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9._-]+/gi,"[redacted credential]")
    .slice(0,300);
}
function safeHistoryError(error:any){return safeDatabaseMessage(error,"Unable to load review history.");}
function safeReviewError(error:any){
  const message=String(error?.message||"");
  if(message.includes("Station is already in the requested publication state."))return "This station is already in the requested publication state.";
  if(message.includes("Published stations must be unpublished before changing review state."))return "Published stations must be unpublished before changing review state.";
  return safeDatabaseMessage(error,"Unable to update publication review.");
}
function safePublicationActionError(error:any,fallback:string){
  if(publicationActionSchemaUnavailable(error))return "Publication action schema not applied yet.";
  return safeDatabaseMessage(error,fallback);
}
function safeDomId(value:string){return value.replace(/[^A-Za-z0-9_-]/g,"-").replace(/-+/g,"-");}

export default function PublicationReviewPage(){
  const [access,setAccess]=useState<boolean|null>(null);
  const [schemaReady,setSchemaReady]=useState<boolean|null>(null);
  const [rows,setRows]=useState<StationRow[]>([]);
  const [query,setQuery]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const [stateFilter,setStateFilter]=useState("all");
  const [mapFilter,setMapFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [history,setHistory]=useState<ReviewRow[]>([]);
  const [historyError,setHistoryError]=useState("");
  const [historyLoading,setHistoryLoading]=useState(false);
  const [mutatingStationIds,setMutatingStationIds]=useState<Set<string>>(()=>new Set());
  const historyRequestRef=useRef(0);
  const pendingHistoryRef=useRef(new Set<string>());
  const pendingMutationRef=useRef(new Set<string>());

  async function loadQueue(){
    const db=createClient();
    const {data,error:qError}=await db.from("stations").select("id,name,operator_name,address,city,state,record_source_type,record_source_name,record_source_reference,latitude,longitude,location_precision,location_source_type,location_source_name,publication_status,publication_reviewed_at,is_verified,status").eq("record_source_type","official_directory").order("state",{ascending:true}).order("name",{ascending:true});
    if(qError){
      if(schemaUnavailable(qError)){setSchemaReady(false);setRows([]);setError("");return;}
      setSchemaReady(null);setRows([]);setError(qError.message);return;
    }
    setSchemaReady(true);setRows((data||[]) as StationRow[]);setError("");
  }

  async function initialize(){
    const db=createClient();
    const {data:{user}}=await db.auth.getUser();
    if(!user){location.href="/auth";return;}
    const {data:profile}=await db.from("profiles").select("role").eq("id",user.id).single();
    if(profile?.role!=="admin"){setAccess(false);return;}
    setAccess(true);
    await loadQueue();
  }

  useEffect(()=>{void initialize()},[]);
  useEffect(()=>{setPage(1)},[query,statusFilter,stateFilter,mapFilter]);
  useEffect(()=>{
    historyRequestRef.current+=1;
    setSelectedId(null);
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(false);
  },[query,statusFilter,stateFilter,mapFilter,page]);

  const states=useMemo(()=>Array.from(new Set(rows.map(x=>x.state).filter(Boolean) as string[])).sort(),[rows]);
  const summary=useMemo(()=>({
    unreviewed:rows.filter(x=>x.publication_status==="unreviewed").length,
    eligible:rows.filter(x=>x.publication_status==="eligible").length,
    published:rows.filter(x=>x.publication_status==="published").length,
    withheld:rows.filter(x=>x.publication_status==="withheld").length,
    mapped:rows.filter(isMapped).length,
    unmapped:rows.filter(x=>!isMapped(x)).length
  }),[rows]);
  const filtered=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    return rows.filter(row=>{
      const hay=[row.name,row.operator_name,row.address,row.record_source_reference].filter(Boolean).join(" ").toLowerCase();
      const searchOk=!needle||hay.includes(needle);
      const statusOk=statusFilter==="all"||row.publication_status===statusFilter;
      const stateOk=stateFilter==="all"||row.state===stateFilter;
      const mapOk=mapFilter==="all"||(mapFilter==="mapped"?isMapped(row):!isMapped(row));
      return searchOk&&statusOk&&stateOk&&mapOk;
    });
  },[rows,query,statusFilter,stateFilter,mapFilter]);
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);

  async function loadHistory(station:StationRow){
    if(pendingHistoryRef.current.has(station.id))return;
    pendingHistoryRef.current.add(station.id);
    const requestId=++historyRequestRef.current;
    setSelectedId(station.id);
    setHistory([]);
    setHistoryError("");
    setHistoryLoading(true);
    const {data,error:hError}=await createClient().from("station_publication_reviews").select("previous_status,new_status,created_at,notes").eq("station_id",station.id).order("created_at",{ascending:false});
    pendingHistoryRef.current.delete(station.id);
    if(requestId!==historyRequestRef.current)return;
    if(hError){setHistoryError(safeHistoryError(hError));setHistoryLoading(false);return;}
    setHistory((data||[]) as ReviewRow[]);
    setHistoryLoading(false);
  }

  function toggleHistory(station:StationRow){
    if(selectedId===station.id){
      historyRequestRef.current+=1;
      setSelectedId(null);
      setHistory([]);
      setHistoryError("");
      setHistoryLoading(false);
      return;
    }
    void loadHistory(station);
  }

  function beginStationMutation(stationId:string){
    if(pendingMutationRef.current.has(stationId))return false;
    pendingMutationRef.current.add(stationId);
    setMutatingStationIds(previous=>{const next=new Set(previous);next.add(stationId);return next;});
    return true;
  }
  function endStationMutation(stationId:string){
    pendingMutationRef.current.delete(stationId);
    setMutatingStationIds(previous=>{const next=new Set(previous);next.delete(stationId);return next;});
  }

  async function review(station:StationRow,decision:ReviewDecision){
    if(station.publication_status==="published"){
      setError("Published stations must be unpublished before changing review state.");
      return;
    }
    if(station.publication_status===decision||pendingMutationRef.current.has(station.id))return;
    setMessage("");setError("");
    let notes:string|null=null;
    if(decision==="withheld"){
      const supplied=window.prompt("Reason for withholding this directory record (required):","");
      if(supplied===null)return;
      notes=supplied.trim();
      if(!notes){setError("A reason is required when withholding a station.");return;}
    }else if(decision==="eligible"){
      const supplied=window.prompt("Optional review note:","");
      if(supplied===null)return;
      notes=supplied.trim()||null;
    }
    const label=decision==="eligible"?"mark eligible":decision==="withheld"?"withhold":"return to unreviewed";
    if(!window.confirm(`${label} — ${station.name} (${station.record_source_reference||"no source reference"})?`))return;
    if(!beginStationMutation(station.id))return;
    const historyWasOpen=selectedId===station.id;
    try{
      const {error:rError}=await createClient().rpc("admin_review_station_publication",{p_station_id:station.id,p_decision:decision,p_notes:notes});
      if(rError){setError(safeReviewError(rError));return;}
      setMessage(`${station.name}: review status updated to ${decision}.`);
      await loadQueue();
      if(historyWasOpen)await loadHistory({...station,publication_status:decision});
    }finally{
      endStationMutation(station.id);
    }
  }

  async function publishStation(station:StationRow){
    if(station.publication_status!=="eligible"||pendingMutationRef.current.has(station.id))return;
    setMessage("");setError("");
    const supplied=window.prompt("Publication note (required):","");
    if(supplied===null)return;
    const notes=supplied.trim();
    if(!notes){setError("A publication note is required.");return;}
    if(notes.length>2000){setError("Publication notes must be 2000 characters or fewer.");return;}
    const verificationLabel=station.is_verified?"CNGx verification recorded":"Not CNGx verified";
    const operationalLabel=station.status==="unknown"?"Operational status unknown":`Operational status: ${station.status}`;
    const confirmation=window.prompt(
      `Publishing makes this directory record visible in CNGx. It does not verify the station or confirm live operating conditions.\n\nStation: ${station.name}\nSource reference: ${station.record_source_reference||"not stated"}\nLocation precision: ${station.location_precision}\nVerification: ${verificationLabel}\nOperations: ${operationalLabel}\n\nType PUBLISH to confirm:`,
      ""
    );
    if(confirmation!=="PUBLISH"){
      if(confirmation!==null)setError("Publication cancelled. Type PUBLISH exactly to confirm.");
      return;
    }
    if(!beginStationMutation(station.id))return;
    const historyWasOpen=selectedId===station.id;
    try{
      const {error:pError}=await createClient().rpc("admin_publish_station",{p_station_id:station.id,p_notes:notes});
      if(pError){setError(safePublicationActionError(pError,"Unable to publish this directory record."));return;}
      setMessage(`${station.name}: published to CNGx public discovery.`);
      await loadQueue();
      if(historyWasOpen)await loadHistory({...station,publication_status:"published"});
    }finally{
      endStationMutation(station.id);
    }
  }

  async function unpublishStation(station:StationRow){
    if(station.publication_status!=="published"||pendingMutationRef.current.has(station.id))return;
    setMessage("");setError("");
    const supplied=window.prompt("Reason for unpublishing this directory record (required):","");
    if(supplied===null)return;
    const notes=supplied.trim();
    if(!notes){setError("An unpublish reason is required.");return;}
    if(notes.length>2000){setError("Unpublish notes must be 2000 characters or fewer.");return;}
    if(!window.confirm(`Unpublishing removes this directory record from public CNGx discovery and returns it to eligible review state.\n\n${station.name}\n${station.record_source_reference||"No source reference"}\n\nContinue?`))return;
    if(!beginStationMutation(station.id))return;
    const historyWasOpen=selectedId===station.id;
    try{
      const {error:uError}=await createClient().rpc("admin_unpublish_station",{p_station_id:station.id,p_notes:notes});
      if(uError){setError(safePublicationActionError(uError,"Unable to unpublish this directory record."));return;}
      setMessage(`${station.name}: removed from public discovery and returned to eligible review state.`);
      await loadQueue();
      if(historyWasOpen)await loadHistory({...station,publication_status:"eligible"});
    }finally{
      endStationMutation(station.id);
    }
  }

  if(access===null)return <main className="panel">Checking Earthoc Admin access…</main>;
  if(!access)return <main className="panel"><h1>Admin access required</h1><Link href="/" className="primary">Return to CNGx</Link></main>;

  return <main>
    <header><Link href="/admin" className="brand"><span className="mark">x</span><div><b>CNGx</b><small>Publication review</small></div></Link><BackButton fallback="/admin"/></header>
    <section className="adminHero"><div><span className="eyebrow"><BookOpenCheck size={14}/> DIRECTORY GOVERNANCE</span><h1>Official-directory publication review</h1><p>Review Pi-CNG directory records separately from station registration, verification and live operational data.</p></div><Link href="/admin" className="secondary">Admin control centre</Link></section>

    {schemaReady===false&&<section className="panel" style={{maxWidth:980,margin:"24px auto"}}><ShieldCheck/><h2>Publication review schema has not been applied yet.</h2><p className="muted">This preview is intentionally read-only. No registration approval fallback or publication mutation is available before the schema migration is explicitly approved and applied.</p></section>}
    {schemaReady===null&&error&&<section className="panel" style={{maxWidth:980,margin:"24px auto"}}><h2>Unable to load publication review</h2><p className="muted">{error}</p></section>}

    {schemaReady===true&&<section className="adminWrap adminV2">
      <div className="adminStats adminStatsV2"><div><b>{summary.unreviewed}</b><span>Unreviewed</span></div><div><b>{summary.eligible}</b><span>Eligible</span></div><div><b>{summary.published}</b><span>Published</span></div><div><b>{summary.withheld}</b><span>Withheld</span></div><div><b>{summary.mapped}</b><span>Mapped</span></div><div><b>{summary.unmapped}</b><span>Unmapped</span></div></div>
      <div className="panel" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:10,alignItems:"end"}}>
        <label>Search<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Operator, station, address or source reference"/></label>
        <label>Publication status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All</option><option value="unreviewed">Unreviewed</option><option value="eligible">Eligible</option><option value="published">Published</option><option value="withheld">Withheld</option></select></label>
        <label>State<select value={stateFilter} onChange={e=>setStateFilter(e.target.value)}><option value="all">All states</option>{states.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label>Map readiness<select value={mapFilter} onChange={e=>setMapFilter(e.target.value)}><option value="all">All</option><option value="mapped">Mapped</option><option value="unmapped">Unmapped</option></select></label>
      </div>
      <p className="muted">Publishing is an explicit second administrative decision after eligibility. If the controlled publication action schema is not yet applied, publish/unpublish calls fail closed with no direct table-update fallback.</p>
      {message&&<p className="panel">{message}</p>}{error&&<p className="panel" role="alert">{error}</p>}
      <p className="muted">Showing {visible.length} of {filtered.length} matching records · page {page} of {pages}</p>
      <div className="adminList">{visible.map(station=>{
        const mapped=isMapped(station);
        const expanded=selectedId===station.id;
        const historyRegionId=`review-history-${safeDomId(station.record_source_reference||station.name)}`;
        const mutationPending=mutatingStationIds.has(station.id);
        const eligibleCurrent=station.publication_status==="eligible";
        const publishedCurrent=station.publication_status==="published";
        const withheldCurrent=station.publication_status==="withheld";
        const unreviewedCurrent=station.publication_status==="unreviewed";
        return <div key={station.id}>
          <b>{station.name}</b>
          <span>{station.operator_name||"Operator not stated"} · {station.address}{station.city?`, ${station.city}`:""}{station.state?`, ${station.state}`:""}</span>
          <p><strong>Listed in official directory</strong> · {station.record_source_name||"Pi-CNG directory"} · {station.record_source_reference||"No source reference"}</p>
          <p>{station.is_verified?"CNGx verification recorded":"Not CNGx verified"} · {station.status==="unknown"?"Operational status unknown":`Operational status: ${station.status}`}</p>
          <p><MapPin size={14} style={{verticalAlign:"middle"}}/> {mapped?(station.location_precision==="approximate"?"Approximate location":`Location precision: ${station.location_precision}`):"No trusted map location yet"}{mapped&&station.location_source_name?` · ${station.location_source_name}`:""}</p>
          <p>Publication review: <b>{station.publication_status}</b></p>
          <p>
            <button className="primary" disabled={mutationPending||eligibleCurrent||publishedCurrent} aria-disabled={mutationPending||eligibleCurrent||publishedCurrent} onClick={()=>review(station,"eligible")}>Mark eligible</button>{" "}
            <button className="secondary" disabled={mutationPending||withheldCurrent||publishedCurrent} aria-disabled={mutationPending||withheldCurrent||publishedCurrent} onClick={()=>review(station,"withheld")}>Withhold</button>{" "}
            <button className="secondary" disabled={mutationPending||unreviewedCurrent||publishedCurrent} aria-disabled={mutationPending||unreviewedCurrent||publishedCurrent} onClick={()=>review(station,"unreviewed")}>Return to unreviewed</button>{" "}
            <button className="primary" disabled={mutationPending||!eligibleCurrent} aria-disabled={mutationPending||!eligibleCurrent} onClick={()=>publishStation(station)}>Publish</button>{" "}
            <button className="secondary" disabled={mutationPending||!publishedCurrent} aria-disabled={mutationPending||!publishedCurrent} onClick={()=>unpublishStation(station)}>Unpublish</button>{" "}
            <button className="secondary" aria-expanded={expanded} aria-controls={historyRegionId} disabled={expanded&&historyLoading} onClick={()=>toggleHistory(station)}>{expanded?"Hide history":"Review history"}</button>
            {mutationPending&&<span role="status" aria-live="polite" style={{marginLeft:8}}>Updating…</span>}
          </p>
          {expanded&&<section id={historyRegionId} role="region" aria-label={`Review history for ${station.name}`} aria-live="polite" className="panel" style={{marginTop:12}}>
            {historyLoading&&<p className="muted">Loading review history…</p>}
            {!historyLoading&&historyError&&<p role="alert">Unable to load review history: {historyError}</p>}
            {!historyLoading&&!historyError&&history.length>0&&history.map((item,index)=><div key={`${item.created_at}-${index}`} style={{padding:"10px 0",borderBottom:"1px solid rgba(127,127,127,.2)"}}><b>{item.previous_status} → {item.new_status}</b><span style={{display:"block"}}>{new Date(item.created_at).toLocaleString()} · Internal admin review</span>{item.notes&&<p>{item.notes}</p>}</div>)}
            {!historyLoading&&!historyError&&!history.length&&<p className="muted">No review events recorded yet.</p>}
          </section>}
        </div>;
      })}</div>
      {!visible.length&&<p className="muted">No directory records match these filters.</p>}
      <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",marginTop:16}}><button className="secondary" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {page} / {pages}</span><button className="secondary" disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Next</button></div>
    </section>}
  </main>;
}
