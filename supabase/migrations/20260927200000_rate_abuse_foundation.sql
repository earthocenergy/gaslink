begin;

create table if not exists public.abuse_write_events (
  id bigint generated always as identity primary key,
  action text not null,
  user_id uuid null references auth.users(id) on delete set null,
  network_key text null,
  duplicate_key text null,
  decision text not null check (decision in ('allowed','rejected')),
  reason text null check (
    reason is null
    or reason in ('rate_limited','duplicate','temporarily_blocked')
  ),
  retry_after_seconds integer null check (
    retry_after_seconds is null or retry_after_seconds >= 0
  ),
  created_at timestamptz not null default now()
);

create index if not exists abuse_write_events_user_action_created_idx
  on public.abuse_write_events (user_id, action, created_at desc);

create index if not exists abuse_write_events_network_action_created_idx
  on public.abuse_write_events (network_key, action, created_at desc);

create index if not exists abuse_write_events_duplicate_action_created_idx
  on public.abuse_write_events (duplicate_key, action, created_at desc);

alter table public.abuse_write_events enable row level security;

revoke all on table public.abuse_write_events from anon;
revoke all on table public.abuse_write_events from authenticated;

create or replace function public.check_write_abuse(
  p_action text,
  p_network_key text,
  p_duplicate_key text
)
returns table (
  allowed boolean,
  reason text,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_recent_user integer;
  v_recent_network integer;
  v_recent_burst integer;
  v_duplicate_exists boolean;
begin
  if v_user is null then
    return query select false, 'temporarily_blocked'::text, 0;
    return;
  end if;

  if p_action not in (
    'station_report',
    'station_claim',
    'station_registration',
    'marketplace_listing',
    'marketplace_enquiry',
    'provider_onboarding',
    'service_offering',
    'service_enquiry',
    'business_enquiry'
  ) then
    return query select false, 'temporarily_blocked'::text, 0;
    return;
  end if;

  /*
   * Conservative foundation limits only.
   * These are staging defaults, not production-tuned thresholds.
   */

  select count(*)
  into v_recent_burst
  from public.abuse_write_events
  where user_id = v_user
    and action = p_action
    and decision = 'allowed'
    and created_at >= now() - interval '5 seconds';

  if v_recent_burst >= 4 then
    insert into public.abuse_write_events (
      action, user_id, network_key, duplicate_key,
      decision, reason, retry_after_seconds
    )
    values (
      p_action, v_user, p_network_key, p_duplicate_key,
      'rejected', 'rate_limited', 5
    );

    return query select false, 'rate_limited'::text, 5;
    return;
  end if;
  select count(*)
  into v_recent_user
  from public.abuse_write_events
  where user_id = v_user
    and action = p_action
    and decision = 'allowed'
    and created_at >= now() - interval '1 minute';

  if v_recent_user >= 12 then
    insert into public.abuse_write_events (
      action, user_id, network_key, duplicate_key,
      decision, reason, retry_after_seconds
    )
    values (
      p_action, v_user, p_network_key, p_duplicate_key,
      'rejected', 'rate_limited', 60
    );

    return query select false, 'rate_limited'::text, 60;
    return;
  end if;

  select count(*)
  into v_recent_network
  from public.abuse_write_events
  where network_key = p_network_key
    and action = p_action
    and decision = 'allowed'
    and created_at >= now() - interval '1 minute';

  if v_recent_network >= 30 then
    insert into public.abuse_write_events (
      action, user_id, network_key, duplicate_key,
      decision, reason, retry_after_seconds
    )
    values (
      p_action, v_user, p_network_key, p_duplicate_key,
      'rejected', 'rate_limited', 60
    );

    return query select false, 'rate_limited'::text, 60;
    return;
  end if;

  select exists (
    select 1
    from public.abuse_write_events
    where user_id = v_user
      and action = p_action
      and duplicate_key = p_duplicate_key
      and decision = 'allowed'
      and created_at >= now() - interval '90 seconds'
  )
  into v_duplicate_exists;

  if v_duplicate_exists then
    insert into public.abuse_write_events (
      action, user_id, network_key, duplicate_key,
      decision, reason, retry_after_seconds
    )
    values (
      p_action, v_user, p_network_key, p_duplicate_key,
      'rejected', 'duplicate', 90
    );

    return query select false, 'duplicate'::text, 90;
    return;
  end if;

  insert into public.abuse_write_events (
    action, user_id, network_key, duplicate_key,
    decision
  )
  values (
    p_action, v_user, p_network_key, p_duplicate_key,
    'allowed'
  );

  return query select true, null::text, null::integer;
end;
$$;

revoke all on function public.check_write_abuse(text,text,text) from public;
revoke all on function public.check_write_abuse(text,text,text) from anon;
grant execute on function public.check_write_abuse(text,text,text) to authenticated;

commit;
