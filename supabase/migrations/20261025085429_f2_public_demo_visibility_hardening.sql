-- CNGx F2-04
-- Public demo/test station visibility hardening.
--
-- SOURCE ONLY. Do not apply to production under F2.
--
-- This migration changes visibility only.
-- It does not delete, rewrite, unclaim, verify, unverify, publish
-- or unpublish any station record.
--
-- Private submitter/claimant/admin access is preserved.

begin;

drop policy if exists stations_public_read
on public.stations;

create policy stations_public_read
on public.stations
for select
to anon, authenticated
using (
  (
    is_demo = false
    and (
      (
        record_source_type = 'official_directory'
        and publication_status = 'published'
      )
      or
      (
        record_source_type <> 'official_directory'
        and registration_status = 'approved'
      )
    )
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
  id uuid,
  name text,
  operator_name text,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  status public.station_status,
  price_per_scm numeric,
  queue_minutes integer,
  open_now boolean,
  is_verified boolean,
  status_updated_at timestamptz,
  price_updated_at timestamptz,
  queue_updated_at timestamptz,
  location_precision text,
  location_source_type text,
  location_source_name text,
  location_source_url text,
  location_source_observed_at timestamptz,
  record_source_type text,
  record_source_name text,
  record_source_url text,
  record_source_reference text,
  record_source_observed_at timestamptz,
  last_verified_at timestamptz,
  distance_meters double precision
)
language plpgsql
security invoker
set search_path = ''
stable
as $$
begin
  if p_latitude is null
     or p_latitude < -90
     or p_latitude > 90 then
    raise exception 'latitude out of range';
  end if;

  if p_longitude is null
     or p_longitude < -180
     or p_longitude > 180 then
    raise exception 'longitude out of range';
  end if;

  if p_radius_meters is not null
     and (
       p_radius_meters <= 0
       or p_radius_meters > 2000000
     ) then
    raise exception
      'radius must be between 0 and 2000000 metres';
  end if;

  if p_limit is null
     or p_limit < 1
     or p_limit > 100 then
    raise exception
      'limit must be between 1 and 100';
  end if;

  return query
  select
    s.id,
    s.name,
    s.operator_name,
    s.address,
    s.city,
    s.state,
    s.latitude,
    s.longitude,
    s.status,
    s.price_per_scm,
    s.queue_minutes,
    s.open_now,
    s.is_verified,
    s.status_updated_at,
    s.price_updated_at,
    s.queue_updated_at,
    s.location_precision,
    s.location_source_type,
    s.location_source_name,
    s.location_source_url,
    s.location_source_observed_at,
    s.record_source_type,
    s.record_source_name,
    s.record_source_url,
    s.record_source_reference,
    s.record_source_observed_at,
    s.last_verified_at,
    gis.st_distance(
      s.location,
      gis.st_setsrid(
        gis.st_makepoint(
          p_longitude,
          p_latitude
        ),
        4326
      )::gis.geography
    )
  from public.stations s
  where s.is_demo = false
    and (
      (
        s.record_source_type = 'official_directory'
        and s.publication_status = 'published'
      )
      or
      (
        s.record_source_type <> 'official_directory'
        and s.registration_status = 'approved'
      )
    )
    and s.latitude is not null
    and s.longitude is not null
    and s.location is not null
    and s.location_precision in ('approximate','exact')
    and (
      p_radius_meters is null
      or gis.st_dwithin(
        s.location,
        gis.st_setsrid(
          gis.st_makepoint(
            p_longitude,
            p_latitude
          ),
          4326
        )::gis.geography,
        p_radius_meters
      )
    )
  order by
    s.location operator(gis.<->)
    gis.st_setsrid(
      gis.st_makepoint(
        p_longitude,
        p_latitude
      ),
      4326
    )::gis.geography
  limit p_limit;
end;
$$;

revoke all on function
  public.nearby_stations(
    double precision,
    double precision,
    double precision,
    integer
  )
from public;

grant execute on function
  public.nearby_stations(
    double precision,
    double precision,
    double precision,
    integer
  )
to anon, authenticated;

create or replace function public.trip_route_corridor_stations(
  p_route_geojson text,
  p_corridor_meters double precision default 10000,
  p_limit integer default 100
)
returns table(
  id uuid,
  name text,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  status public.station_status,
  price_per_scm numeric,
  queue_minutes integer,
  is_verified boolean,
  last_verified_at timestamptz,
  location_precision text,
  record_source_type text,
  record_source_name text,
  distance_from_route_meters double precision,
  route_progress_fraction double precision
)
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_route gis.geometry;
begin
  if p_corridor_meters is null
     or p_corridor_meters < 1000
     or p_corridor_meters > 50000 then
    raise exception
      'corridor must be between 1000 and 50000 metres';
  end if;

  if p_limit is null
     or p_limit < 1
     or p_limit > 200 then
    raise exception
      'limit must be between 1 and 200';
  end if;

  begin
    v_route :=
      gis.st_setsrid(
        gis.st_geomfromgeojson(p_route_geojson),
        4326
      );
  exception
    when others then
      raise exception 'invalid route geojson';
  end;

  if gis.st_geometrytype(v_route) <> 'ST_LineString'
     or gis.st_isempty(v_route) then
    raise exception
      'route must be a non-empty LineString';
  end if;

  return query
  select
    s.id,
    s.name,
    s.address,
    s.city,
    s.state,
    s.latitude,
    s.longitude,
    s.status,
    s.price_per_scm,
    s.queue_minutes,
    s.is_verified,
    s.last_verified_at,
    s.location_precision,
    s.record_source_type,
    s.record_source_name,
    gis.st_distance(
      s.location,
      v_route::gis.geography
    ),
    gis.st_linelocatepoint(
      v_route,
      gis.st_setsrid(
        gis.st_makepoint(
          s.longitude,
          s.latitude
        ),
        4326
      )
    )
  from public.stations s
  where s.is_demo = false
    and (
      (
        s.record_source_type = 'official_directory'
        and s.publication_status = 'published'
      )
      or
      (
        s.record_source_type <> 'official_directory'
        and s.registration_status = 'approved'
      )
    )
    and s.latitude is not null
    and s.longitude is not null
    and s.location is not null
    and s.location_precision in ('exact','approximate')
    and gis.st_dwithin(
      s.location,
      v_route::gis.geography,
      p_corridor_meters
    )
  order by
    route_progress_fraction asc,
    distance_from_route_meters asc
  limit p_limit;
end;
$$;

revoke all on function
  public.trip_route_corridor_stations(
    text,
    double precision,
    integer
  )
from public;

grant execute on function
  public.trip_route_corridor_stations(
    text,
    double precision,
    integer
  )
to anon, authenticated;

comment on function
  public.nearby_stations(
    double precision,
    double precision,
    double precision,
    integer
  )
is
  'Read-only public proximity query. F2 excludes demo/test rows and requires canonical visibility plus trusted coordinates.';

comment on function
  public.trip_route_corridor_stations(
    text,
    double precision,
    integer
  )
is
  'Read-only Trip corridor query. F2 excludes demo/test rows and requires canonical public visibility plus trusted coordinates.';

commit;
