begin;

-- ============================================================
-- CNGx trust-contract hardening
-- Forward migration only. L1C staging first; not applied by L1B-T.
-- ============================================================

-- Moderation has its own review timestamp. It is not verification.
alter table public.station_reports
  add column if not exists moderated_at timestamptz;

-- ============================================================
-- Immutable operator operational-update audit
-- ============================================================

create table if not exists public.station_operator_update_audit (
  id bigint generated always as identity primary key,
  station_id uuid not null,
  actor_user_id uuid not null,
  changed_fields text[] not null,
  before_values jsonb not null,
  after_values jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.station_operator_update_audit enable row level security;

drop policy if exists station_operator_update_audit_admin_select
  on public.station_operator_update_audit;

create policy station_operator_update_audit_admin_select
on public.station_operator_update_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

revoke all on table public.station_operator_update_audit
from public, anon, authenticated;

grant select on table public.station_operator_update_audit
to authenticated;

grant all on table public.station_operator_update_audit
to service_role;

-- ============================================================
-- Immutable CNGx verification audit
-- ============================================================

create table if not exists public.station_verification_audit (
  id bigint generated always as identity primary key,
  station_id uuid not null,
  actor_user_id uuid not null,
  previous_verified boolean not null,
  previous_last_verified_at timestamptz,
  new_verified boolean not null,
  new_last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.station_verification_audit enable row level security;

drop policy if exists station_verification_audit_admin_select
  on public.station_verification_audit;

create policy station_verification_audit_admin_select
on public.station_verification_audit
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  )
);

revoke all on table public.station_verification_audit
from public, anon, authenticated;

grant select on table public.station_verification_audit
to authenticated;

grant all on table public.station_verification_audit
to service_role;

-- ============================================================
-- Registration approval != CNGx verification
-- ============================================================

create or replace function public.admin_review_station_registration(
  p_station_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;

  if exists (
    select 1
    from public.stations
    where id = p_station_id
      and record_source_type = 'official_directory'
  ) then
    raise exception
      'Official-directory stations require the publication review workflow.';
  end if;

  if p_approve then
    update public.stations
    set registration_status = 'approved',
        claimed_by = submitted_by,
        updated_at = now()
    where id = p_station_id
      and registration_status = 'pending';

    insert into public.user_roles(user_id, role)
    select submitted_by, 'operator'
    from public.stations
    where id = p_station_id
      and submitted_by is not null
    on conflict do nothing;
  else
    update public.stations
    set registration_status = 'rejected',
        updated_at = now()
    where id = p_station_id
      and registration_status = 'pending';
  end if;
end;
$$;

-- Historical compatibility RPC is also made trust-safe even though
-- authenticated EXECUTE was already revoked during L1.
create or replace function public.approve_station_registration(
  p_station_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  s public.stations;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'admin required';
  end if;

  select *
  into s
  from public.stations
  where id = p_station_id
  for update;

  if s.id is null then
    raise exception 'station not found';
  end if;

  update public.stations
  set registration_status =
        case when p_approve then 'approved' else 'rejected' end,
      claimed_by =
        case when p_approve then submitted_by else claimed_by end,
      updated_at = now()
  where id = p_station_id;

  if p_approve and s.submitted_by is not null then
    update public.profiles
    set role = 'operator',
        updated_at = now()
    where id = s.submitted_by
      and role = 'driver';
  end if;
end;
$$;

-- Keep obsolete compatibility RPC off the normal authenticated surface.
revoke all on function
  public.approve_station_registration(uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.approve_station_registration(uuid, boolean)
to service_role;

-- ============================================================
-- Claim approval != CNGx verification
-- ============================================================

create or replace function public.approve_station_claim(
  p_claim_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  c public.station_claims;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'admin required';
  end if;

  select *
  into c
  from public.station_claims
  where id = p_claim_id
  for update;

  if c.id is null then
    raise exception 'claim not found';
  end if;

  update public.station_claims
  set status =
        case
          when p_approve then 'approved'::public.claim_status
          else 'rejected'::public.claim_status
        end,
      reviewed_at = now()
  where id = c.id;

  if p_approve then
    update public.stations
    set claimed_by = c.user_id,
        updated_at = now()
    where id = c.station_id;

    update public.profiles
    set role = 'operator',
        updated_at = now()
    where id = c.user_id;
  end if;
end;
$$;

revoke all on function
  public.approve_station_claim(uuid, boolean)
from public, anon;

grant execute on function
  public.approve_station_claim(uuid, boolean)
to authenticated;

-- ============================================================
-- Community moderation != CNGx verification
-- ============================================================

create or replace function public.admin_moderate_station_report(
  p_report_id uuid,
  p_apply boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r public.station_reports%rowtype;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;

  select *
  into r
  from public.station_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Report not found';
  end if;

  update public.station_reports
  set is_moderated = true,
      moderated_at = now()
  where id = p_report_id;

  if p_apply then
    update public.stations
    set status = coalesce(r.status, status),
        price_per_scm = coalesce(r.price_per_scm, price_per_scm),
        queue_minutes = coalesce(r.queue_minutes, queue_minutes),
        updated_at = now()
    where id = r.station_id;
  end if;
end;
$$;

revoke all on function
  public.admin_moderate_station_report(uuid, boolean)
from public, anon;

grant execute on function
  public.admin_moderate_station_report(uuid, boolean)
to authenticated;

-- ============================================================
-- Remove raw owner-scoped station UPDATE authority
-- ============================================================

drop policy if exists stations_operator_update on public.stations;

revoke update on table public.stations
from anon, authenticated;

-- ============================================================
-- Field-restricted operational update boundary
-- ============================================================

create or replace function public.operator_update_station_operational(
  p_station_id uuid,
  p_status public.station_status,
  p_price_per_scm numeric,
  p_queue_minutes integer,
  p_opening_hours text,
  p_open_now boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_station public.stations%rowtype;
  v_is_admin boolean;
  v_changed text[] := array[]::text[];
  v_before jsonb;
  v_after jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_station
  from public.stations
  where id = p_station_id
  for update;

  if not found then
    raise exception 'Station not found';
  end if;

  select exists (
    select 1
    from public.profiles
    where id = v_user
      and role = 'admin'
  )
  into v_is_admin;

  if not v_is_admin
     and v_station.claimed_by is distinct from v_user then
    raise exception 'Operator access required';
  end if;

  if p_status is null then
    raise exception 'Operational status is required';
  end if;

  if p_price_per_scm is not null and p_price_per_scm < 0 then
    raise exception 'Price cannot be negative';
  end if;

  if p_queue_minutes is not null and p_queue_minutes < 0 then
    raise exception 'Queue cannot be negative';
  end if;

  v_before := jsonb_build_object(
    'status', v_station.status,
    'price_per_scm', v_station.price_per_scm,
    'queue_minutes', v_station.queue_minutes,
    'opening_hours', v_station.opening_hours,
    'open_now', v_station.open_now
  );

  if v_station.status is distinct from p_status then
    v_changed := array_append(v_changed, 'status');
  end if;

  if v_station.price_per_scm is distinct from p_price_per_scm then
    v_changed := array_append(v_changed, 'price_per_scm');
  end if;

  if v_station.queue_minutes is distinct from p_queue_minutes then
    v_changed := array_append(v_changed, 'queue_minutes');
  end if;

  if v_station.opening_hours is distinct from p_opening_hours then
    v_changed := array_append(v_changed, 'opening_hours');
  end if;

  if v_station.open_now is distinct from p_open_now then
    v_changed := array_append(v_changed, 'open_now');
  end if;

  update public.stations
  set status = p_status,
      price_per_scm = p_price_per_scm,
      queue_minutes = p_queue_minutes,
      opening_hours = p_opening_hours,
      open_now = p_open_now,
      updated_at = now()
  where id = p_station_id;

  v_after := jsonb_build_object(
    'status', p_status,
    'price_per_scm', p_price_per_scm,
    'queue_minutes', p_queue_minutes,
    'opening_hours', p_opening_hours,
    'open_now', p_open_now
  );

  if cardinality(v_changed) > 0 then
    insert into public.station_operator_update_audit(
      station_id,
      actor_user_id,
      changed_fields,
      before_values,
      after_values
    )
    values (
      p_station_id,
      v_user,
      v_changed,
      v_before,
      v_after
    );
  end if;
end;
$$;

revoke all on function
  public.operator_update_station_operational(
    uuid,
    public.station_status,
    numeric,
    integer,
    text,
    boolean
  )
from public, anon;

grant execute on function
  public.operator_update_station_operational(
    uuid,
    public.station_status,
    numeric,
    integer,
    text,
    boolean
  )
to authenticated;

-- ============================================================
-- Explicit independent CNGx verification boundary
-- ============================================================

create or replace function public.admin_set_station_verification(
  p_station_id uuid,
  p_verified boolean
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_station public.stations%rowtype;
  v_new_verified_at timestamptz;
begin
  if v_user is null
     or not exists (
       select 1
       from public.profiles
       where id = v_user
         and role = 'admin'
     ) then
    raise exception 'Admin only';
  end if;

  select *
  into v_station
  from public.stations
  where id = p_station_id
  for update;

  if not found then
    raise exception 'Station not found';
  end if;

  if p_verified then
    v_new_verified_at := now();
  else
    v_new_verified_at := null;
  end if;

  update public.stations
  set is_verified = p_verified,
      last_verified_at = v_new_verified_at,
      updated_at = now()
  where id = p_station_id;

  insert into public.station_verification_audit(
    station_id,
    actor_user_id,
    previous_verified,
    previous_last_verified_at,
    new_verified,
    new_last_verified_at
  )
  values (
    p_station_id,
    v_user,
    v_station.is_verified,
    v_station.last_verified_at,
    p_verified,
    v_new_verified_at
  );
end;
$$;

revoke all on function
  public.admin_set_station_verification(uuid, boolean)
from public, anon;

grant execute on function
  public.admin_set_station_verification(uuid, boolean)
to authenticated;

comment on function
  public.operator_update_station_operational(
    uuid,
    public.station_status,
    numeric,
    integer,
    text,
    boolean
  )
is
  'Field-restricted CNGx operator mutation boundary. Does not confer or refresh CNGx verification.';

comment on function
  public.admin_set_station_verification(uuid, boolean)
is
  'Explicit admin-only CNGx station verification/unverification boundary.';

commit;
