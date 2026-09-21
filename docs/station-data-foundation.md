# CNGx Phase 1 station-data foundation

Captured 2026-09-21 for Prompt 003A. No national directory records were imported into production.

## Official source snapshot

Source: Pi-CNG & EV CNG Refuelling Stations
- Directory: https://pci.gov.ng/refuelling-stations.html
- Network map: https://pci.gov.ng/network-map.html
- Observed headline: 91 stations, 6 geopolitical zones, 23 states.
- Extractable directory records captured: 90.
- Regional total: South-South 14; South-West 29; South-East 3; North-West 11; North-Central 30; North-East 3.

The 91-vs-90 discrepancy is preserved and must not be repaired by inventing a record.

Durable source identity is now `picng-<24 hex chars>`, using the first 96 bits of SHA-256 over the normalized `operator|address|state` tuple. Page order is retained separately as `source_order` for audit only and never participates in identity. No duplicate fingerprints exist in the 90-record snapshot.

A future official correction to operator/address/state can naturally change this fingerprint. Refreshes must reconcile changed identities against prior snapshots/current records rather than blindly treating every changed hash as a new physical station.

The snapshot contains factual directory fields only. Directory inclusion means “listed by Pi-CNG & EV”; it does **not** mean CNGx Verified, currently operational, open, available, price-confirmed, or queue-confirmed.

## Coordinates

Record provenance and coordinate provenance are separate. `record_source_*` says where CNGx learned the station exists; `location_source_*` says where coordinates came from; `location_precision` says how certain those coordinates are.

The official network map states that some pins are approximate. Reliable per-record coordinates were not extractable in this task, so all 90 snapshot records intentionally have null latitude/longitude and `location_precision=unconfirmed`. No address was silently geocoded.

Counts:
- exact: 0
- approximate: 0
- unconfirmed: 90

## Proposed migration

`supabase/migrations/20260921170000_phase1_station_geospatial_foundation.sql` is forward-only and has **not** been applied to production.

It:
- enables PostGIS in dedicated `gis` schema;
- preserves latitude/longitude;
- adds separate record provenance, coordinate provenance and independent operational freshness columns;
- adds coordinate constraints and synchronized geography(Point,4326);
- backfills geography only for existing valid coordinate pairs;
- adds GiST location index and source-reference uniqueness;
- adds an update trigger that timestamps status/price/queue changes independently;
- adds SECURITY INVOKER `nearby_stations` with restricted search_path, coordinate/radius/limit validation, approved-station filtering and PostGIS distance ordering.

`last_verified_at` remains untouched and semantically separate.

## Importer

Run server/admin-side only:

`node scripts/import-station-snapshot.mjs`

Default mode is DRY RUN. Real insertion additionally requires `--apply` and explicit product-lead approval.

The importer prefers server-side `SUPABASE_URL`, with `NEXT_PUBLIC_SUPABASE_URL` only as a backwards-compatible fallback, plus server-only `SUPABASE_SERVICE_ROLE_KEY`. Never expose the latter to browser/client code.

Deduplication order:
1. deterministic `official_directory + source_reference`;
2. normalized operator + address + state fingerprint;
3. source-reference mismatch => conflict;
4. fingerprint match without source reference => possible duplicate, never overwrite;
5. claimed/operator-managed matches are never overwritten.

New directory records are prepared as non-demo, unverified, `registration_status=pending`, status unknown, price/queue/open null, and all operational freshness timestamps null. Thus `--apply` still does not automatically make a directory record public or CNGx Verified.

## Dry-run reconciliation

Because the proposed schema migration is deliberately not applied to production, the new importer cannot yet be executed end-to-end against production with its new provenance columns. A read-only reconciliation of the snapshot against current production identity fields found no normalized operator+address+state match among the five current station rows (three approved demos and two rejected QA rows).

Expected first-run classification against the current database after migration application:
- new: 90
- possible duplicate: 0
- unchanged: 0
- conflict: 0
- invalid: 0

This is a static/read-only dry-run expectation, not an applied import.

## Test status

No local Supabase/PostGIS database is available in the current execution environment, and production was not used as an experimental database. Therefore coordinate-trigger, KNN/radius/limit and RLS RPC tests are pending application to an isolated Supabase branch/local database.

Generated TypeScript types were not hand-edited. Regenerate `lib/database.types.ts` from the isolated database after applying the migration, then commit the generated output before production migration approval.

## Pre-test harnesses

`supabase/tests/phase1_station_geospatial_foundation.sql` is a transaction/rollback harness for the future isolated database. It covers PostGIS schema placement/permissions, geography synchronization, coordinate constraints, independent freshness timestamps, proximity ordering/radius/limit, anonymous approved visibility, rejected-row RLS exclusion, and trigger-function direct-execution revocation.

Small importer fixtures live under `tests/fixtures/importer/` and cover first/second run idempotency, source-reference conflict, normalized-identity possible duplicate, and preservation of claimed/operator operational state.
