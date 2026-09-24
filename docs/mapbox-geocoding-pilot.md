# Mapbox Permanent Geocoding pilot

## First Permanent pilot — executed evidence
The first 12-station Mapbox Geocoding API v6 pilot used `permanent=true` and made **14 billable searches**. The immutable raw evidence remains at `data/enrichment/mapbox-permanent-geocoding-pilot-2026-09-22.json`: **0 candidate_exact, 3 script-generated candidate_approximate, 7 manual_review, 2 unresolved**. The raw provider responses and alternate candidates are not rewritten by later review.

Product-lead review found: KU Plaza/Benin-Sapele was road-level only; Eyaen/Benin-Auchi had ambiguous road segments; Lateef-Jakande's primary result conflicted with supplied Agidingbi/Ikeja locality; 279 Agege Motor Road was interpolated/low-confidence; Enugu-Abakaliki was corridor-level with multiple road variants; Ugwu Onyeama had similarly named Enugu streets; Kakau/Chikun's automatic approximate was rejected because the primary result was Sabon Gari; Sheikh Nasir Kabara/Kano had multiple nearby road candidates; Kubwa/FCT fell back to Borno; Sulu Gambari/Ilorin was strongest at road level only; Jimeta's automatic approximate was rejected because the primary result was Numan; Tollgate/Ibadan had no acceptable Oyo/Ibadan result.

## Locality fail-closed policy
State agreement alone is insufficient. When a source address explicitly contains a city, town, municipality, LGA or locality, both `candidate_exact` and `candidate_approximate` require positive compatible provider locality evidence from place/locality/district/neighborhood context. Missing or inconsistent locality evidence becomes manual review, rejected, or unresolved. Curated source-only hints remain source-controlled; provider-derived locality is not inserted into that configuration.

FCT comparison uses explicit aliases only: FCT Abuja, Abuja FCT, Federal Capital Territory, and Federal Capital Territory Abuja normalize to one comparison identity. Generic fuzzy state matching is not used.

## First-pilot hardened review
The stricter locality-aware rules were applied offline to the saved first-pilot candidates without any Mapbox request. The derived review evidence remains at `data/enrichment/mapbox-permanent-geocoding-pilot-reviewed-2026-09-24.json`; the raw first-pilot file remains unchanged.

Hardened distribution: **0 candidate_exact, 0 candidate_approximate, 10 manual_review, 2 unresolved**.

## Structured-input second pilot
The same 12 records were run through Mapbox Geocoding API v6 with `permanent=true`: **12 records, 12 billable requests, 10 Structured Input requests, and 2 controlled free-text fallbacks**. Typed components were used only where the historical source could be decomposed honestly; address numbers were not fabricated and source landmark/corridor text was not forced into unsafe address fields.

The immutable second-pilot provider evidence is `data/enrichment/mapbox-structured-geocoding-pilot-2026-09-24.json`. Provider responses and alternate candidates must not be rewritten or removed.

Product-lead distribution after independent review: **0 candidate_exact, 0 candidate_approximate, 11 manual_review, 1 unresolved**.

## First vs second pilot
Structured Input materially improved request safety and selected-query quality, but it did not produce sufficient automatically trustworthy station coordinates for national bulk acceptance.

- **Lateef-Jakande / Agidingbi / Ikeja:** Structured input produced a materially better Lateef Jakande Road candidate, but provider locality evidence still did not positively establish Agidingbi/Ikeja. Remains manual review.
- **279 Agege Motor Road:** Address number and street were recognized, but the returned point is interpolated and not facility-verified. Remains manual review.
- **Kakau / Chikun:** Fail-closed handling avoided automatic acceptance of the earlier Sabon Gari result. Current provider evidence remains broad and does not verify the facility. Remains manual review.
- **Kubwa / FCT:** Material improvement from the previous wrong-state/Borno failure to Abuja Municipal / Federal Capital Territory, but Kubwa/station-level location remains unverified. Remains manual review.
- **Jimeta / Adamawa:** Provider evidence continues to resolve toward Numan rather than Jimeta. Do not accept without independent evidence.
- **Tollgate / Ibadan:** Still no useful state/locality-compatible result. Remains unresolved.
- Several other records produce plausible road or corridor evidence, but road/corridor evidence is not facility-level evidence.

**Conclusion:** the second pilot passes the safety/request-construction quality gate but fails the national automatic-coordinate quality gate. Mapbox remains approved as a candidate-generation source; it is not approved as the sole authority for automatically assigning the remaining national station coordinates. The remaining 78 stations must not be geocoded at this stage.

## Candidate clustering
For ambiguity review only, near-identical provider candidates may form one cluster when they share normalized street/road identity, match the expected state, have compatible required locality context, and are within **100 metres**. Clustering can suppress false ambiguity but can never upgrade road-level evidence to facility-level exact evidence.

## Manual-verification queue
The 12 pilot records are staged at `data/enrichment/cngx-station-manual-verification-pilot-2026-09-24.json`. All records begin with `verification_status = pending`; none are pre-marked verified. The queue retains the source reference, operator, source address, state, selected Mapbox candidate where one exists, verification status, verification sources, and verification notes.

Each `verification_sources` entry supports independent evidence with:

- `source_type`
- `source_name`
- `source_url`
- `observed_at`
- `latitude`
- `longitude`
- `address_text`
- `evidence_notes`

Supported `source_type` values are `official_operator`, `official_government`, `public_map_listing`, `operator_contact`, `field_verification`, and `other_authoritative`. No verification evidence is added until it has actually been collected.

## Verification acceptance policy
### verified_exact
May only be assigned where independent evidence identifies the actual facility/site coordinate with high confidence.

### verified_approximate
May be assigned where independent evidence establishes the correct corridor/locality and the point is useful for navigation/discovery, but the exact facility entrance/site is not proven.

### rejected
Used where the Mapbox candidate contradicts credible independent location evidence.

### unresolved
Used where there is insufficient evidence to assign a useful coordinate.

A road match alone is not facility verification. State match alone is not location verification. Mapbox alone is not independent verification.

## Production mapping policy
When independently verified coordinates are eventually mapped into CNGx:

- `verified_exact` -> `location_precision = exact`
- `verified_approximate` -> `location_precision = approximate`
- `unresolved` -> no map pin until coordinates are usable

Provider and verification provenance must remain visible in the data model. Coordinate verification alone must not be used to claim that a station is **CNGx verified**, **live**, **open**, **price confirmed**, or **queue confirmed**.

## Request, secret, and production safety
No further Mapbox execution is authorized during closeout. Do not run `--pilot --execute`; do not geocode the remaining 78. Mapbox access tokens must never be printed or persisted.

No Supabase write, migration, national station import, or production change is authorized as part of this closeout.

## Independent manual verification pilot
The next gate researches independent public evidence for the same 12 pilot records. Mapbox remains useful as a **candidate-generation source**, but its coordinates are not treated as independent verification or as automatic authority.

Evidence is preferred in this order: official operator sources, official government sources, independently maintained public map/listing evidence, then other authoritative public sources. Pi-CNG remains the source-record provenance and is not double-counted as a separate coordinate-verification source.

Research classification follows the manual-verification policy:

- `verified_exact` requires independent evidence identifying the actual facility coordinate with high confidence; two coordinate-bearing sources should agree within approximately 150 metres, or an official facility pin must be independently corroborated.
- `verified_approximate` requires independent evidence establishing a useful facility corridor/locality and a defensible navigation/discovery point while exact entrance/site location remains unproven.
- `rejected` applies when independent evidence materially contradicts the selected Mapbox candidate.
- `unresolved` applies when evidence is insufficient for a useful coordinate; unresolved is preferable to lowering the standard.

All **12** pilot records were researched. The proposed research distribution is **0 verified_exact, 4 verified_approximate, 3 rejected, and 5 unresolved**. Four records have an explicit independent coordinate-bearing public pin; no record currently has two independent coordinate-bearing sources, so none meets the exact-verification rule.

The derived research artifact is `data/enrichment/cngx-station-manual-verification-research-2026-09-24.json`. These classifications are **research proposals for product-lead review only** and are not production-approved verification statuses.

## Current gate
Product-lead review of the 12-station independent-verification research is the next permitted location-quality step. National bulk geocoding remains blocked. No further Mapbox request, remaining-78 processing, Supabase write, migration, station import, or merge is authorized by this research stage.
