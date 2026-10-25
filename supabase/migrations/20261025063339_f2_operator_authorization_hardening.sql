-- CNGx F2-01 / I3-SEC-001
-- Operator authorization hardening.
--
-- SOURCE ONLY. Do not apply to production under F2.
--
-- Preconditions:
--   20260928193000_trust_contract_hardening.sql
--
-- Security contract:
--   * admin: profiles.role = admin
--   * operator: profiles.role = operator OR user_roles contains operator
--   * non-admin operator must still own the station
--   * station must remain approved for non-admin operational mutation
--   * entitlement revocation takes effect even if claimed_by remains populated
--   * raw authenticated table UPDATE remains revoked

begin;

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
set search_path = 'public', 'pg_temp'
as $$
declare
  v_user uuid := auth.uid();
  v_station public.stations%rowtype;
  v_is_admin boolean := false;
  v_is_operator boolean := false;
  v_changed text[] := array[]::text[];
  v_before jsonb;
  v_after jsonb;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_user
      and p.role = 'admin'::public.app_role
  )
  into v_is_admin;

  select (
    exists (
      select 1
      from public.profiles p
      where p.id = v_user
        and p.role = 'operator'::public.app_role
    )
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_user
        and ur.role = 'operator'
    )
  )
  into v_is_operator;

  if not v_is_admin and not v_is_operator then
    raise exception 'Active operator role required';
  end if;

  select *
  into v_station
  from public.stations
  where id = p_station_id
  for update;

  if not found then
    raise exception 'Station not found';
  end if;

  if not v_is_admin
     and v_station.claimed_by is distinct from v_user then
    raise exception 'Operator access required';
  end if;

  if not v_is_admin
     and v_station.registration_status <> 'approved' then
    raise exception 'Approved station ownership required';
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
  'F2 hardened operational mutation boundary. Requires admin or active operator entitlement; non-admin callers additionally require approved station ownership. Does not confer or refresh CNGx verification.';

commit;
