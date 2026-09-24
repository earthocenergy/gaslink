# CNGx station publication model

## Purpose

CNGx treats station existence, publication, location confidence, site/operator verification, and operational freshness as five separate concepts. A credible directory source can establish that a station record exists without establishing that CNGx has verified the facility, that it is currently operating, that its map position is exact, or that price/queue/availability data is current.

This document defines the publication foundation only. It does not publish any of the 90 Pi-CNG directory records, change RLS, approve registrations, infer verification, or create operational facts.

## Current architecture before publication_status

Today public visibility is coupled to `registration_status = 'approved'`:

- `stations_public_read` allows anonymous access through the approved-registration branch; owner/admin branches are additional authenticated exceptions.
- `nearby_stations` requires `registration_status = 'approved'` and a non-null geography.
- the homepage station query, `/stations`, the trip planner, and the operator console explicitly filter for approved stations;
- `/stations/[id]` relies on station RLS rather than adding its own approved filter;
- station registration creates `pending`, non-verified rows and tells the submitter that the station will not appear publicly until approved;
- the admin registration-review RPC currently couples approval with `is_verified = true`, claimant assignment to the submitter, and a verification timestamp;
- claim approval can independently set `is_verified = true` and claimant ownership;
- operator updates and moderated reports are operational-data workflows, not publication decisions.

003D does not silently reinterpret those existing workflows. The new publication model is deliberately separate, and the future RLS transition is deferred to a later gate.

## Five independent concepts

### 1. Directory existence

`record_source_type = official_directory` means the station record is supported by a directory source such as Pi-CNG. It is record provenance only. It does not mean CNGx verified, operator verified, open, currently selling CNG, accurately mapped, price confirmed, or queue confirmed.

### 2. Publication state

`publication_status` is the explicit CNGx product/editorial decision:

- `unreviewed` — publication review has not been completed;
- `eligible` — review is complete and the record may be published, but publication has not been executed;
- `published` — CNGx intentionally exposes the record publicly;
- `withheld` — the record was reviewed but should not currently be public.

Publication status is not derived from source type, coordinate precision, `is_verified`, operational status, price, or queue.

Review metadata is `publication_reviewed_at`, `publication_reviewed_by`, and `publication_notes`. Notes must contain no secrets or PII. `publication_reviewed_by` is intentionally nullable and has no foreign-key dependency in the foundation migration so future service/admin workflows are not unnecessarily coupled to an auth row.

### 3. Location confidence

Location confidence remains `exact`, `approximate`, or `unconfirmed`. Coordinate provenance remains in the independent `location_source_*` fields. Publication does not upgrade coordinate confidence.

### 4. Site/operator verification

`is_verified` and future verification workflows describe independent evidence about the actual station/operator. A directory listing may be published without being CNGx verified. Publication must never set `is_verified` by implication.

### 5. Operational freshness

Status, price, queue, availability/open-now and freshness timestamps require current operational evidence. A published directory listing may correctly remain `status = unknown` with price, queue and open-now null.

## Migration and existing-row backfill

The publication-foundation migration is designed but intentionally unapplied in 003D-1. New records default to `publication_status = unreviewed`.

To preserve existing public behavior when the future publication-aware read policy is introduced:

- existing non-directory rows with `registration_status = approved` are backfilled to `publication_status = published`;
- every `record_source_type = official_directory` row is backfilled to `publication_status = unreviewed`, regardless of coordinates;
- all other existing rows remain `unreviewed`.

The migration does not alter `registration_status`, `is_verified`, operational fields, RLS, functions, triggers, ownership, or station coordinates. Existing approved non-directory rows are marked published only to represent their legacy public state; no historical publication reviewer or review time is invented.

## registration_status versus publication_status

`registration_status` remains the workflow state for submission, registration, admin acceptance and operator/admin processes. It is not removed or repurposed.

`publication_status` is the future public-directory editorial state. Registration acceptance, station/operator verification, and publication are therefore distinct decisions even though legacy workflows currently couple some of them.

## Directory publication eligibility

A directory record may eventually be considered for publication when all of the following are true:

- record provenance is valid;
- its source reference is unique;
- operator/name/address/state are sufficiently usable for a directory listing;
- no known contradiction or unresolved duplicate remains;
- an explicit CNGx product review has occurred.

These are eligibility conditions, not automatic approval rules. No bulk-approval or bulk-publication path is authorized by this model.

Coordinates are not mandatory for a directory-only text/list/search listing.

## List eligibility versus map eligibility

Text/list/search discovery and coordinate-dependent discovery are separate:

- a published record without trusted coordinates may appear in directory/list/search discovery;
- a record must have both latitude and longitude and `location_precision` of `approximate` or `exact` before it can be considered for coordinate-dependent map/nearby behavior;
- `unconfirmed` records must not appear as precise map pins, nearby results, distance-sorted results, or route/trip calculations;
- a published record with approximate coordinates may later be included in map/nearby surfaces only while clearly retaining `approximate` confidence; it must not be presented as an exact facility entrance.

`review_track` in the offline review manifest is only workflow prioritization. `mapped_candidate` does not mean publish, verify, open, live, or exact.

## Trust display policy

For an official-directory record, future UI may display wording equivalent to **“Listed in official directory.”** It must not display **“CNGx verified”** unless the separate verification process supports that claim.

Approximate coordinates should be identifiable as approximate where location confidence is relevant. Unknown operational status remains visibly unknown. `official_directory` must never be translated into “live”, “open”, “verified”, or “available now”.

## Offline publication review manifest

`scripts/build-directory-publication-review.mjs` consumes only the immutable Pi-CNG source snapshot and the independently approved coordinate overlay. It requires no database credentials and produces `data/enrichment/picng-publication-review-manifest-2026-09-24.json`.

Each row contains only safe review fields: source reference, operator, address, state, record source type, coordinate-presence boolean, location precision, location source type, review track and publication status. The four approved overlay records are `mapped_candidate`; the other 86 are `directory_only_candidate`; all 90 are `unreviewed`. The manifest is a review queue, not a recommendation to publish.

## Future RLS transition — document only

003D-1 does not modify RLS. Today `registration_status = 'approved'` controls the anonymous-public branch of station reads.

A later publication-schema/RLS gate should preserve current approved non-directory visibility while allowing explicitly published directory records. The intended policy shape is conceptually:

- existing approved non-directory stations remain public; or
- a station with `publication_status = published` may be public;
- an `official_directory` station must specifically be `publication_status = published` before anonymous visibility.

The exact policy and `nearby_stations` implementation must be reviewed in that later gate, not introduced here.

## Admin review requirements

A future admin publication workflow should show provenance, uniqueness/reconciliation state, usable identity/address information, coordinate confidence and coordinate provenance, verification state, and operational freshness as separate evidence. Review actions should explicitly move publication state and record reviewer/time/notes without silently mutating station verification or operational data.

No action should bulk-approve or bulk-publish all imported directory records. Publication must remain an explicit reviewed decision per controlled workflow.
