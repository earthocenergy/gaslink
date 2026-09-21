-- CNGx Phase 1 isolated-database test harness.
-- NEVER run against production. Run only after applying the Phase 1 migration to an isolated Supabase branch/local DB.
begin;

do $$ begin
  if exists(select 1 from pg_extension where extname='postgis' and extnamespace='public'::regnamespace) then raise exception 'PostGIS must not be in public'; end if;
  if not exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='postgis' and n.nspname='gis') then raise exception 'PostGIS missing from gis'; end if;
  if has_schema_privilege('anon','gis','CREATE') or has_schema_privilege('authenticated','gis','CREATE') then raise exception 'application role has CREATE on gis'; end if;
  if not has_schema_privilege('anon','gis','USAGE') or not has_schema_privilege('authenticated','gis','USAGE') then raise exception 'GIS USAGE missing'; end if;
  if has_function_privilege('anon','public.sync_station_geography()','EXECUTE') or has_function_privilege('authenticated','public.sync_station_geography()','EXECUTE') then raise exception 'sync trigger directly executable'; end if;
  if has_function_privilege('anon','public.stamp_station_operational_freshness()','EXECUTE') or has_function_privilege('authenticated','public.stamp_station_operational_freshness()','EXECUTE') then raise exception 'freshness trigger directly executable'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='nearby_stations' and p.prosecdef) then raise exception 'nearby_stations must remain SECURITY INVOKER'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='user_roles' and policyname='users add own ordinary roles' and with_check like '%driver%' and with_check like '%buyer%' and with_check not like '%seller%' and with_check not like '%operator%' and with_check not like '%service_provider%' and with_check not like '%admin%') then raise exception 'Phase 0 user_roles self-assignment boundary changed'; end if;
end $$;

insert into public.stations(id,name,address,state,latitude,longitude,is_demo,is_verified,registration_status,record_source_type,location_precision)
values
('30000000-0000-0000-0000-000000000001','CNGx Geo QA Near','Geo QA 1','QA',0,0,false,false,'approved','admin','exact'),
('30000000-0000-0000-0000-000000000002','CNGx Geo QA Mid','Geo QA 2','QA',0,0.01,false,false,'approved','admin','exact'),
('30000000-0000-0000-0000-000000000003','CNGx Geo QA Far','Geo QA 3','QA',0,0.03,false,false,'approved','admin','exact'),
('30000000-0000-0000-0000-000000000004','CNGx Geo QA Private','Geo QA 4','QA',0,0.005,false,false,'rejected','admin','exact');

do $$ begin
  if (select location is null from public.stations where id='30000000-0000-0000-0000-000000000001') then raise exception 'valid coordinates did not generate geography'; end if;
end $$;

update public.stations set location=gis.st_setsrid(gis.st_makepoint(40,40),4326)::gis.geography where id='30000000-0000-0000-0000-000000000001';
do $$ begin
  if (select gis.st_distance(location,gis.st_setsrid(gis.st_makepoint(longitude,latitude),4326)::gis.geography)>0.01 from public.stations where id='30000000-0000-0000-0000-000000000001') then raise exception 'location diverged from lat/lon'; end if;
end $$;

do $$ begin
  begin insert into public.stations(name,address,latitude,longitude) values('bad lat','qa',91,0); raise exception 'invalid latitude accepted'; exception when check_violation then null; end;
  begin insert into public.stations(name,address,latitude,longitude) values('bad lon','qa',0,181); raise exception 'invalid longitude accepted'; exception when check_violation then null; end;
  begin insert into public.stations(name,address,latitude,longitude) values('bad pair','qa',0,null); raise exception 'partial coordinate pair accepted'; exception when check_violation then null; end;
end $$;

update public.stations set phone='unrelated' where id='30000000-0000-0000-0000-000000000001';
do $$ begin
 if exists(select 1 from public.stations where id='30000000-0000-0000-0000-000000000001' and (status_updated_at is not null or price_updated_at is not null or queue_updated_at is not null)) then raise exception 'unrelated update refreshed operational timestamp'; end if;
end $$;
update public.stations set status='available' where id='30000000-0000-0000-0000-000000000001';
update public.stations set price_per_scm=500 where id='30000000-0000-0000-0000-000000000001';
update public.stations set queue_minutes=7 where id='30000000-0000-0000-0000-000000000001';
do $$ begin
 if exists(select 1 from public.stations where id='30000000-0000-0000-0000-000000000001' and (status_updated_at is null or price_updated_at is null or queue_updated_at is null)) then raise exception 'operational freshness stamp missing'; end if;
end $$;

do $$ begin
 if (select id from public.nearby_stations(0,0,null,3) limit 1) <> '30000000-0000-0000-0000-000000000001'::uuid then raise exception 'nearest ordering incorrect'; end if;
 if (select count(*) from public.nearby_stations(0,0,1500,100)) < 2 then raise exception 'radius omitted expected stations'; end if;
 if exists(select 1 from public.nearby_stations(0,0,1500,100) where id='30000000-0000-0000-0000-000000000003') then raise exception 'radius included far station'; end if;
 if (select count(*) from public.nearby_stations(0,0,null,1)) <> 1 then raise exception 'limit incorrect'; end if;
end $$;

set local role anon;
do $$ begin
 if not exists(select 1 from public.nearby_stations(0,0,2000,100) where id='30000000-0000-0000-0000-000000000001') then raise exception 'anon cannot see approved station / GIS RPC failed'; end if;
 if exists(select 1 from public.nearby_stations(0,0,2000,100) where id='30000000-0000-0000-0000-000000000004') then raise exception 'anon saw rejected station'; end if;
 if exists(select 1 from public.stations where id='30000000-0000-0000-0000-000000000004') then raise exception 'station RLS exposed rejected row'; end if;
end $$;
reset role;

rollback;
