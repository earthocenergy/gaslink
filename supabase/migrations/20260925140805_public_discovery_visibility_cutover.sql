-- CNGx public-discovery visibility cutover foundation.
-- Intentionally prepared but NOT applied by 003E-1.
-- Public visibility is independent from verification and operational freshness.

-- Preserve private submitter/claimant/admin reads while replacing the public-read branch.
drop policy if exists stations_public_read on public.stations;
create policy stations_public_read
on public.stations
for select
to anon, authenticated
using (
  (
    (record_source_type = 'official_directory' and publication_status = 'published')
    or
    (record_source_type <> 'official_directory' and registration_status = 'approved')
  )
  or submitted_by = (select auth.uid())
  or claimed_by = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'::public.app_role
  )
);

create or replace function public.nearby_stations(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default null,
  p_limit integer default 20
)
returns table(
  id uuid,name text,operator_name text,address text,city text,state text,
  latitude double precision,longitude double precision,status public.station_status,
  price_per_scm numeric,queue_minutes integer,open_now boolean,is_verified boolean,
  status_updated_at timestamptz,price_updated_at timestamptz,queue_updated_at timestamptz,
  location_precision text,location_source_type text,location_source_name text,location_source_url text,location_source_observed_at timestamptz,
  record_source_type text,record_source_name text,record_source_url text,record_source_reference text,record_source_observed_at timestamptz,
  last_verified_at timestamptz,distance_meters double precision
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  if p_latitude is null or p_latitude < -90 or p_latitude > 90 then raise exception 'latitude out of range'; end if;
  if p_longitude is null or p_longitude < -180 or p_longitude > 180 then raise exception 'longitude out of range'; end if;
  if p_radius_meters is not null and (p_radius_meters <= 0 or p_radius_meters > 2000000) then raise exception 'radius must be between 0 and 2000000 metres'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'limit must be between 1 and 100'; end if;

  return query
  select s.id,s.name,s.operator_name,s.address,s.city,s.state,s.latitude,s.longitude,s.status,
         s.price_per_scm,s.queue_minutes,s.open_now,s.is_verified,
         s.status_updated_at,s.price_updated_at,s.queue_updated_at,
         s.location_precision,s.location_source_type,s.location_source_name,s.location_source_url,s.location_source_observed_at,
         s.record_source_type,s.record_source_name,s.record_source_url,s.record_source_reference,s.record_source_observed_at,
         s.last_verified_at,
         gis.st_distance(s.location,gis.st_setsrid(gis.st_makepoint(p_longitude,p_latitude),4326)::gis.geography)
  from public.stations s
  where (
      (s.record_source_type = 'official_directory' and s.publication_status = 'published')
      or
      (s.record_source_type <> 'official_directory' and s.registration_status = 'approved')
    )
    and s.latitude is not null
    and s.longitude is not null
    and s.location is not null
    and s.location_precision in ('approximate','exact')
    and (
      p_radius_meters is null
      or gis.st_dwithin(
        s.location,
        gis.st_setsrid(gis.st_makepoint(p_longitude,p_latitude),4326)::gis.geography,
        p_radius_meters
      )
    )
  order by s.location operator(gis.<->) gis.st_setsrid(gis.st_makepoint(p_longitude,p_latitude),4326)::gis.geography
  limit p_limit;
end
$$;

revoke all on function public.nearby_stations(double precision,double precision,double precision,integer) from public;
grant execute on function public.nearby_stations(double precision,double precision,double precision,integer) to anon,authenticated;

comment on function public.nearby_stations is
  'Read-only proximity query using canonical public visibility and trusted map-eligible coordinates; SECURITY INVOKER preserves stations RLS.';
