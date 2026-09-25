"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import PublicStationTrust from "@/components/PublicStationTrust";
import {createClient} from "@/lib/supabase/client";
import {PUBLIC_STATION_VISIBILITY_OR_FILTER,isMapEligibleStation,publicStationDirections} from "@/lib/station-public-visibility";
import {MapPin,Search,Clock3,Navigation,Plus} from "lucide-react";
type S={
 id:string;name:string;operator_name:string|null;address:string;city:string|null;state:string|null;status:string;
 price_per_scm:number|null;queue_minutes:number|null;open_now:boolean|null;is_demo:boolean;is_verified:boolean;last_verified_at:string|null;
 record_source_type:string|null;record_source_name:string|null;publication_status:string|null;registration_status:string|null;
 latitude:number|null;longitude:number|null;location:unknown|null;location_precision:string|null;
};
const labels:Record<string,string>={available:"Available",low_supply:"Low supply",out_of_gas:"Out of gas",offline:"Offline",unknown:"Unknown"};
export default function Stations(){
 const [items,setItems]=useState<S[]>([]),[q,setQ]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{
  const x=new URLSearchParams(window.location.search).get("q");if(x)setQ(x);
  createClient().from("stations")
   .select("id,name,operator_name,address,city,state,status,price_per_scm,queue_minutes,open_now,is_demo,is_verified,last_verified_at,record_source_type,record_source_name,publication_status,registration_status,latitude,longitude,location,location_precision")
   .or(PUBLIC_STATION_VISIBILITY_OR_FILTER)
   .then(({data})=>{setItems((data||[]) as S[]);setLoading(false)});
 },[]);
 const shown=useMemo(()=>items.filter(s=>(s.name+" "+s.address+" "+(s.city||"")+" "+(s.state||"")+" "+(s.operator_name||"")).toLowerCase().includes(q.toLowerCase())),[items,q]);
 const mapItems=useMemo(()=>shown.filter(isMapEligibleStation),[shown]);
 return <main><header><Link href="/" className="brand"><span className="mark">x</span><div><b>CNGx</b><small>Station network</small></div></Link><nav className="topNav"><Link href="/stations">Find CNG</Link><Link href="/trip">Trip planner</Link><Link href="/marketplace">Marketplace</Link><Link href="/services">Services</Link></nav><div className="headerActions"><BackButton fallback="/"/><Link href="/register-station" className="primary"><Plus size={17}/> Register station</Link></div></header>
 <section className="networkIntro"><div className="eyebrow"><Navigation size={14}/> CNGx station directory</div><h1>Find CNG near your route.</h1><p>Search stations intentionally visible in CNGx and compare the evidence available for each record before you travel.</p></section>
 <section className="stationExplorer"><div className="stationToolbar"><div className="stationSearch"><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search station, city, state or operator"/></div><span className="stationCount">{loading?"Loading network…":shown.length+" station"+(shown.length===1?"":"s")+" found"}</span></div>
 <div className="stationLayout"><div className="stationList">{loading?<div className="loadingState">Loading public CNG stations…</div>:shown.map(s=>{const directions=publicStationDirections(s);return <article className="stationResult" key={s.id}><div className="stationResultHead"><div><div className="cardBadges"><span className={"status "+s.status}>{labels[s.status]||s.status}</span>{s.is_demo&&<span className="demo">Demo data</span>}{s.is_verified&&<span className="verifiedBadge">Verified</span>}</div><h3>{s.name}</h3></div></div><p className="stationAddress"><MapPin size={16}/>{s.address}{s.city?", "+s.city:""}{s.state?", "+s.state:""}</p><PublicStationTrust recordSourceType={s.record_source_type} recordSourceName={s.record_source_name} isVerified={s.is_verified} status={s.status} locationPrecision={s.location_precision}/><div className="stationMiniMetrics"><div><small>Price / SCM</small><b>{s.price_per_scm!=null?"₦"+s.price_per_scm:"Not reported"}</b></div><div><small>Queue</small><b>{s.queue_minutes!=null?s.queue_minutes+" min":"Unknown"}</b></div><div><small>Updated</small><b>{s.last_verified_at?new Date(s.last_verified_at).toLocaleDateString():"No verified update"}</b></div></div><div className="stationActions"><Link className="primary" href={"/stations/"+s.id}>View station</Link><button className="secondary" onClick={()=>window.open(directions.url,"_blank")}><Navigation size={16}/> {directions.label}</button></div></article>})}{!loading&&!shown.length&&<div className="emptyBox"><h2>No stations match this search</h2><p className="muted">Try another location or clear your search. Only stations that satisfy CNGx public visibility rules appear here.</p><button className="secondary" onClick={()=>setQ("")}>Clear search</button></div>}</div>
 <aside className="stationMap" aria-label="Station network overview"><div className="mapGrid"/>{mapItems.slice(0,3).map((s,i)=><div key={s.id} className={"mapPin p"+(i+1)} title={s.name}><span>{i+1}</span></div>)}<div className="mapOverlay"><h3>Network map</h3><p>Only public stations with trusted exact or approximate coordinates are eligible for map pins. Unconfirmed locations remain list-searchable without a map pin.</p></div></aside></div></section></main>
}
