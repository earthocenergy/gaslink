import type{PlannedStop,TripFailureReason,TripStation}from"./contracts";
export function effectiveRangeKm(vehicleRangeKm:number,reservePercent:number){if(!Number.isFinite(vehicleRangeKm)||vehicleRangeKm<20||vehicleRangeKm>2000||!Number.isFinite(reservePercent)||reservePercent<0||reservePercent>50)return null;return vehicleRangeKm*(1-reservePercent/100)}
type Result={feasible:boolean;stops:PlannedStop[];alternateStops:PlannedStop[];reason?:TripFailureReason};
export function planStops(stations:TripStation[],routeKm:number,effectiveKm:number):Result{
 if(!Number.isFinite(routeKm)||routeKm<=0)
  return{feasible:false,stops:[],alternateStops:[],reason:"INVALID_ROUTE"};
 if(!Number.isFinite(effectiveKm)||effectiveKm<=0)
  return{feasible:false,stops:[],alternateStops:[],reason:"INVALID_RANGE"};
 if(routeKm<=effectiveKm)
  return{feasible:true,stops:[],alternateStops:[]};

 const usable=stations
  .filter(s=>
   Number.isFinite(s.routeProgressFraction)&&
   s.routeProgressFraction>0&&s.routeProgressFraction<1&&
   Number.isFinite(s.distanceFromRouteMeters)&&
   s.distanceFromRouteMeters>=0&&
   s.status!=="offline"&&s.status!=="out_of_gas"&&
   (s.locationPrecision==="exact"||s.locationPrecision==="approximate")
  )
  .map(s=>({...s,routeProgressKm:s.routeProgressFraction*routeKm}))
  .sort((a,b)=>a.routeProgressKm-b.routeProgressKm||
   a.distanceFromRouteMeters-b.distanceFromRouteMeters||
   a.id.localeCompare(b.id));

 type Path=typeof usable;
 const best:Path[][]=Array.from({length:usable.length},()=>[]);
 const cost=(p:Path)=>p.reduce((n,s)=>n+s.distanceFromRouteMeters,0);
 const signature=(p:Path)=>p.map(s=>s.id).join("|");
 const compare=(a:Path,b:Path)=>a.length-b.length||
  cost(a)-cost(b)||signature(a).localeCompare(signature(b));

 const addPath=(paths:Path[],candidate:Path)=>{
  const key=signature(candidate);
  if(paths.some(path=>signature(path)===key))return;
  paths.push(candidate);
  paths.sort(compare);
  if(paths.length>2)paths.length=2;
 };

 for(let i=0;i<usable.length;i++){
  const current=usable[i];
  if(current.routeProgressKm<=effectiveKm)
   addPath(best[i],[current]);

  for(let j=0;j<i;j++){
   if(current.routeProgressKm<=usable[j].routeProgressKm)continue;
   if(current.routeProgressKm-usable[j].routeProgressKm>effectiveKm)continue;
   for(const path of best[j])
    addPath(best[i],[...path,current]);
  }
 }

 const feasible:Path[]=[];
 for(let i=0;i<usable.length;i++){
  if(routeKm-usable[i].routeProgressKm>effectiveKm)continue;
  for(const path of best[i])feasible.push(path);
 }
 feasible.sort(compare);

 const decorate=(p:Path)=>p.map((s,i)=>({
  ...s,
  legDistanceKm:s.routeProgressKm-(i?p[i-1].routeProgressKm:0)
 }));

 if(feasible.length)
  return{
   feasible:true,
   stops:decorate(feasible[0]),
   alternateStops:feasible[1]?decorate(feasible[1]):[]
  };

 if(!usable.length)
  return{
   feasible:false,stops:[],alternateStops:[],
   reason:stations.length?"NO_REACHABLE_STATION":"NO_TRUSTED_STATIONS_ON_CORRIDOR"
  };

 let previous=0,maxGap=0;
 for(const s of usable){
  maxGap=Math.max(maxGap,s.routeProgressKm-previous);
  previous=s.routeProgressKm;
 }
 maxGap=Math.max(maxGap,routeKm-previous);
 return{
  feasible:false,stops:[],alternateStops:[],
  reason:maxGap>effectiveKm?
   "CORRIDOR_GAP_EXCEEDS_RANGE":"NO_REACHABLE_STATION"
 };
}
export function trustWarnings(stations:TripStation[]){const out:string[]=[];if(stations.some(s=>s.locationPrecision==="approximate"))out.push("One or more planned stations have approximate coordinates. Confirm the station entrance before departure.");if(stations.some(s=>s.status==="unknown"))out.push("One or more planned stations have unknown current operating status.");return out}