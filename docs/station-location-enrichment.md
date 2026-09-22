# Pi-CNG station location enrichment — 2026-09-22

## Scope
Prompt 003B is data research and reconciliation only. The historical 90-record directory snapshot remains unchanged. No production import, production database write, migration, third-party geocoding, or trip-routing work is part of this artifact.

## Official location source inspected
- Directory identity source: https://www.pci.gov.ng/refuelling-stations.html
- Official location source: https://pci.gov.ng/network-map.html
- Observation date: 2026-09-22

The official network map states that pins marked **approximate** are placed at the nearest known town or district. That map precision is separate from CNGx operator verification.

## Public map data-loading investigation
The publicly retrievable network-map HTML renders the map interface and identifies Esri map tiles, but the static/publicly retrievable HTML inspected does not contain the station marker records or per-record latitude/longitude values. Searches for a publicly reachable structured marker JSON/data asset or endpoint did not identify a factual coordinate feed that could be safely captured.

No authentication, private/admin interface, credential, anti-bot bypass, or access-control circumvention was attempted.

**Result:** a public structured coordinate source was not identified in this research environment. The exact client-side marker-data loading asset/endpoint therefore remains unresolved rather than guessed.

## Reconciliation result
- Historical directory records reviewed: 90
- Unique stable source references: 90
- Public structured official-map records captured: 0
- matched_unique: 0
- matched_ambiguous: 0
- not_found: 90
- invalid_source_location: 0
- exact coordinates accepted: 0
- approximate coordinates accepted: 0
- unconfirmed: 90

Every derived record preserves its original source_reference. No page-order identity was used.

## Precision and provenance policy
Coordinates are accepted as **exact** only when an authoritative public source supports facility-level placement and reconciliation to the specific directory record. **approximate** is reserved for explicitly approximate or locality-level source positions. **unconfirmed** is used when coordinates are missing, ambiguous, weakly reconciled, or inconsistent.

Because no trusted official-map coordinate was recovered, all candidate coordinates and all location_source_* fields remain null. record_source_* semantics remain untouched in the historical snapshot.

Official-map located does **not** mean CNGx Verified, operational, open, gas available, price confirmed, or queue confirmed.

## Sanity validation
With zero accepted coordinate pairs there are:
- 0 invalid latitude/longitude pairs
- 0 partial coordinate pairs
- 0 duplicate-coordinate warnings
- 0 suspicious coordinate clusters
- 0 accepted coordinates outside Nigeria
- 0 city/state-centroid coordinates persisted

No suspicious source coordinate was auto-corrected because none was accepted.

## Duplicate physical-station review
Normalized operator + address + state produced no exact duplicate identity groups in the immutable 90-record snapshot. Normalized non-placeholder address + state produced no same-address groups. Repeated `Address pending confirmation` values were explicitly excluded as duplicate evidence because they are placeholders, not physical addresses.

Possible duplicate physical-station groups requiring product-lead merge/delete action: **0 based on current evidence**. No source record was merged or deleted.

## Unresolved queue
All 90 records are written to `data/enrichment/picng-stations-requiring-geocoding-2026-09-22.json`. This queue is only an input for a later separately authorized permanent-geocoding/manual authoritative-location stage.

## Current official-directory drift
The live official directory may evolve after the immutable 2026-09-21 capture. Prompt 003B does not rewrite historical identity records merely because later public text changes. Future source refreshes should be captured as a new snapshot and reconciled explicitly.

## Remaining limitations
The principal limitation is that the official map visibly contains markers but its factual per-marker coordinates were not recoverable from a legitimate publicly delivered structured source available to this research environment. No guessed coordinates or third-party geocoder results were substituted.

The correct next gate is product-lead review of this evidence and a decision on whether to authorize a separate permanent-coordinate acquisition method for the unresolved queue.
