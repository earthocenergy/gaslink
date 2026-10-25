\set ON_ERROR_STOP on

-- ============================================================
-- CNGx F2-03 production-compatible sanitized baseline
--
-- TEST-ONLY / NONCANONICAL.
--
-- This is NOT a reconstruction of the 23 unavailable historical
-- production migration sources. It models only the verified current
-- production schema/contracts required to validate the pending forward
-- migrations and authenticated/RLS security boundaries.
--
-- No production data, Candidate A/B identifiers, credentials or PII.
-- ============================================================

-- Supabase's Postgres image already provides:
--   * auth schema
--   * auth.users
--   * auth.uid()
--   * anon / authenticated / service_role
--
-- F2 reuses those built-in contracts rather than recreating or taking
-- ownership of Supabase-managed Auth objects.

create schema if not exists gis;

create extension if not exists postgis with schema gis;

create type public.app_role as enum (
  'driver',
  'operator',
  'admin'
);

create type public.station_status as enum (
  'available',
  'low_supply',
  'out_of_gas',
  'offline',
  'unknown'
);

create type public.claim_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.profiles (
  id uuid primary key
    references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'driver',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null
    references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  operator_name text,
  address text not null,
  city text,
  state text,

  latitude double precision,
  longitude double precision,

  status public.station_status not null default 'unknown',
  price_per_scm numeric,
  queue_minutes integer,
  open_now boolean,
  opening_hours text,
  vehicle_compatibility text[],

  is_demo boolean not null default false,
  is_verified boolean not null default false,
  claimed_by uuid
    references auth.users(id) on delete set null,
  last_verified_at timestamptz,

  registration_status text not null default 'approved',
  submitted_by uuid
    references auth.users(id) on delete set null,

  phone text,
  email text,

  record_source_type text not null default 'other',
  record_source_name text,
  record_source_url text,
  record_source_reference text,
  record_source_observed_at timestamptz,

  location_precision text not null default 'unconfirmed',
  location_source_type text,
  location_source_name text,
  location_source_url text,
  location_source_observed_at timestamptz,

  status_updated_at timestamptz,
  price_updated_at timestamptz,
  queue_updated_at timestamptz,

  location gis.geography(Point,4326),

  publication_status text not null default 'unreviewed',
  publication_reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stations_registration_status_check
    check (
      registration_status in (
        'pending',
        'approved',
        'rejected'
      )
    ),

  constraint stations_price_nonnegative
    check (
      price_per_scm is null
      or price_per_scm >= 0
    ),

  constraint stations_queue_nonnegative
    check (
      queue_minutes is null
      or queue_minutes >= 0
    )
);

create table public.station_claims (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null
    references public.stations(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  status public.claim_status not null default 'pending',
  business_name text,
  phone text,
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (station_id, user_id)
);

create table public.station_reports (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null
    references public.stations(id) on delete cascade,
  user_id uuid not null
    references auth.users(id) on delete cascade,
  status public.station_status,
  price_per_scm numeric,
  queue_minutes integer,
  note text,
  is_moderated boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.stations enable row level security;
alter table public.station_claims enable row level security;
alter table public.station_reports enable row level security;

-- Match current production profiles self-read posture. This is required
-- for authenticated admin checks that inspect the caller's own profile.
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
);

-- Current pre-trust operator mutation posture. The trust migration must
-- remove this broad raw UPDATE path.
create policy stations_operator_update
on public.stations
for update
to authenticated
using (
  claimed_by = (select auth.uid())
)
with check (
  claimed_by = (select auth.uid())
);

create policy stations_public_read
on public.stations
for select
to anon, authenticated
using (
  (
    record_source_type = 'official_directory'
    and publication_status = 'published'
  )
  or
  (
    record_source_type <> 'official_directory'
    and registration_status = 'approved'
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

create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'::public.app_role
  )
);

grant usage on schema public, gis
to anon, authenticated, service_role;

grant usage on type
  public.app_role,
  public.station_status,
  public.claim_status
to anon, authenticated, service_role;

grant select on public.profiles
to authenticated;

grant select on public.user_roles
to authenticated;

grant select, insert, update on public.stations
to authenticated;

grant select, insert, update on public.station_claims
to authenticated;

grant select, insert, update on public.station_reports
to authenticated;

grant all on public.profiles to service_role;
grant all on public.user_roles to service_role;
grant all on public.stations to service_role;
grant all on public.station_claims to service_role;
grant all on public.station_reports to service_role;
