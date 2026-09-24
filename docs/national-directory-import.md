# CNGx national directory import preparation

## Scope and source architecture

The national directory pipeline uses the immutable Pi-CNG snapshot at `data/sources/picng-refuelling-stations-2026-09-21.json` as station-record evidence. That snapshot is not edited to add coordinates. Approved coordinate evidence is stored separately in `data/enrichment/picng-refuelling-stations-location-overlay-2026-09-24.json` and is combined with the snapshot only in memory by the importer.

Record provenance and coordinate provenance are intentionally separate:

- station records use `record_source_type = official_directory` and retain the Pi-CNG source name, URL, source reference, and observation date;
- approved coordinates retain `location_source_*` independently;
- coordinate verification does not set `is_verified = true` and does not establish live/open/price/queue/availability status.

The current approved overlay contains four approximate coordinates. All other directory records remain coordinate-null with `location_precision = unconfirmed`.

## Validation-only mode

Run the importer without database credentials or external requests:

```bash
node scripts/import-station-snapshot.mjs \
  data/sources/picng-refuelling-stations-2026-09-21.json \
  --overlay data/enrichment/picng-refuelling-stations-location-overlay-2026-09-24.json \
  --validate-only
```

`--validate-only` validates the immutable snapshot, validates the overlay before any database client is created, builds the effective records in memory, and prints structural counts only. It performs no Supabase read/write and no Mapbox request.

Overlay validation fails closed when a source reference is unknown or duplicated; record count is wrong; coordinates are unpaired or out of range; precision/source type is not database-compatible; coordinate provenance is incomplete; or an overlay attempts to alter station identity or record provenance. Overlay patches may contain only latitude, longitude, location precision, and `location_source_*` fields.

## Effective import model and staging

Each new directory payload is constructed with operational state deliberately unknown:

- `status = unknown`
- `price_per_scm = null`
- `queue_minutes = null`
- `open_now = null`
- operational freshness timestamps = `null`
- `is_demo = false`
- `is_verified = false`
- `registration_status = pending`

Directory imports therefore do not manufacture operational facts. The existing `stations_public_read` RLS policy exposes approved rows to anonymous users; a newly imported `pending` row is not anonymously public merely because it exists. RLS is not modified by this importer.

## Reconciliation and duplicate behavior

Identity priority is:

1. exact `record_source_type = official_directory` + `record_source_reference`;
2. normalized `operator + address + state` physical identity.

The plan classifies every record as `new`, `unchanged`, `possible_duplicate`, `conflict`, or `invalid` before any apply is allowed. Same source reference plus changed station identity is a conflict. Same normalized physical identity under a different source reference is a possible duplicate. Claimed or operator-managed physical matches are marked protected. Ambiguous matches are never overwritten, and the importer performs no update of status, price, queue, availability, freshness, or claimed/operator-managed station data.

Dry-run reports contain only safe reconciliation metadata: source reference, action, normalized identity reason, and a boolean indicating whether a matched station is protected. Existing station UUIDs, user UUIDs, claimant/submitted UUIDs, email, phone, tokens, and service-role credentials are not printed.

## Production read-only dry run

A production dry run is a separate product-lead gate. When authorized, run the importer with Supabase server/admin credentials but without `--apply`. The importer will read the minimal station identity fields needed for reconciliation, classify the complete effective dataset, print a safe plan, and perform zero writes.

Do not treat validate-only counts as production deduplication counts. The `new`, `unchanged`, `possible_duplicate`, `conflict`, and `invalid` production distribution is established only by the separately authorized production read-only dry run.

## Apply safeguards

`--apply` is intentionally fail closed and is not authorized by preparation alone. A future approved apply must provide both `--expected-new-count` and `--expected-overlay-count`. Before any write, the importer validates and classifies the complete dataset and aborts if any record is `invalid`, `conflict`, or `possible_duplicate`, or if either expected count differs from the actual plan.

All new insert payloads are constructed before writing. Approved new rows are submitted as one bulk `.insert(rows)` request rather than sequential per-record inserts, so the pipeline does not intentionally leave a partially imported national dataset because a later loop item failed. Existing rows are never updated by this import path.

## Production closeout — 24 September 2026

The controlled national-directory import completed against the 90-record Pi-CNG source snapshot. The first production dry run classified `90 new / 0 possible_duplicate / 0 conflict / 0 invalid`; the controlled apply inserted 90 rows, and the post-import idempotency dry run classified `0 new / 90 unchanged / 0 possible_duplicate / 0 conflict / 0 invalid`.

All 90 imported directory records remain staged with `registration_status = pending`, `is_verified = false`, and operational values unknown/null. Coordinate coverage remains deliberately limited to the four independently approved overlay records: `4 approximate / 0 exact / 86 unconfirmed`. No automatic Mapbox coordinates were added beyond those four independently approved overlays.

Pending directory records are not anonymous-public under the existing `stations_public_read` policy, so the import does not constitute a public directory launch. Station approval and any transition to public visibility remain a separate product gate.

The controlled server/admin import path required a minimal GIS permission repair for the Supabase `service_role`: `USAGE` on schema `gis` is granted while `CREATE` remains denied. Production records the aligned migration as `20260924165232_grant_service_role_gis_usage.sql`.

## Offline regression tests

Run:

```bash
node scripts/test-import-station-snapshot.mjs
```

The suite verifies the approved four-record overlay, 90-record effective dataset, 4 approximate/0 exact/86 unconfirmed coordinate distribution, overlay rejection cases, provenance separation, pending staging, unknown operational fields, `is_verified = false`, safe reporting, apply fail-closed behavior, atomic bulk-insert construction, and idempotency/reconciliation fixtures.

The normal application build runs both the offline importer tests and validate-only rehearsal before `next build`, providing a no-database guard against importer regressions.
