\set ON_ERROR_STOP on

set role service_role;

delete from public.trip_rate_limit_counters;

reset role;
