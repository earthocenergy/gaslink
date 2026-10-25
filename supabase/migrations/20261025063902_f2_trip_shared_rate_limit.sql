-- CNGx F2-02 / I3-SEC-002
-- Shared, atomic Trip Intelligence quota enforcement.
--
-- SOURCE ONLY. Do not apply to production under F2.
--
-- Security:
--   * shared Postgres state; safe across multiple application instances
--   * RPC is SECURITY INVOKER
--   * only service_role may execute
--   * raw IP addresses are never stored
--   * subject/network keys are server-generated HMAC fingerprints
--   * counters reset atomically at fixed one-minute window boundaries

begin;

create table if not exists public.trip_rate_limit_counters (
  action text not null,
  subject_kind text not null,
  subject_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),

  primary key (
    action,
    subject_kind,
    subject_key
  ),

  constraint trip_rate_limit_action_check
    check (action in ('trip_plan', 'place_resolution')),

  constraint trip_rate_limit_subject_kind_check
    check (subject_kind in ('subject', 'network')),

  constraint trip_rate_limit_subject_key_check
    check (length(subject_key) = 64),

  constraint trip_rate_limit_count_check
    check (request_count >= 0)
);

alter table public.trip_rate_limit_counters
  enable row level security;

revoke all on table public.trip_rate_limit_counters
from public, anon, authenticated;

grant select, insert, update, delete
on table public.trip_rate_limit_counters
to service_role;

create index if not exists
  trip_rate_limit_counters_updated_at_idx
on public.trip_rate_limit_counters(updated_at);

create or replace function public.check_trip_rate_limit_shared(
  p_action text,
  p_subject_key text,
  p_network_key text
)
returns table(
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_window_start timestamptz;
  v_subject_limit integer;
  v_network_limit integer;
  v_subject_count integer;
  v_network_count integer;
  v_retry integer;
begin
  if p_action not in ('trip_plan', 'place_resolution') then
    raise exception 'Unsupported Trip rate-limit action';
  end if;

  if p_subject_key is null
     or length(p_subject_key) <> 64
     or p_subject_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid subject fingerprint';
  end if;

  if p_network_key is null
     or length(p_network_key) <> 64
     or p_network_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid network fingerprint';
  end if;

  v_window_start := date_trunc('minute', clock_timestamp());

  if p_action = 'trip_plan' then
    v_subject_limit := 12;
    v_network_limit := 30;
  else
    v_subject_limit := 60;
    v_network_limit := 120;
  end if;

  insert into public.trip_rate_limit_counters as counter (
    action,
    subject_kind,
    subject_key,
    window_start,
    request_count,
    updated_at
  )
  values (
    p_action,
    'subject',
    p_subject_key,
    v_window_start,
    1,
    clock_timestamp()
  )
  on conflict (action, subject_kind, subject_key)
  do update
  set
    window_start = excluded.window_start,
    request_count =
      case
        when counter.window_start = excluded.window_start
          then counter.request_count + 1
        else 1
      end,
    updated_at = clock_timestamp()
  returning request_count
  into v_subject_count;

  insert into public.trip_rate_limit_counters as counter (
    action,
    subject_kind,
    subject_key,
    window_start,
    request_count,
    updated_at
  )
  values (
    p_action,
    'network',
    p_network_key,
    v_window_start,
    1,
    clock_timestamp()
  )
  on conflict (action, subject_kind, subject_key)
  do update
  set
    window_start = excluded.window_start,
    request_count =
      case
        when counter.window_start = excluded.window_start
          then counter.request_count + 1
        else 1
      end,
    updated_at = clock_timestamp()
  returning request_count
  into v_network_count;

  if v_subject_count > v_subject_limit
     or v_network_count > v_network_limit then

    v_retry := greatest(
      1,
      ceil(
        extract(
          epoch from (
            v_window_start
            + interval '1 minute'
            - clock_timestamp()
          )
        )
      )::integer
    );

    return query
    select false, v_retry;

    return;
  end if;

  return query
  select true, null::integer;
end;
$$;

revoke all on function
  public.check_trip_rate_limit_shared(text, text, text)
from public, anon, authenticated;

grant execute on function
  public.check_trip_rate_limit_shared(text, text, text)
to service_role;

comment on function
  public.check_trip_rate_limit_shared(text, text, text)
is
  'F2 shared atomic Trip quota enforcement. Service-role server caller only. Fingerprints are server-generated HMACs; no raw network identity is persisted.';

comment on table public.trip_rate_limit_counters is
  'F2 shared Trip quota counters. Fixed one-minute windows reset atomically across application instances. Keys are one-way server HMAC fingerprints.';

commit;
