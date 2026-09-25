-- CNGx controlled official-directory publication foundation.
-- Prepared for later application; this migration is NOT applied by 003F-1.
-- Publication remains independent from registration approval, verification, coordinates and operational freshness.

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

  select publication_status
    into v_previous_status
  from public.stations
  where id = p_station_id
    and record_source_type = 'official_directory'
  for update;

  if not found then
    raise exception 'Official-directory station not found';
  end if;

  if v_previous_status = 'published' then
    raise exception 'Published stations must be unpublished before changing review state.';
  end if;

  if p_decision = 'withheld' and v_notes is null then
    raise exception 'A reason is required when withholding a station';
  end if;

  if v_previous_status = p_decision then
    raise exception 'Station is already in the requested publication state.';
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
    station_id, previous_status, new_status, reviewer_id, notes
  ) values (
    p_station_id, v_previous_status, p_decision, auth.uid(), v_notes
  );
end;
$$;

revoke all on function public.admin_review_station_publication(uuid, text, text) from public, anon;
grant execute on function public.admin_review_station_publication(uuid, text, text) to authenticated;

create or replace function public.admin_publish_station(
  p_station_id uuid,
  p_notes text
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

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is null then
    raise exception 'A publication note is required';
  end if;
  if char_length(v_notes) > 2000 then
    raise exception 'Publication notes must be 2000 characters or fewer';
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

  if v_previous_status <> 'eligible' then
    raise exception 'Only eligible official-directory stations can be published.';
  end if;

  update public.stations
  set publication_status = 'published',
      publication_reviewed_at = now()
  where id = p_station_id;

  insert into public.station_publication_reviews(
    station_id, previous_status, new_status, reviewer_id, notes
  ) values (
    p_station_id, 'eligible', 'published', auth.uid(), v_notes
  );
end;
$$;

revoke all on function public.admin_publish_station(uuid, text) from public, anon;
grant execute on function public.admin_publish_station(uuid, text) to authenticated;

create or replace function public.admin_unpublish_station(
  p_station_id uuid,
  p_notes text
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

  v_notes := nullif(btrim(coalesce(p_notes, '')), '');
  if v_notes is null then
    raise exception 'An unpublish reason is required';
  end if;
  if char_length(v_notes) > 2000 then
    raise exception 'Unpublish notes must be 2000 characters or fewer';
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

  if v_previous_status <> 'published' then
    raise exception 'Only published official-directory stations can be unpublished.';
  end if;

  update public.stations
  set publication_status = 'eligible',
      publication_reviewed_at = now()
  where id = p_station_id;

  insert into public.station_publication_reviews(
    station_id, previous_status, new_status, reviewer_id, notes
  ) values (
    p_station_id, 'published', 'eligible', auth.uid(), v_notes
  );
end;
$$;

revoke all on function public.admin_unpublish_station(uuid, text) from public, anon;
grant execute on function public.admin_unpublish_station(uuid, text) to authenticated;
