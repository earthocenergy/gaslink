type Props = {
  recordSourceType: string | null;
  recordSourceName?: string | null;
  isVerified: boolean;
  status: string;
  locationPrecision?: string | null;
};

export default function PublicStationTrust({recordSourceType,recordSourceName,isVerified,status,locationPrecision}:Props){
  if(recordSourceType!=="official_directory") return null;
  const labels=[`Listed in official directory${recordSourceName?` · ${recordSourceName}`:""}`];
  labels.push(isVerified?"CNGx verified":"Not CNGx verified");
  if(status==="unknown") labels.push("Operational status unknown");
  if(locationPrecision==="approximate") labels.push("Approximate location");
  if(locationPrecision==="unconfirmed") labels.push("No trusted map location yet");
  return <p className="muted" style={{marginTop:8}}>{labels.join(" · ")}</p>;
}
