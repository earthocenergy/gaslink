"use client";
import{FormEvent,useEffect,useRef,useState}from"react";import Link from"next/link";import BackButton from"@/components/BackButton";import{Route,MapPin,Navigation,Gauge,Clock3,Search,ArrowRight,ShieldCheck,TriangleAlert}from"lucide-react";import type{ResolvedPlace,TripPlanResponse}from"@/lib/trip/contracts";
type Suggestions={origin:ResolvedPlace[];destination:ResolvedPlace[]};
export default function Trip(){const[from,setFrom]=useState(""),[to,setTo]=useState(""),[range,setRange]=useState("200"),[reserve,setReserve]=useState("20"),[loading,setLoading]=useState(false),[result,setResult]=useState<TripPlanResponse|null>(null),[suggestions,setSuggestions]=useState<Suggestions>({origin:[],destination:[]});const seq=useRef(0);const[placeNotices,setPlaceNotices]=useState<{origin:string|null;destination:string|null}>({origin:null,destination:null});
 useEffect(()=>{
   const controller=new AbortController();
   const query=from.trim();
   setSuggestions(s=>({...s,origin:[]}));
   setPlaceNotices(s=>({...s,origin:null}));
   if(query.length<3)return()=>controller.abort();
   const timer=setTimeout(async()=>{
     try{
       const response=await fetch("/api/v1/places/search?q="+encodeURIComponent(query),{signal:controller.signal});
       const data=await response.json();
       if(controller.signal.aborted)return;
       if(response.status===429){
         const header=Number(response.headers.get("Retry-After"));
         const body=Number(data.retryAfter);
         const seconds=Number.isFinite(header)&&header>0?Math.ceil(header):Number.isFinite(body)&&body>0?Math.ceil(body):60;
         setPlaceNotices(s=>({...s,origin:`Place search is temporarily limited. Please wait ${seconds} seconds before searching again.`}));
       }else if(response.status===503){
         setPlaceNotices(s=>({...s,origin:"Place search is temporarily unavailable. You can still enter a location manually."}));
       }else if(response.ok&&data.ok){
         setSuggestions(s=>({...s,origin:data.results||[]}));
       }else{
         setPlaceNotices(s=>({...s,origin:"Place suggestions are unavailable. You can still enter a location manually."}));
       }
     }catch{
       if(!controller.signal.aborted)setPlaceNotices(s=>({...s,origin:"Place suggestions are unavailable. You can still enter a location manually."}));
     }
   },350);
   return()=>{clearTimeout(timer);controller.abort()};
 },[from]);
 useEffect(()=>{
   const controller=new AbortController();
   const query=to.trim();
   setSuggestions(s=>({...s,destination:[]}));
   setPlaceNotices(s=>({...s,destination:null}));
   if(query.length<3)return()=>controller.abort();
   const timer=setTimeout(async()=>{
     try{
       const response=await fetch("/api/v1/places/search?q="+encodeURIComponent(query),{signal:controller.signal});
       const data=await response.json();
       if(controller.signal.aborted)return;
       if(response.status===429){
         const header=Number(response.headers.get("Retry-After"));
         const body=Number(data.retryAfter);
         const seconds=Number.isFinite(header)&&header>0?Math.ceil(header):Number.isFinite(body)&&body>0?Math.ceil(body):60;
         setPlaceNotices(s=>({...s,destination:`Place search is temporarily limited. Please wait ${seconds} seconds before searching again.`}));
       }else if(response.status===503){
         setPlaceNotices(s=>({...s,destination:"Place search is temporarily unavailable. You can still enter a location manually."}));
       }else if(response.ok&&data.ok){
         setSuggestions(s=>({...s,destination:data.results||[]}));
       }else{
         setPlaceNotices(s=>({...s,destination:"Place suggestions are unavailable. You can still enter a location manually."}));
       }
     }catch{
       if(!controller.signal.aborted)setPlaceNotices(s=>({...s,destination:"Place suggestions are unavailable. You can still enter a location manually."}));
     }
   },350);
   return()=>{clearTimeout(timer);controller.abort()};
 },[to]);
 async function go(e:FormEvent){e.preventDefault();setLoading(true);setResult(null);try{const r=await fetch("/api/v1/trips/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:from,destination:to,vehicleRangeKm:+range,reservePercent:+reserve})});const data:TripPlanResponse=await r.json();
    if(r.status===429){
      const retryHeader=Number(r.headers.get("Retry-After"));
      const retryBody=Number(data.retryAfter);
      const seconds=Number.isFinite(retryHeader)&&retryHeader>0
        ?Math.ceil(retryHeader)
        :Number.isFinite(retryBody)&&retryBody>0
          ?Math.ceil(retryBody)
          :60;
      setResult({
        ok:false,
        failureReason:"RATE_LIMITED",
        message:`Too many trip requests. Please wait ${seconds} seconds before trying again.`,
        retryAfter:seconds,
        provider:"mapbox",
        contractVersion:"v1"
      });
    }else{
      setResult(data);
    }}catch{setResult({ok:false,failureReason:"ROUTING_PROVIDER_UNAVAILABLE",message:"Trip planning is temporarily unavailable.",provider:"mapbox",contractVersion:"v1"})}finally{setLoading(false)}}
 const effective=(+range||0)*(1-(+reserve||0)/100);
 return <main><header><Link href="/" className="brand"><span className="mark">x</span><div><b>CNGx</b><small>Trip planner</small></div></Link><nav className="topNav"><Link href="/stations">Find CNG</Link><Link href="/trip">Trip planner</Link><Link href="/savings">Savings</Link></nav><div className="headerActions"><BackButton fallback="/dashboard"/></div></header>
 <section className="tripHero"><div className="eyebrow"><Route size={14}/> CNG route planning</div><h1>Know the fuel stops before the road.</h1><p>CNGx plans a driving route, checks trusted public CNG stations along its corridor, and tests the journey against your stated vehicle range and reserve. It is route planning—not turn-by-turn navigation.</p></section>
 <section className="tripWorkspace"><form className="tripForm" onSubmit={go}><div className="tripFormTitle"><div className="tripIcon"><Navigation/></div><div><h2>Build your journey</h2><p className="muted">Locations are resolved temporarily for this request and are not saved.</p></div></div><div className="routeInputs"><label><span>Starting point</span><div className="inputWithIcon"><MapPin/><input required value={from} onChange={e=>setFrom(e.target.value)} placeholder="e.g. Port Harcourt" list="origin-options"/></div><datalist id="origin-options">{suggestions.origin.map((x,i)=><option key={i} value={x.label}/>)}</datalist></label><div className="routeConnector"><ArrowRight/></div><label><span>Destination</span><div className="inputWithIcon"><MapPin/><input required value={to} onChange={e=>setTo(e.target.value)} placeholder="e.g. Aba" list="destination-options"/></div><datalist id="destination-options">{suggestions.destination.map((x,i)=><option key={i} value={x.label}/>)}</datalist></label></div>{placeNotices.origin&&<p className="authMsg" role="status" aria-live="polite"><TriangleAlert size={16}/>{placeNotices.origin}</p>}{placeNotices.destination&&<p className="authMsg" role="status" aria-live="polite"><TriangleAlert size={16}/>{placeNotices.destination}</p>}<div className="routeInputs"><label><span>Vehicle CNG range</span><div className="inputWithIcon"><Gauge/><input type="number" min="20" max="2000" required value={range} onChange={e=>setRange(e.target.value)}/><b className="inputSuffix">km</b></div></label><span/><label><span>Reserve</span><div className="inputWithIcon"><ShieldCheck/><input type="number" min="0" max="50" required value={reserve} onChange={e=>setReserve(e.target.value)}/><b className="inputSuffix">%</b></div></label></div><p className="muted">Planning range: <b>{Number.isFinite(effective)?effective.toFixed(0):"—"} km</b>. This is a planning assumption, not a tank-level prediction.</p><button className="primary tripSubmit" disabled={loading}><Search size={17}/>{loading?"Planning road route…":"Plan CNG trip"}</button></form>
 <aside className="tripGuidance"><span className="eyebrow">Trust rules</span><h2>Only trusted map locations can close a range gap.</h2><div className="guideItem"><ShieldCheck/><div><b>Exact or approximate only</b><span>Approximate stations carry a warning. Unconfirmed locations never enter route geometry.</span></div></div><div className="guideItem"><Clock3/><div><b>Conditions can change</b><span>Availability, queue and operating status should be reconfirmed before departure.</span></div></div><div className="guideItem"><Gauge/><div><b>Reserve stays visible</b><span>CNGx plans against your stated range after the reserve you choose.</span></div></div></aside></section>
 {result&&<section className="tripResults"><div className="tripResultsHead"><div><span className="eyebrow">{result.feasible?"Route feasible":"Trip needs attention"}</span><h2>{result.origin?.label||from} <ArrowRight size={22}/> {result.destination?.label||to}</h2>{result.route&&<p>{(result.route.distanceMeters/1000).toFixed(1)} km · about {Math.round(result.route.durationSeconds/60)} min · usable CNG range {result.effectiveRangeKm?.toFixed(0)} km</p>}{result.message&&<p><TriangleAlert size={15}/> {result.message}</p>}{result.failureReason&&<p><b>{result.failureReason.replaceAll("_"," ")}</b></p>}</div><span className="stationCount">{result.stops?.length||0} planned stop{result.stops?.length===1?"":"s"}</span></div>{result.warnings?.map((w,i)=><div className="authMsg" key={i}><TriangleAlert size={16}/>{w}</div>)}<div className="tripResultGrid">{result.stops?.map((s,i)=><article className="tripResultCard" key={s.id}><div className="tripStopNumber">{i+1}</div><div className="cardBadges"><span className={"status "+s.status}>{s.status.replaceAll("_"," ")}</span>{s.locationPrecision==="approximate"&&<span className="verifiedBadge">Approximate location</span>}</div><h3>{s.name}</h3><p className="stationAddress"><MapPin size={15}/>{s.address}</p><p className="muted">{s.legDistanceKm.toFixed(1)} km from previous fuel point · {(s.distanceFromRouteMeters/1000).toFixed(1)} km from route line</p><Link className="primary" href={"/stations/"+s.id}>View station</Link></article>)}</div>{result.alternateStops&&result.alternateStops.length>0&&<div className="emptyBox"><h3>Alternate viable sequence</h3><p>{result.alternateStops.map(s=>s.name).join(" → ")}</p></div>}</section>}</main>}