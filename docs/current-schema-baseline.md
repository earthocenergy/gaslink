# CNGx authoritative current schema baseline — 2026-09-26

This is the L1 authoritative **baseline manifest** for production project `knhrgugextsmisyxzdgc`. It must not be applied over production and contains no production rows, auth users, secrets or PII.

## Baseline composition

The current schema is represented by these source-controlled layers:

1. `supabase/baseline/2026-09-21-public-schema.sql` — the inspected pre-geospatial public-schema snapshot.
2. `docs/database-baseline.md` — the inspected 2026-09-21 constraints, RLS, RPC, trigger and historical-ledger context.
3. Forward repository migrations from `20260921125805` through production head `20260926014037`.
4. `docs/production-migration-ledger.json` — authoritative production migration versions/names.
5. `docs/rpc-surface-review.md` — current SECURITY DEFINER caller/privilege classification.

## Current production shape

Public RLS-enabled tables: `profiles`, `stations`, `station_reports`, `station_claims`, `search_events`, `marketplace_sellers`, `marketplace_listings`, `marketplace_enquiries`, `service_providers`, `service_offerings`, `service_enquiries`, `business_enquiries`, `user_roles`, `station_publication_reviews`.

The production `stations` table includes the geospatial/provenance/freshness/publication columns introduced after the original baseline, including `record_source_*`, `location_precision`, `location_source_*`, `status_updated_at`, `price_updated_at`, `queue_updated_at`, PostGIS `location geography`, `publication_status`, and `publication_reviewed_at`.

Installed extensions required by the application schema include `postgis` in schema `gis` and `pgcrypto` in `extensions`; production also has platform-managed extensions such as `uuid-ossp`, `pg_stat_statements`, `supabase_vault`, and `plpgsql` installed.

Current application triggers include profile-role protection, marketplace/provider role sync, station operational-freshness stamping, and station geography synchronization. Auth-user bootstrap triggers are documented in `docs/database-baseline.md`.

Current RLS predicates were re-inspected during L1. The L1 migration replaces `station_publication_reviews_admin_select` with the equivalent admin predicate using `(select auth.uid())` and adds `station_publication_reviews_station_id_idx`.

## Executable-dump gate

The repository still does **not** contain a freshly generated executable, schema-only Supabase dump of the whole current database. The connected management tooling can inspect schema metadata but does not expose `supabase db dump` output. Therefore clean reconstruction is not declared PASS from this manifest alone.

Before L1 can close, from an authorized workstation/CI identity run a schema-only dump using current Supabase CLI tooling, excluding application data/auth-user rows, review it for secrets/PII, store the sanitized baseline under `supabase/baseline/`, and prove it by restoring/bootstraping an isolated non-production database. Compare tables, columns, constraints, indexes, functions/RPCs, triggers, RLS enablement/policies, extensions/PostGIS and migration head.

Historical migration gaps must not be fabricated. A verified current baseline is the cutover point; existing production continues with forward-only migrations.
