-- Establish an explicit CNGx publication state without changing current visibility or RLS.
-- Existing approved non-directory stations retain their existing public meaning as published.
-- Official-directory records remain unreviewed and registration-pending until a later publication gate.
alter table public.stations
  add column publication_status text not null default 'unreviewed',
  add column publication_reviewed_at timestamp with time zone;

alter table public.stations
  add constraint stations_publication_status_check
  check (publication_status in ('unreviewed', 'eligible', 'published', 'withheld'));

alter table public.stations
  add constraint stations_official_directory_registration_pending_check
  check (record_source_type <> 'official_directory' or registration_status = 'pending');

update public.stations
set publication_status = 'published'
where record_source_type <> 'official_directory'
  and registration_status = 'approved';

update public.stations
set publication_status = 'unreviewed'
where record_source_type = 'official_directory';

comment on column public.stations.publication_status is
  'Explicit CNGx publication decision: unreviewed, eligible, published, or withheld; separate from registration, verification, coordinates, and operations.';
comment on column public.stations.publication_reviewed_at is
  'Timestamp of an explicit publication review; null until such review occurs or when returned to unreviewed.';
comment on constraint stations_official_directory_registration_pending_check on public.stations is
  'Interim safeguard: official-directory records must remain registration-pending and cannot enter the legacy registration-approval public path.';
