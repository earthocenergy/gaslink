-- GasLink Phase 0 schema snapshot
-- Applied to dedicated Supabase project knhrgugextsmisyxzdgc.
-- Public tables use RLS. Never commit secret/service-role keys.
create type public.app_role as enum ('driver','operator','admin');
create type public.station_status as enum ('available','low_supply','out_of_gas','offline','unknown');
create type public.claim_status as enum ('pending','approved','rejected');
-- Runtime schema includes profiles, stations, station_reports, station_claims and search_events.
-- This repository snapshot is intentionally concise while the live database is the Phase 0 source of truth.
