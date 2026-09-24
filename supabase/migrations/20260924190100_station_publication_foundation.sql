-- Establish an explicit CNGx publication state without changing current visibility or RLS.
-- Existing approved non-directory stations retain their existing public meaning as published.
-- Official-directory records remain unreviewed; publication review is a separate future product gate.
alter table public.stations
  add column publication_status text not null default 'unreviewed',
  add column publication_reviewed_at timestamp with time zone,
  add column publication_reviewed_by uuid,
  add column publication_notes text;

alter table public.stations
  add constraint stations_publication_status_check
  check (publication_status in ('unreviewed', 'eligible', 'published', 'withheld'));

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
  'Timestamp of an explicit publication review; null until such review occurs.';
comment on column public.stations.publication_reviewed_by is
  'Optional reviewer UUID recorded by future admin/service workflows; intentionally has no foreign-key dependency in this foundation.';
comment on column public.stations.publication_notes is
  'Non-secret, non-PII publication-review notes only.';
