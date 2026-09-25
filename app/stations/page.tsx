"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import PublicStationTrust from "@/components/PublicStationTrust";
import {createClient} from "@/lib/supabase/client";
import {PUBLIC_STATION_VISIBILITY_OR_FILTER,isMapEligibleStation,publicStationDirections} from "@/lib/station-public-visibility";
import {projectNigeriaCoordinate} from "@/lib/nigeria-map-projection";
import {MapPin,Search,Navigation,Plus} from "lucide-react";
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
 const mapPins=useMemo(()=>mapItems.flatMap(station=>{
  const projection=projectNigeriaCoordinate(station.latitude,station.longitude);
  return projection?[{station,projection}]:[];
 }),[mapItems]);
 const outsideOverviewCount=mapItems.length-mapPins.length;
 return <main><header><Link href="/" className="brand"><span className="mark">x</span><div><b>CNGx</b><small>Station network</small></div></Link><nav className="topNav"><Link href="/stations">Find CNG</Link><Link href="/trip">Trip planner</Link><Link href="/marketplace">Marketplace</Link><Link href="/services">Services</Link></nav><div className="headerActions"><BackButton fallback="/"/><Link href="/register-station" className="primary"><Plus size={17}/> Register station</Link></div></header>
 <section className="networkIntro"><div className="eyebrow"><Navigation size={14}/> CNGx station directory</div><h1>Find CNG near your route.</h1><p>Search stations intentionally visible in CNGx and compare the evidence available for each record before you travel.</p></section>
 <section className="stationExplorer"><div className="stationToolbar"><div className="stationSearch"><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search station, city, state or operator"/></div><span className="stationCount">{loading?"Loading network…":shown.length+" station"+(shown.length===1?"":"s")+" found"}</span></div>
 <div className="stationLayout"><div className="stationList">{loading?<div className="loadingState">Loading public CNG stations…</div>:shown.map(s=>{const directions=publicStationDirections(s);return <article className="stationResult" key={s.id}><div className="stationResultHead"><div><div className="cardBadges"><span className={"status "+s.status}>{labels[s.status]||s.status}</span>{s.is_demo&&<span className="demo">Demo data</span>}{s.is_verified&&<span className="verifiedBadge">Verified</span>}</div><h3>{s.name}</h3></div></div><p className="stationAddress"><MapPin size={16}/>{s.address}{s.city?", "+s.city:""}{s.state?", "+s.state:""}</p><PublicStationTrust recordSourceType={s.record_source_type} recordSourceName={s.record_source_name} isVerified={s.is_verified} status={s.status} locationPrecision={s.location_precision}/><div className="stationMiniMetrics"><div><small>Price / SCM</small><b>{s.price_per_scm!=null?"₦"+s.price_per_scm:"Not reported"}</b></div><div><small>Queue</small><b>{s.queue_minutes!=null?s.queue_minutes+" min":"Unknown"}</b></div><div><small>Updated</small><b>{s.last_verified_at?new Date(s.last_verified_at).toLocaleDateString():"No verified update"}</b></div></div><div className="stationActions"><Link className="primary" href={"/stations/"+s.id}>View station</Link><button className="secondary" onClick={()=>window.open(directions.url,"_blank")}><Navigation size={16}/> {directions.label}</button></div></article>})}{!loading&&!shown.length&&<div className="emptyBox"><h2>No stations match this search</h2><p className="muted">Try another location or clear your search. Only stations that satisfy CNGx public visibility rules appear here.</p><button className="secondary" onClick={()=>setQ("")}>Clear search</button></div>}</div>
 <aside className="stationMap" aria-label="Nigeria network overview">
  <div className="mapHeader"><div><h3>Nigeria network overview</h3><p>Pins are positioned from stored trusted coordinates. Approximate records remain explicitly approximate.</p></div><div className="mapLegend" aria-label="Map precision legend"><span><i className="mapLegendMarker mapLegendExact" aria-hidden="true">•</i>Exact</span><span><i className="mapLegendMarker mapLegendApproximate" aria-hidden="true">≈</i>Approximate</span></div></div>
  <div className="mapPlot" aria-label="Nigeria coordinate plotting area"><div className="mapGrid" aria-hidden="true"/>{mapPins.map(({station,projection})=>{const approximate=station.location_precision==="approximate";const precisionLabel=approximate?"Approximate location":"Exact location";return <div key={station.id} role="img" className={approximate?"mapPin mapPinApproximate":"mapPin mapPinExact"} style={{left:`${projection.xPercent}%`,top:`${projection.yPercent}%`}} title={`${station.name} — ${precisionLabel}`} aria-label={`${station.name} — ${precisionLabel}`}><span aria-hidden="true">{approximate?"≈":"•"}</span></div>})}{!mapPins.length&&<div className="mapEmptyState">No public stations currently have trusted coordinates within the Nigeria overview.</div>}</div>
  <div className="mapCaption"><p>Unconfirmed locations do not receive map pins. This geographic overview is not turn-by-turn navigation and does not imply road-level or satellite accuracy.</p>{outsideOverviewCount>0&&<p>{outsideOverviewCount} trusted-coordinate record{outsideOverviewCount===1?" is":"s are"} outside the current Nigeria overview bounds and {outsideOverviewCount===1?"is":"are"} intentionally not plotted.</p>}</div>
 </aside></div></section></main>
}
