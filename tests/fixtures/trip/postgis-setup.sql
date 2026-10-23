\set ON_ERROR_STOP on

create schema gis;
create extension postgis with schema gis;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname='anon'
  ) then
    create role anon nologin;
  end if;
  if not exists (
    select 1 from pg_roles where rolname='authenticated'
  ) then
    create role authenticated nologin;
  end if;
end $$;

create type public.station_status as enum
  ('available','low_supply','out_of_gas','offline','unknown');

create table public.stations (
  id uuid primary key,
  name text not null,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  status public.station_status default 'unknown',
  price_per_scm numeric,
  queue_minutes integer,
  is_verified boolean default false,
  last_verified_at timestamptz,
  location_precision text,
  record_source_type text,
  record_source_name text,
  registration_status text,
  publication_status text,
  location gis.geography(Point,4326)
);

alter table public.stations enable row level security;

create policy stations_public_read
on public.stations
for select to anon,authenticated
using (
  (
    record_source_type='official_directory'
    and publication_status='published'
  )
  or
  (
    record_source_type<>'official_directory'
    and registration_status='approved'
  )
);

grant usage on schema public,gis to anon,authenticated;
grant select on public.stations to anon,authenticated;
grant usage on type public.station_status to anon,authenticated;

insert into public.stations (
  id,name,address,city,state,latitude,longitude,
  location_precision,record_source_type,
  registration_status,publication_status,location
)
select
  ('00000000-0000-0000-0000-' ||
    lpad(n::text,12,'0'))::uuid,
  station_name,'Test fixture','Lagos','Lagos',
  lat,lon,precision,source,registration,publication,
  gis.st_setsrid(
    gis.st_makepoint(lon,lat),4326
  )::gis.geography
from (
  values
  (1,'Approved near start',6.500,3.400,'exact',
   'operator','approved','published'),
  (2,'Published directory middle',6.600,3.400,'approximate',
   'official_directory','pending','published'),
  (3,'Approved near end',6.700,3.400,'exact',
   'operator','approved','published'),
  (4,'Unpublished directory',6.550,3.400,'exact',
   'official_directory','pending','eligible'),
  (5,'Unconfirmed directory',6.650,3.400,'unconfirmed',
   'official_directory','pending','published'),
  (6,'Unapproved operator',6.575,3.400,'exact',
   'operator','pending','unreviewed'),
  (7,'Outside corridor',7.500,3.400,'exact',
   'operator','approved','published')
) as v(
  n,station_name,lat,lon,precision,
  source,registration,publication
);
