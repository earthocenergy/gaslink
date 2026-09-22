# Mapbox Permanent Geocoding pilot

## Status
The pilot pipeline is prepared but no external geocoding request has been made in this branch because a server-only `MAPBOX_ACCESS_TOKEN` was not available to the execution environment. The tool therefore remains at its configuration gate.

## Provider and storage contract
This pilot is exclusively for **Mapbox Geocoding API v6 Permanent Geocoding**. Every executable request sets `permanent=true`, `country=NG`, and `autocomplete=false`. Search Box, temporary Mapbox geocoding, Google, Nominatim, and other providers are not fallback paths.

Persisted Mapbox results are intended for CNGx's planned Mapbox-based mapping/navigation experience. They are not provider-neutral; if CNGx changes mapping provider, licensing and stored-coordinate use must be reviewed again.

## Secret handling
The script reads only `MAPBOX_ACCESS_TOKEN` as its provider credential. It does not print or persist the token and refuses execution without it. Plain execution and `--pilot` alone make zero external requests. External calls require both `--pilot --execute`. The script never connects to Supabase.

## Pilot sample
The exact sample is source-controlled in `data/enrichment/mapbox-permanent-geocoding-pilot-sample-2026-09-22.json`. It contains 12 valid address-bearing records spanning all six geopolitical regions and a mixture of street, highway/corridor, landmark and less-structured Nigerian addresses.

The immutable source has only one non-placeholder North-East address. The remaining North-East entries are `Address pending confirmation`, so they are excluded rather than consuming API requests. The twelfth slot is an additional South-West corridor/landmark case.

## Request discipline
One normalized address + state query is attempted first. A maximum of one second normalized variant is allowed only when the first result is absent or clearly unusable. The hard ceiling is 24 billable requests.

## Candidate gates
Mapbox is a candidate provider, not CNGx verification. `candidate_exact` requires address-level output, compatible state/locality, exact/high match confidence, no contradictory address component, and rooftop/parcel/point coordinate accuracy. Broad place/state/locality results cannot be exact. Plausible lower-precision address/street/corridor results become `candidate_approximate`; uncertain cases require manual review; contradictions are rejected.

## Current factual distribution
External requests: **0**. Billable requests: **0**. Exact: **0**. Approximate: **0**. Manual review: **0**. Rejected: **0**. Pilot results unresolved pending provider execution: **12**.

Because no provider call has occurred, there is no factual confidence/accuracy distribution, no state-mismatch result, no centroid result and no duplicate-coordinate result to report yet.

## Acceptance gate
No recommendation for full 90-record geocoding can be made until the 12-record permanent pilot is actually executed and reviewed. Before execution, confirm the configured Mapbox account permits Permanent Geocoding and provide `MAPBOX_ACCESS_TOKEN` only through an approved server/admin environment.

No production database write, station import or migration is part of this pilot.
