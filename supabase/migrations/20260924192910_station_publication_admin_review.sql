-- CNGx publication admin-review workflow. This migration is designed for later application.
-- It does not introduce a publish action or change public-read RLS.

create table public.station_publication_reviews (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete cascade,
  previous_status text not null,
  new_status text not null,
  reviewer_id uuid not null,
  notes text,
  created_at timestamp with time zone not null default now(),
  constraint station_publication_reviews_previous_status_check
    check (previous_status in ('unreviewed', 'eligible', 'published', 'withheld')),
  constraint station_publication_reviews_new_status_check
    check (new_status in ('unreviewed', 'eligible', 'published', 'withheld')),
  constraint station_publication_reviews_notes_length_check
    check (notes is null or char_length(notes) <= 2000)
);

alter table public.station_publication_reviews enable row level security;

revoke all on table public.station_publication_reviews from public, anon, authenticated;
grant select on table public.station_publication_reviews to authenticated;

create policy station_publication_reviews_admin_select
on public.station_publication_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

create or replace function public.admin_review_station_registration(
  p_station_id uuid,
  p_approve boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;

  if exists (
    select 1
    from public.stations
    where id = p_station_id
      and record_source_type = 'official_directory'
  ) then
    raise exception 'Official-directory stations require the publication review workflow.';
  end if;

  if p_approve then
    update public.stations
    set registration_status = 'approved',
        is_verified = true,
        claimed_by = submitted_by,
        last_verified_at = now()
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
        is_verified = false
    where id = p_station_id
      and registration_status = 'pending';
  end if;
end;
$$;

create or replace function public.admin_review_station_publication(
  p_station_id uuid,
  p_decision text,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_status text;
  v_notes text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;

  if p_decision not in ('eligible', 'withheld', 'unreviewed') then
    raise exception 'Invalid publication review decision';
  end if;

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'Review notes must be 2000 characters or fewer';
  end if;

  if p_decision = 'withheld' and v_notes is null then
    raise exception 'A reason is required when withholding a station';
  end if;

  select publication_status
    into v_previous_status
  from public.stations
  where id = p_station_id
    and record_source_type = 'official_directory'
  for update;

  if not found then
    raise exception 'Official-directory station not found';
  end if;

  if p_decision = 'unreviewed' then
    update public.stations
    set publication_status = 'unreviewed',
        publication_reviewed_at = null
    where id = p_station_id;
  else
    update public.stations
    set publication_status = p_decision,
        publication_reviewed_at = now()
    where id = p_station_id;
  end if;

  insert into public.station_publication_reviews(
    station_id,
    previous_status,
    new_status,
    reviewer_id,
    notes
  ) values (
    p_station_id,
    v_previous_status,
    p_decision,
    auth.uid(),
    v_notes
  );
end;
$$;

revoke all on function public.admin_review_station_publication(uuid, text, text) from public, anon;
grant execute on function public.admin_review_station_publication(uuid, text, text) to authenticated;
