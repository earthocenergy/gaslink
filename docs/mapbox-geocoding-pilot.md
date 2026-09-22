# Mapbox Permanent Geocoding pilot

## Status
The pilot pipeline is hardened for Mapbox Geocoding API v6 response semantics but remains fully offline. No external geocoding request has been made. A server-only `MAPBOX_ACCESS_TOKEN` is intentionally not requested or stored by this branch.

## Provider and storage contract
Executable requests are exclusively Mapbox Geocoding API v6 Permanent Geocoding and set `permanent=true`, `country=NG`, `autocomplete=false`, and `limit=5`. Search Box, temporary Mapbox geocoding and alternate providers are not fallback paths.

## Response parsing and review
Geocoding v6 object context is authoritative: `properties.context.country`, `region`, `place`, `district`, and `locality` are read safely by name/display fields. Legacy array context is tolerated only as backwards compatibility.

Each billable query may return up to five compact candidates. The tool evaluates candidate state, locality/address evidence, feature type, Smart Address Match confidence/component match codes and coordinate accuracy. Exactly one clearly superior candidate may proceed to normal classification. Two or more materially plausible candidates force `manual_review` while compact alternate evidence is retained.

`candidate_exact` fails closed: positive returned-region evidence matching the source state is required; confidence must be exact/high; feature type must be address; accuracy must be rooftop/parcel/point; and region or other critical component match-code contradictions prevent exact classification. Interpolated/approximate/intersection positions are never facility-level exact.

## Query discipline
Variant 1 is normalized full source address + state. Variant 2 preserves the same meaningful address components and state while normalizing common road/street/landmark abbreviations and punctuation. Both remain constrained by `country=NG`. A second query is allowed only when the first is absent/rejected/unresolved. Hard ceiling remains 24 searches.

## Secret/request safety
Plain execution and `--pilot` alone make zero requests. External calls require both `--pilot --execute` plus server-only `MAPBOX_ACCESS_TOKEN`. Execution is refused if `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is present. The token is never printed or persisted. The script never connects to Supabase.

## Offline verification
`node scripts/test-geocode-station-locations-mapbox.mjs` covers v6 object-context parsing, region/place extraction, wrong-state rejection, missing-region fail-closed behavior, exact/high + rooftop/parcel/point exact eligibility, interpolated exclusion, medium/low exclusion, component-match contradiction, multi-candidate ambiguity, state-preserving distinct query variants, and token non-emission.

External requests: **0**. Billable requests: **0**. No final provider-result artifact is created by this hardening step.

## Acceptance gate
The next gate is Mapbox account/server setup and then the separately authorized 12-record permanent pilot. No full 90-record geocoding, production write, station import or migration is authorized.
