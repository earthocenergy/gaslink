\set ON_ERROR_STOP on

-- Synthetic identities only.
insert into auth.users(id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004'),
  ('10000000-0000-0000-0000-000000000005')
on conflict do nothing;

insert into public.profiles(id, role)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'admin'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'operator'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'operator'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'driver'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'driver'
  );

-- Multi-role operator entitlement.
insert into public.user_roles(user_id, role)
values (
  '10000000-0000-0000-0000-000000000005',
  'operator'
);

-- Active profile operator owns approved station.
insert into public.stations(
  id,
  name,
  address,
  city,
  state,
  latitude,
  longitude,
  location,
  location_precision,
  record_source_type,
  registration_status,
  publication_status,
  claimed_by,
  status,
  price_per_scm,
  queue_minutes,
  opening_hours,
  open_now
)
values (
  '20000000-0000-0000-0000-000000000001',
  'F2 Active Operator Station',
  'Synthetic Address',
  'Lagos',
  'Lagos',
  6.5000,
  3.4000,
  gis.st_setsrid(
    gis.st_makepoint(3.4000, 6.5000),
    4326
  )::gis.geography,
  'exact',
  'operator',
  'approved',
  'published',
  '10000000-0000-0000-0000-000000000002',
  'unknown',
  500,
  10,
  '08:00-18:00',
  false
);

-- Caller owns this station but has NO operator entitlement.
insert into public.stations(
  id,
  name,
  address,
  record_source_type,
  registration_status,
  claimed_by
)
values (
  '20000000-0000-0000-0000-000000000002',
  'F2 Revoked Operator Station',
  'Synthetic Address',
  'operator',
  'approved',
  '10000000-0000-0000-0000-000000000004'
);

-- Active operator owns station that is not approved.
insert into public.stations(
  id,
  name,
  address,
  record_source_type,
  registration_status,
  claimed_by
)
values (
  '20000000-0000-0000-0000-000000000003',
  'F2 Pending Operator Station',
  'Synthetic Address',
  'operator',
  'pending',
  '10000000-0000-0000-0000-000000000002'
);

-- Multi-role operator owns approved station.
insert into public.stations(
  id,
  name,
  address,
  record_source_type,
  registration_status,
  claimed_by
)
values (
  '20000000-0000-0000-0000-000000000004',
  'F2 Multi Role Operator Station',
  'Synthetic Address',
  'operator',
  'approved',
  '10000000-0000-0000-0000-000000000005'
);

-- Official directory fixture for corridor query.
insert into public.stations(
  id,
  name,
  address,
  city,
  state,
  latitude,
  longitude,
  location,
  location_precision,
  record_source_type,
  record_source_name,
  registration_status,
  publication_status
)
values (
  '20000000-0000-0000-0000-000000000005',
  'F2 Published Directory Station',
  'Synthetic Directory Address',
  'Lagos',
  'Lagos',
  6.6000,
  3.4000,
  gis.st_setsrid(
    gis.st_makepoint(3.4000, 6.6000),
    4326
  )::gis.geography,
  'approximate',
  'official_directory',
  'Synthetic Directory',
  'pending',
  'published'
);

-- ============================================================
-- Privilege posture
-- ============================================================

do $$
begin
  if has_table_privilege(
    'authenticated',
    'public.stations',
    'UPDATE'
  ) then
    raise exception
      'authenticated raw stations UPDATE still granted';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'stations'
      and policyname = 'stations_operator_update'
  ) then
    raise exception
      'legacy stations_operator_update policy remains';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.operator_update_station_operational(uuid,public.station_status,numeric,integer,text,boolean)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated operator RPC execute missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.check_trip_rate_limit_shared(text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated unexpectedly executes shared Trip limiter';
  end if;

  if has_function_privilege(
    'anon',
    'public.check_trip_rate_limit_shared(text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'anon unexpectedly executes shared Trip limiter';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.check_trip_rate_limit_shared(text,text,text)',
    'EXECUTE'
  ) then
    raise exception
      'service_role Trip limiter execute missing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.cleanup_trip_rate_limit_counters(interval)',
    'EXECUTE'
  ) then
    raise exception
      'authenticated unexpectedly executes Trip limiter cleanup';
  end if;

  if has_function_privilege(
    'anon',
    'public.cleanup_trip_rate_limit_counters(interval)',
    'EXECUTE'
  ) then
    raise exception
      'anon unexpectedly executes Trip limiter cleanup';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.cleanup_trip_rate_limit_counters(interval)',
    'EXECUTE'
  ) then
    raise exception
      'service_role Trip limiter cleanup execute missing';
  end if;

  raise notice 'PASS: privilege and revocation posture';
end
$$;

-- ============================================================
-- Active operator succeeds
-- ============================================================

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  false
);

select public.operator_update_station_operational(
  '20000000-0000-0000-0000-000000000001',
  'available',
  525,
  4,
  '07:00-20:00',
  true
);

reset role;

do $$
declare
  s public.stations%rowtype;
begin
  select *
  into s
  from public.stations
  where id =
    '20000000-0000-0000-0000-000000000001';

  if s.status <> 'available'
     or s.price_per_scm <> 525
     or s.queue_minutes <> 4
     or s.opening_hours <> '07:00-20:00'
     or s.open_now is distinct from true then
    raise exception
      'active operator operational mutation failed';
  end if;

  if s.is_verified
     or s.last_verified_at is not null then
    raise exception
      'operator mutation changed verification state';
  end if;

  raise notice 'PASS: active operator operational update';
end
$$;

-- ============================================================
-- Revoked entitlement must fail despite ownership
-- ============================================================

do $$
declare
  rejected boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000004',
    false
  );

  set local role authenticated;

  begin
    perform public.operator_update_station_operational(
      '20000000-0000-0000-0000-000000000002',
      'available',
      500,
      5,
      '08:00-18:00',
      true
    );
  exception
    when others then
      if sqlerrm like '%Active operator role required%' then
        rejected := true;
      else
        raise;
      end if;
  end;

  reset role;

  if not rejected then
    raise exception
      'ownership without active operator entitlement was accepted';
  end if;

  raise notice
    'PASS: revoked operator entitlement blocks owned station';
end
$$;

-- ============================================================
-- Active but non-owner operator must fail
-- ============================================================

do $$
declare
  rejected boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    false
  );

  set local role authenticated;

  begin
    perform public.operator_update_station_operational(
      '20000000-0000-0000-0000-000000000001',
      'offline',
      1,
      1,
      '00:00-00:01',
      false
    );
  exception
    when others then
      if sqlerrm like '%Operator access required%' then
        rejected := true;
      else
        raise;
      end if;
  end;

  reset role;

  if not rejected then
    raise exception
      'active non-owner operator was accepted';
  end if;

  raise notice 'PASS: non-owner operator rejected';
end
$$;

-- ============================================================
-- Pending owned station must fail
-- ============================================================

do $$
declare
  rejected boolean := false;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    false
  );

  set local role authenticated;

  begin
    perform public.operator_update_station_operational(
      '20000000-0000-0000-0000-000000000003',
      'available',
      500,
      5,
      '08:00-18:00',
      true
    );
  exception
    when others then
      if sqlerrm like '%Approved station ownership required%' then
        rejected := true;
      else
        raise;
      end if;
  end;

  reset role;

  if not rejected then
    raise exception
      'pending owned station was accepted';
  end if;

  raise notice 'PASS: pending owned station rejected';
end
$$;

-- ============================================================
-- Multi-role operator entitlement succeeds
-- ============================================================

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000005',
  false
);

select public.operator_update_station_operational(
  '20000000-0000-0000-0000-000000000004',
  'low_supply',
  515,
  8,
  '06:00-22:00',
  true
);

reset role;

do $$
begin
  if not exists (
    select 1
    from public.stations
    where id =
      '20000000-0000-0000-0000-000000000004'
      and status = 'low_supply'
      and price_per_scm = 515
      and queue_minutes = 8
  ) then
    raise exception
      'multi-role operator entitlement did not work';
  end if;

  raise notice 'PASS: multi-role operator entitlement';
end
$$;

-- ============================================================
-- Audit attribution
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from public.station_operator_update_audit
    where station_id =
      '20000000-0000-0000-0000-000000000001'
      and actor_user_id =
        '10000000-0000-0000-0000-000000000002'
  ) then
    raise exception
      'active operator audit attribution missing';
  end if;

  if not exists (
    select 1
    from public.station_operator_update_audit
    where station_id =
      '20000000-0000-0000-0000-000000000004'
      and actor_user_id =
        '10000000-0000-0000-0000-000000000005'
  ) then
    raise exception
      'multi-role operator audit attribution missing';
  end if;

  raise notice 'PASS: operator audit attribution';
end
$$;

-- ============================================================
-- Trip corridor migration executes under anon/RLS
-- ============================================================

set role anon;

do $$
declare
  route text :=
    '{"type":"LineString","coordinates":[[3.4,6.45],[3.4,6.70]]}';
  names text[];
begin
  select array_agg(
    t.name order by t.route_progress_fraction
  )
  into names
  from public.trip_route_corridor_stations(
    route,
    10000,
    100
  ) t;

  if names is null
     or not (
       'F2 Active Operator Station' = any(names)
     )
     or not (
       'F2 Published Directory Station' = any(names)
     ) then
    raise exception
      'Trip corridor did not preserve public visibility';
  end if;

  raise notice 'PASS: Trip corridor RLS/read contract';
end
$$;

reset role;

-- ============================================================
-- Shared Trip limiter sequential behavior
-- ============================================================

set role service_role;

delete from public.trip_rate_limit_counters;

do $$
declare
  i integer;
  d record;
begin
  for i in 1..12 loop
    select *
    into d
    from public.check_trip_rate_limit_shared(
      'trip_plan',
      repeat('a', 64),
      repeat('b', 64)
    );

    if not d.allowed then
      raise exception
        'Trip subject rejected before request 13';
    end if;
  end loop;

  select *
  into d
  from public.check_trip_rate_limit_shared(
    'trip_plan',
    repeat('a', 64),
    repeat('b', 64)
  );

  if d.allowed
     or d.retry_after_seconds is null
     or d.retry_after_seconds < 1
     or d.retry_after_seconds > 60 then
    raise exception
      'Trip request 13 did not rate-limit correctly';
  end if;

  if (
    select request_count
    from public.trip_rate_limit_counters
    where action = 'trip_plan'
      and subject_kind = 'subject'
      and subject_key = repeat('a', 64)
  ) <> 13 then
    raise exception
      'rejected Trip request did not continue incrementing subject counter';
  end if;

  raise notice
    'PASS: shared Trip subject quota and rejected-request accounting';
end
$$;

delete from public.trip_rate_limit_counters;

do $$
declare
  i integer;
  d record;
  subject_key text;
begin
  for i in 1..30 loop
    subject_key :=
      lpad(i::text, 64, 'a');

    select *
    into d
    from public.check_trip_rate_limit_shared(
      'trip_plan',
      subject_key,
      repeat('c', 64)
    );

    if not d.allowed then
      raise exception
        'Network rejected before request 31';
    end if;
  end loop;

  select *
  into d
  from public.check_trip_rate_limit_shared(
    'trip_plan',
    lpad('31', 64, 'a'),
    repeat('c', 64)
  );

  if d.allowed then
    raise exception
      'Network request 31 was unexpectedly allowed';
  end if;

  raise notice 'PASS: shared Trip network quota';
end
$$;

reset role;

-- ============================================================
-- Trip limiter cleanup / retention contract
-- ============================================================

set role service_role;

delete from public.trip_rate_limit_counters;

insert into public.trip_rate_limit_counters(
  action,
  subject_kind,
  subject_key,
  window_start,
  request_count,
  updated_at
)
values
  (
    'trip_plan',
    'subject',
    repeat('1', 64),
    date_trunc('minute', clock_timestamp() - interval '2 days'),
    9,
    clock_timestamp() - interval '2 days'
  ),
  (
    'trip_plan',
    'subject',
    repeat('2', 64),
    date_trunc('minute', clock_timestamp()),
    3,
    clock_timestamp()
  );

do $$
declare
  deleted_count integer;
  rejected boolean := false;
begin
  select public.cleanup_trip_rate_limit_counters()
  into deleted_count;

  if deleted_count <> 1 then
    raise exception
      'Trip limiter cleanup deleted unexpected row count: %',
      deleted_count;
  end if;

  if exists (
    select 1
    from public.trip_rate_limit_counters
    where subject_key = repeat('1', 64)
  ) then
    raise exception
      'stale Trip limiter counter survived cleanup';
  end if;

  if not exists (
    select 1
    from public.trip_rate_limit_counters
    where subject_key = repeat('2', 64)
      and request_count = 3
  ) then
    raise exception
      'active Trip limiter counter was removed by cleanup';
  end if;

  begin
    perform public.cleanup_trip_rate_limit_counters(
      interval '1 minute'
    );
  exception
    when others then
      if sqlerrm like
        '%cleanup retention must be between 5 minutes and 30 days%'
      then
        rejected := true;
      else
        raise;
      end if;
  end;

  if not rejected then
    raise exception
      'unsafe Trip limiter cleanup retention was accepted';
  end if;

  raise notice
    'PASS: restricted Trip limiter cleanup and retention contract';
end
$$;

reset role;

-- ============================================================
-- F2-04 demo visibility
-- ============================================================

insert into public.stations(
  id,
  name,
  address,
  record_source_type,
  registration_status,
  publication_status,
  is_demo,
  claimed_by
)
values (
  '20000000-0000-0000-0000-000000000006',
  'F2 Hidden Demo Station',
  'Synthetic Demo Address',
  'demo',
  'approved',
  'published',
  true,
  '10000000-0000-0000-0000-000000000002'
);

set role anon;
select set_config(
  'request.jwt.claim.sub',
  '',
  false
);

do $$
begin
  if exists (
    select 1
    from public.stations
    where id =
      '20000000-0000-0000-0000-000000000006'
  ) then
    raise exception
      'anonymous user can still see demo station';
  end if;

  raise notice
    'PASS: demo station hidden from anonymous discovery';
end
$$;

reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000002',
  false
);

do $$
begin
  if not exists (
    select 1
    from public.stations
    where id =
      '20000000-0000-0000-0000-000000000006'
  ) then
    raise exception
      'claimant lost private access to demo station';
  end if;

  raise notice
    'PASS: claimant private demo access preserved';
end
$$;

reset role;

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  false
);

do $$
begin
  if not exists (
    select 1
    from public.stations
    where id =
      '20000000-0000-0000-0000-000000000006'
  ) then
    raise exception
      'admin lost private access to demo station';
  end if;

  raise notice
    'PASS: admin private demo access preserved';
end
$$;

reset role;
