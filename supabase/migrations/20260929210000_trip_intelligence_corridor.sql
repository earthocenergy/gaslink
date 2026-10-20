-- CNGx T1 Trip Intelligence corridor foundation. SOURCE ONLY: L1C staging before production.
create or replace function public.trip_route_corridor_stations(
  p_route_geojson text, p_corridor_meters double precision default 10000, p_limit integer default 100
) returns table(
  id uuid,name text,address text,city text,state text,latitude double precision,longitude double precision,
  status public.station_status,price_per_scm numeric,queue_minutes integer,is_verified boolean,last_verified_at timestamptz,
  location_precision text,record_source_type text,record_source_name text,
  distance_from_route_meters double precision,route_progress_fraction double precision
) language plpgsql security invoker stable set search_path='' as $$
declare v_route gis.geometry;
begin
  if p_corridor_meters is null or p_corridor_meters < 1000 or p_corridor_meters > 50000 then raise exception 'corridor must be between 1000 and 50000 metres'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 200 then raise exception 'limit must be between 1 and 200'; end if;
  begin v_route := gis.st_setsrid(gis.st_geomfromgeojson(p_route_geojson),4326); exception when others then raise exception 'invalid route geojson'; end;
  if gis.st_geometrytype(v_route) <> 'ST_LineString' or gis.st_isempty(v_route) then raise exception 'route must be a non-empty LineString'; end if;
  return query
  select s.id,s.name,s.address,s.city,s.state,s.latitude,s.longitude,s.status,s.price_per_scm,s.queue_minutes,s.is_verified,s.last_verified_at,
    s.location_precision,s.record_source_type,s.record_source_name,
    gis.st_distance(s.location,v_route::gis.geography),
    gis.st_linelocatepoint(v_route,gis.st_setsrid(gis.st_makepoint(s.longitude,s.latitude),4326))
  from public.stations s
  where ((s.record_source_type='official_directory' and s.publication_status='published') or (s.record_source_type<>'official_directory' and s.registration_status='approved'))
    and s.latitude is not null and s.longitude is not null and s.location is not null
    and s.location_precision in ('exact','approximate')
    and gis.st_dwithin(s.location,v_route::gis.geography,p_corridor_meters)
  order by route_progress_fraction asc, distance_from_route_meters asc limit p_limit;
end $$;
revoke all on function public.trip_route_corridor_stations(text,double precision,integer) from public;
grant execute on function public.trip_route_corridor_stations(text,double precision,integer) to anon,authenticated;
comment on function public.trip_route_corridor_stations is 'T1 read-only route corridor query. Canonical public visibility plus trusted exact/approximate coordinates only.';
