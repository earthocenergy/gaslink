# CNGx public discovery visibility contract

## Canonical public visibility

A station is publicly discoverable when either:

1. `record_source_type = 'official_directory'` and `publication_status = 'published'`; or
2. `record_source_type <> 'official_directory'` and `registration_status = 'approved'`.

Public visibility does not require `is_verified = true`, does not convert an official-directory row out of `registration_status = 'pending'`, and does not imply operator ownership, live operating status, current price, queue confidence or freshness.

## Public discovery inventory

The public discovery surfaces audited for 003E are:

- homepage station results (`app/page.tsx`);
- Find CNG list/search and map placeholder (`app/stations/page.tsx`);
- station detail (`app/stations/[id]/page.tsx`);
- trip-planner station discovery (`app/trip/page.tsx`);
- `public.nearby_stations(...)`;
- the `stations_public_read` RLS policy.

Private/admin/operator station queries are outside the public-discovery cutover and retain their existing access purposes.

## Application-side enforcement

Every public station query uses the canonical visibility filter explicitly. This is required even when the current authenticated user has broader RLS access, so an admin opening a normal public page does not accidentally see unreviewed, eligible or withheld directory records.

Station detail applies the same rule after the requested UUID filter. A guessed unpublished directory UUID therefore does not become a public station detail route, and moderated reports are fetched only after station visibility passes.

The TypeScript helper also fails closed when `record_source_type` is unexpectedly null. Production defines this column as NOT NULL; the defensive branch keeps TypeScript behavior aligned with SQL/PostgREST null semantics if malformed or partially hydrated data is ever passed to the helper.

## RLS design

The prepared cutover migration replaces only the public visibility branch of `stations_public_read`. Existing submitter, claimant and admin private-read branches remain available for their existing workflows. Unrelated station policies remain unchanged.

The migration is intentionally unapplied until an explicit later gate. Until then, production RLS continues to expose only the existing approved legacy rows.

## Nearby and map eligibility

A station is map/proximity eligible only when it is publicly discoverable and all of the following are true:

- latitude is not null;
- longitude is not null;
- PostGIS geography `location` is not null;
- `location_precision` is `approximate` or `exact`.

`nearby_stations(...)` uses the same canonical public-visibility branches and these coordinate requirements. It remains `SECURITY INVOKER` and keeps its existing validation, radius, limit, distance ordering, provenance, freshness and GIS behavior. Its own canonical WHERE clause prevents broader authenticated/admin RLS visibility from leaking unpublished stations through proximity results.

A published unconfirmed official-directory record may appear in public text/list discovery but must not create a map pin or enter proximity/distance calculations.

## 003E-2 nearby semantic review

Read-only production rehearsal confirmed:

- current public set under `registration_status='approved'`: 3;
- proposed canonical public set: 3;
- public-set symmetric difference: 0;
- current `nearby_stations` candidate set: 3;
- proposed trusted nearby/map candidate set: 0;
- all three removed proximity candidates are `record_source_type='demo'`, `is_demo=true`, and `location_precision='unconfirmed'`.

A complete runtime-source scan (`app`, `components`, `lib`) found zero application calls to `nearby_stations`. The 3 → 0 proximity change is therefore an **ACCEPTED INTENTIONAL TRUST-SAFETY CHANGE**: unconfirmed demo coordinates may remain as clearly labelled demo text/list records, but they must not masquerade as trusted geospatial positions. Their precision must not be upgraded merely to preserve old proximity behavior.

## Trust language and directions

Published official-directory records are presented with evidence-specific wording such as:

- Listed in official directory;
- Not CNGx verified, when applicable;
- Operational status unknown, when applicable;
- Approximate location, when applicable;
- No trusted map location yet, when applicable.

Trusted exact/approximate coordinates are preferred for external directions. When trusted coordinates are unavailable, address-based navigation remains available as **Directions by address**, which does not imply a verified facility pin.

## Migration transaction safety

The cutover file contains ordinary `DROP POLICY`, `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, `REVOKE`, `GRANT`, and `COMMENT` statements only. It contains no `transaction=false` directive and no concurrent DDL. Under the normal Supabase migration mechanism these statements are expected to run within the migration transaction, so a failure does not intentionally leave the public policy partially removed.

## Safety baseline

003E review introduces no publication action and applies no production migration. Current effective production visibility remains three legacy non-directory public stations and zero official-directory public stations until a later explicit visibility-cutover application and separate publication decision gate.
