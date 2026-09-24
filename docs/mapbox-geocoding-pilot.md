# Mapbox Permanent Geocoding pilot

## First Permanent pilot — executed evidence
The first 12-station Mapbox Geocoding API v6 pilot used `permanent=true` and made **14 billable searches**. The immutable raw evidence remains at `data/enrichment/mapbox-permanent-geocoding-pilot-2026-09-22.json`: **0 candidate_exact, 3 script-generated candidate_approximate, 7 manual_review, 2 unresolved**. The raw provider responses and alternate candidates are not rewritten by later review.

Product-lead review found: KU Plaza/Benin-Sapele was road-level only; Eyaen/Benin-Auchi had ambiguous road segments; Lateef-Jakande's primary result conflicted with supplied Agidingbi/Ikeja locality; 279 Agege Motor Road was interpolated/low-confidence; Enugu-Abakaliki was corridor-level with multiple road variants; Ugwu Onyeama had similarly named Enugu streets; Kakau/Chikun's automatic approximate was rejected because the primary result was Sabon Gari; Sheikh Nasir Kabara/Kano had multiple nearby road candidates; Kubwa/FCT fell back to Borno; Sulu Gambari/Ilorin was strongest at road level only; Jimeta's automatic approximate was rejected because the primary result was Numan; Tollgate/Ibadan had no acceptable Oyo/Ibadan result. These findings make the first free-text pilot insufficient for national rollout.

## Locality fail-closed policy
State agreement alone is insufficient. When a source address explicitly contains a city, town, municipality, LGA or locality, both `candidate_exact` and `candidate_approximate` require positive compatible provider locality evidence from place/locality/district/neighborhood context. Missing or inconsistent locality evidence becomes manual review, rejected, or unresolved. Curated source-only hints are stored in `data/enrichment/mapbox-permanent-geocoding-pilot-locality-hints-2026-09-24.json`. No provider-derived locality is inserted into that configuration.

FCT comparison uses explicit aliases only: FCT Abuja, Abuja FCT, Federal Capital Territory, and Federal Capital Territory Abuja normalize to one comparison identity. Generic fuzzy state matching is not used.

## Offline reclassification
The stricter locality-aware rules were applied offline to the saved first-pilot candidates without any Mapbox request. Derived review evidence is in `data/enrichment/mapbox-permanent-geocoding-pilot-reviewed-2026-09-24.json`; the raw file remains unchanged.

Distribution after review: **0 candidate_exact, 0 candidate_approximate, 10 manual_review, 0 rejected, 2 unresolved**. The three former automatic approximate results (KU Plaza, Kakau/Chikun, Jimeta) no longer auto-qualify.

## Structured-input second pilot
The same 12 records are prepared for a second pilot. Mapbox v6 Structured Input is preferred when the historical source can be safely decomposed. Requests use `country=NG`, expected `region`, explicit source-derived `place` where available, `autocomplete=false`, `permanent=true`, and compact candidate review. Mapbox documents that Structured Input drops `q` and accepts typed components such as address_line1/address_number/street/place/region/country. Where decomposition is unsafe, the script retains a normalized free-text query with strict locality validation.

No address number is fabricated and operator/business names are not inserted into street fields. Repeated geographic tokens are removed from free-text fallback (for example Lagos/Lagos or Enugu/Enugu).

## Candidate clustering
For ambiguity review only, near-identical provider candidates may form one cluster when they share normalized street/road identity, match the expected state, have compatible required locality context, and are within **100 metres**. Clustering can suppress false ambiguity but can never upgrade road-level evidence to `candidate_exact`.

## Request and secret safety
The second pilot remains offline until separately authorized. Plain execution and `--pilot` alone make zero external requests. External execution still requires **both** `--pilot --execute` plus server-only `MAPBOX_ACCESS_TOKEN`. The script refuses execution if `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is present. Hard ceiling remains **24 billable searches**. No token is printed or persisted.

The prepared second-pilot output path is `data/enrichment/mapbox-structured-geocoding-pilot-2026-09-24.json`; it is not created before execution. No station outside the original 12 is eligible.

## Offline verification
`node scripts/test-geocode-station-locations-mapbox.mjs` verifies duplicate geographic-token removal; Chikun/Sabon Gari and Jimeta/Numan fail-closed cases; Agidingbi/Ikeja locality inconsistency; FCT/Borno rejection and FCT aliases; locality-supported approximate classification; missing-locality fail-closed behavior; conservative same-road clustering; no exact upgrade from clustering; structured `country=NG` and `permanent=true`; and token non-emission. Tests make no API request.

## Current gate
No second-pilot Mapbox request has been made in this hardening prompt. No remaining 78 stations were geocoded. No Supabase write, migration or station import is authorized. Product-lead authorization is required before executing the prepared second structured pilot.
