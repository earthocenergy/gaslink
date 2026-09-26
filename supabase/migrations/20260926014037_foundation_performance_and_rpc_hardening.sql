-- L1 Foundation Lock: safe production foundation hardening.
-- Applied once to production as 20260926014037.
-- No station or publication data mutation.

create index if not exists station_publication_reviews_station_id_idx
  on public.station_publication_reviews(station_id);

drop policy if exists station_publication_reviews_admin_select
  on public.station_publication_reviews;

create policy station_publication_reviews_admin_select
  on public.station_publication_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'admin'::public.app_role
    )
  );

-- Legacy predecessor to admin_review_station_registration. Retain for forensic
-- history/service-role compatibility, but remove end-user RPC exposure.
revoke execute on function public.approve_station_registration(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.approve_station_registration(uuid, boolean)
  to service_role;
