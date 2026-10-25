-- CNGx F2-02 review remediation / I3-SEC-002
--
-- SOURCE ONLY. Do not apply to production under F2.
--
-- Adds restricted cleanup for inactive shared Trip quota counters.
-- The enforcement RPC remains unchanged.
--
-- Retention contract:
--   * rejected requests continue incrementing counters
--   * active one-minute quota windows are never cleaned
--   * cleanup is explicit and service-role only
--   * cleanup failure cannot weaken request enforcement
--   * updated_at index from the original limiter migration supports cleanup

begin;

create or replace function public.cleanup_trip_rate_limit_counters(
  p_older_than interval default interval '1 day'
)
returns integer
language plpgsql
security invoker
set search_path = 'public', 'pg_temp'
as $$
declare
  v_deleted integer;
begin
  if p_older_than is null
     or p_older_than < interval '5 minutes'
     or p_older_than > interval '30 days' then
    raise exception
      'Trip rate-limit cleanup retention must be between 5 minutes and 30 days';
  end if;

  delete from public.trip_rate_limit_counters
  where updated_at <
    clock_timestamp() - p_older_than;

  get diagnostics v_deleted = row_count;

  return v_deleted;
end;
$$;

revoke all on function
  public.cleanup_trip_rate_limit_counters(interval)
from public, anon, authenticated;

grant execute on function
  public.cleanup_trip_rate_limit_counters(interval)
to service_role;

comment on function
  public.cleanup_trip_rate_limit_counters(interval)
is
  'F2 Trip limiter maintenance. Deletes only inactive fingerprint counters older than the supplied retention interval; service-role only. Minimum retention is five minutes.';

commit;
