# CNGx public discovery visibility contract

## Canonical public visibility

A station is publicly discoverable when either:

1. `record_source_type = 'official_directory'` and `publication_status = 'published'`; or
2. `record_source_type <> 'official_directory'` and `registration_status = 'approved'`.

Public visibility does not require `is_verified = true`, does not convert an official-directory row out of `registration_status = 'pending'`, and does not imply operator ownership, live operating status, current price, queue confidence or freshness.

## Public discovery inventory

The public discovery surfaces audited for 003E-1 are:

- homepage station results (`app/page.tsx`);
- Find CNG list/search and map placeholder (`app/stations/page.tsx`);
- station detail (`app/stations/[id]/page.tsx`);
- trip-planner station discovery (`app/trip/page.tsx`);
- `public.nearby_stations(...)`;
- the `stations_public_read` RLS policy.

Private/admin/operator station queries are outside the public-discovery cutover and retain their existing access purposes.

## Application-side enforcement

Every public station query uses the canonical visibility filter explicitly. This is required even when the current authenticated user has broader RLS access, so an admin opening a normal public page does not accidentally see unreviewed, eligible or withheld directory records.

Station detail applies the same rule after the requested UUID filter. A guessed unpublished directory UUID therefore does not become a public station detail route.

## RLS design

The prepared cutover migration replaces only the public visibility branch of `stations_public_read`. Existing submitter, claimant and admin private-read branches remain available for their existing workflows.

The migration is intentionally unapplied in 003E-1. Until a later gate applies it, current production RLS continues to expose only the existing approved legacy rows, so the feature preview degrades safely.

## Nearby and map eligibility

A station is map/proximity eligible only when it is publicly discoverable and all of the following are true:

- latitude is not null;
- longitude is not null;
- PostGIS geography `location` is not null;
- `location_precision` is `approximate` or `exact`.

`nearby_stations(...)` uses the same canonical public-visibility branches and these coordinate requirements. It remains `SECURITY INVOKER` and keeps its existing validation, radius, limit, distance ordering, provenance, freshness and GIS behavior.

A published unconfirmed official-directory record may appear in public text/list discovery but must not create a map pin or enter proximity/distance calculations.

## Trust language and directions

Published official-directory records are presented with evidence-specific wording such as:

- Listed in official directory;
- Not CNGx verified, when applicable;
- Operational status unknown, when applicable;
- Approximate location, when applicable;
- No trusted map location yet, when applicable.

Trusted exact/approximate coordinates are preferred for external directions. When trusted coordinates are unavailable, address-based navigation remains available as **Directions by address**, which does not imply a verified facility pin.

## 003E-1 safety baseline

003E-1 introduces no publication action and applies no production migration. The expected current effective public result remains three legacy non-directory public stations and zero official-directory public stations until a later explicit publication and visibility-cutover gate.
