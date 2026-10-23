\set ON_ERROR_STOP on

do $$
declare
  fn oid :=
    'public.trip_route_corridor_stations(text,double precision,integer)'::regprocedure;
begin
  if not exists (
    select 1 from pg_proc
    where oid=fn and prosecdef=false
  ) then
    raise exception 'SECURITY INVOKER assertion failed';
  end if;

  if not has_function_privilege('anon',fn,'EXECUTE')
     or not has_function_privilege('authenticated',fn,'EXECUTE') then
    raise exception 'Expected execution grant missing';
  end if;

  if exists (
    select 1
    from pg_proc p,
    lateral aclexplode(
      coalesce(p.proacl,acldefault('f',p.proowner))
    ) a
    where p.oid=fn
      and a.grantee=0
      and a.privilege_type='EXECUTE'
  ) then
    raise exception 'Unexpected PUBLIC execute grant';
  end if;

  raise notice 'PASS: invoker security and execute grants';
end $$;

set role anon;

do $$
declare
  route text :=
    '{"type":"LineString","coordinates":[[3.4,6.45],[3.4,6.75]]}';
  actual_names text[];
  actual_progress double precision[];
  actual_distances double precision[];
begin
  select
    array_agg(t.name order by t.route_progress_fraction),
    array_agg(t.route_progress_fraction
      order by t.route_progress_fraction),
    array_agg(t.distance_from_route_meters
      order by t.route_progress_fraction)
  into actual_names,actual_progress,actual_distances
  from public.trip_route_corridor_stations(
    route,10000,100
  ) t;

  if actual_names is distinct from array[
    'Approved near start',
    'Published directory middle',
    'Approved near end'
  ]::text[] then
    raise exception 'Unexpected corridor result: %',actual_names;
  end if;

  if not (
    actual_progress[1] < actual_progress[2]
    and actual_progress[2] < actual_progress[3]
  ) then
    raise exception 'Incorrect route progression';
  end if;

  if exists (
    select 1 from unnest(actual_distances) d
    where d < 0 or d > 10000
  ) then
    raise exception 'Invalid corridor distance';
  end if;

  raise notice 'PASS: visibility, trust, distances and ordering';
end $$;

do $$
declare
  route text :=
    '{"type":"LineString","coordinates":[[3.4,6.45],[3.4,6.75]]}';
  rejected boolean;
begin
  rejected := false;
  begin
    perform public.trip_route_corridor_stations(route,999,100);
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Invalid corridor accepted';
  end if;

  rejected := false;
  begin
    perform public.trip_route_corridor_stations(route,10000,201);
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Invalid limit accepted';
  end if;

  rejected := false;
  begin
    perform public.trip_route_corridor_stations('not json',10000,100);
  exception when others then
    rejected := true;
  end;
  if not rejected then
    raise exception 'Malformed GeoJSON accepted';
  end if;

  raise notice 'PASS: invalid-input rejection';
end $$;

reset role;
