-- CNGx Phase 1 geospatial/data-foundation migration.
-- DO NOT apply to production until product-lead approval.
create schema if not exists gis;
create extension if not exists postgis with schema gis;

alter table public.stations
  add column if not exists record_source_type text not null default 'other',
  add column if not exists record_source_name text,
  add column if not exists record_source_url text,
  add column if not exists record_source_reference text,
  add column if not exists record_source_observed_at timestamptz,
  add column if not exists location_precision text not null default 'unconfirmed',
  add column if not exists location_source_type text,
  add column if not exists location_source_name text,
  add column if not exists location_source_url text,
  add column if not exists location_source_observed_at timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists price_updated_at timestamptz,
  add column if not exists queue_updated_at timestamptz,
  add column if not exists location gis.geography(Point,4326);

update public.stations set record_source_type='demo' where is_demo=true and record_source_type='other';

alter table public.stations
  add constraint stations_record_source_type_check check (record_source_type in ('demo','official_directory','operator','admin','other')),
  add constraint stations_location_precision_check check (location_precision in ('exact','approximate','unconfirmed')),
  add constraint stations_location_source_type_check check (location_source_type is null or location_source_type in ('official_map','geocoded','operator','admin','other')),
  add constraint stations_latitude_range_check check (latitude is null or latitude between -90 and 90),
  add constraint stations_longitude_range_check check (longitude is null or longitude between -180 and 180),
  add constraint stations_coordinate_pair_check check ((latitude is null) = (longitude is null));

create or replace function public.sync_station_geography()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.latitude is null or new.longitude is null then
    new.location := null;
  else
    new.location := gis.st_setsrid(gis.st_makepoint(new.longitude,new.latitude),4326)::gis.geography;
  end if;
  return new;
end
$$;

drop trigger if exists sync_station_geography on public.stations;
create trigger sync_station_geography
before insert or update of latitude,longitude,location on public.stations
for each row execute function public.sync_station_geography();

update public.stations
set location = gis.st_setsrid(gis.st_makepoint(longitude,latitude),4326)::gis.geography
where latitude is not null and longitude is not null;


create or replace function public.stamp_station_operational_freshness()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then new.status_updated_at := now(); end if;
  if new.price_per_scm is distinct from old.price_per_scm then new.price_updated_at := now(); end if;
  if new.queue_minutes is distinct from old.queue_minutes then new.queue_updated_at := now(); end if;
  return new;
end
$$;

drop trigger if exists stamp_station_operational_freshness on public.stations;
create trigger stamp_station_operational_freshness
before update of status,price_per_scm,queue_minutes on public.stations
for each row execute function public.stamp_station_operational_freshness();

revoke all on function public.sync_station_geography() from public,anon,authenticated;
revoke all on function public.stamp_station_operational_freshness() from public,anon,authenticated;

revoke create on schema gis from public;
grant usage on schema gis to anon,authenticated;

create index if not exists stations_location_gist_idx on public.stations using gist(location);
create unique index if not exists stations_source_reference_unique_idx
  on public.stations(record_source_type,record_source_reference)
  where record_source_reference is not null;

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
  where s.registration_status='approved'
    and s.location is not null
    and (p_radius_meters is null or gis.st_dwithin(s.location,gis.st_setsrid(gis.st_makepoint(p_longitude,p_latitude),4326)::gis.geography,p_radius_meters))
  order by s.location operator(gis.<->) gis.st_setsrid(gis.st_makepoint(p_longitude,p_latitude),4326)::gis.geography
  limit p_limit;
end
$$;

revoke all on function public.nearby_stations(double precision,double precision,double precision,integer) from public;
grant execute on function public.nearby_stations(double precision,double precision,double precision,integer) to anon,authenticated;

comment on column public.stations.record_source_type is 'Origin of directory identity; independent of CNGx verification and operational freshness.';
comment on column public.stations.location_precision is 'exact, approximate, or unconfirmed geographic confidence.';
comment on column public.stations.location_source_type is 'Origin of coordinates; independent of record provenance. Null when no trusted coordinates exist.';
comment on function public.nearby_stations is 'Read-only proximity query; SECURITY INVOKER preserves stations RLS visibility.';
