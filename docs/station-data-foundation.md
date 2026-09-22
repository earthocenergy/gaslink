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

## Isolated runtime test — PASS

The Phase-1 migration was executed successfully in a temporary isolated Supabase project. Production remained untouched.

Confirmed runtime results:
- PostGIS 3.3.7 installed in dedicated `gis` schema, not `public`.
- `anon` and `authenticated` have required GIS `USAGE` and do not have GIS `CREATE`.
- internal station trigger functions are not directly executable by `anon`/`authenticated`.
- `nearby_stations` remains `SECURITY INVOKER`.
- valid latitude/longitude generate synchronized geography, and direct `location` modification cannot diverge from latitude/longitude.
- invalid latitude, invalid longitude and partial coordinate pairs are rejected.
- unrelated station updates do not refresh operational timestamps.
- status, price and queue changes independently stamp `status_updated_at`, `price_updated_at` and `queue_updated_at`.
- nearest ordering, radius filtering and result limiting passed.
- anonymous callers can retrieve approved geospatial stations and cannot retrieve rejected/private stations.
- the Phase-0 `user_roles` self-assignment restriction remained intact.
- Supabase security advisor after migration: **0 findings**.
- Supabase performance advisor after migration: **0 findings**.

The controlled importer database fixture also passed: clean first-run state, two safe pending/unverified records with unknown/null operational defaults, idempotent second identity run, source-reference conflict detection, normalized-identity possible-duplicate detection, preservation of claimed/operator-managed operational values, and stable final row count.

### Importer execution limitation

The exact `scripts/import-station-snapshot.mjs` Node process was **not** executed through its real service-role-key path during the isolated test because the available test environment did not expose the isolated project's service-role secret and the external execution environment could not install the required package. This is not a database-foundation blocker.

Before any national `--apply` is authorized, the exact script must run in an approved server/admin environment with a real server-only `SUPABASE_SERVICE_ROLE_KEY`, first in default **DRY RUN** mode. A national apply remains a separate explicit product-lead gate.

### TypeScript types

Types were generated successfully from the migrated isolated project, but that project intentionally contained only the production-equivalent subset needed for stations, `user_roles` security, PostGIS and `nearby_stations`. Its generated type output is therefore incomplete for the full production application and must **not** replace `lib/database.types.ts`.

After the Phase-1 migration is approved and applied to production:
1. generate fresh TypeScript types directly from the production Supabase project;
2. update `lib/database.types.ts`;
3. verify all existing production tables/types remain represented;
4. verify the new station provenance/geospatial/freshness fields and `nearby_stations` RPC are represented;
5. commit that complete generated file in the production-migration closeout branch.

## Production migration procedure — next gate

Production closeout must use this sequence:

1. Merge the reviewed Phase-1 foundation branch to `main`.
2. Confirm the resulting production Vercel deployment remains green.
3. Apply **only** `20260921170000_phase1_station_geospatial_foundation` to production Supabase.
4. **Do not import directory stations.**
5. Verify the production schema, PostGIS placement, permissions, triggers, constraints and RPC.
6. Run the production Supabase security and performance advisors.
7. Regenerate the **full** TypeScript types directly from production and update `lib/database.types.ts`.
8. Commit the regenerated full production types.
9. Verify existing application routes remain unaffected.
10. Only after those checks pass, close Prompt 003A.

Merging the Git branch must **not** automatically run the station snapshot importer or bulk-import the 90-record directory. The migration and the national data import are separate gates.
