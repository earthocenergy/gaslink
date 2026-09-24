# CNGx station publication model

## Purpose

CNGx treats directory existence, publication, location confidence, site/operator verification and operational freshness as separate concepts. A credible directory source can establish that a station record exists without establishing that CNGx verified the facility, that it is operating now, that its map position is exact, or that price/queue/availability data is current.

003D-2 hardens the review workflow without applying any migration, publishing any directory station, changing production RLS or running the importer.

## Public station fields versus private review history

`public.stations` carries only publication state that may safely accompany a publicly readable station row:

- `publication_status`
- `publication_reviewed_at`

Internal reviewer identity and editorial notes are **not** stored on `public.stations`. Row-level security is a row boundary, not a dependable column-confidentiality boundary for a row that may later become public.

Private review history is stored in `public.station_publication_reviews` with station id, previous status, new status, internal reviewer UUID, optional notes and timestamp. The table has RLS enabled. Anonymous access is revoked. Authenticated users receive SELECT privilege only, and the SELECT policy permits only internal admins. Direct authenticated INSERT/UPDATE/DELETE is not granted; review writes occur only through the protected admin RPC.

The UI does not prominently expose raw reviewer UUIDs. Review history labels the actor as **Internal admin review** unless a later approved scope adds safe human-friendly identity resolution.

## Publication states

`publication_status` has four values:

- `unreviewed` — publication review has not been completed;
- `eligible` — review is complete and the record may be considered for a later publication action;
- `published` — the record is intentionally public;
- `withheld` — review found that the record should not proceed toward publication at this time.

**Eligible does not mean public.** 003D-2 has no action that can change an official-directory record to `published`.

**Withheld does not reject or erase source provenance.** The station remains an official-directory record; withholding is only a CNGx publication-review decision.

Returning a record to `unreviewed` clears `publication_reviewed_at` on the station row but appends a new audit event, so earlier decisions remain in history.

## Existing-row backfill design

The corrected, still-unapplied foundation migration keeps:

- approved non-directory rows → `publication_status='published'` to represent their legacy public state;
- rejected non-directory rows → default `unreviewed`;
- every `official_directory` row → `unreviewed`.

It does not invent reviewer identity, notes or review time.

## Interim official-directory registration safety

Current public visibility still depends on `registration_status='approved'`. Until the later publication/RLS transition, official-directory rows are therefore constrained to remain `registration_status='pending'`.

The foundation migration adds an integrity constraint equivalent to:

`record_source_type <> 'official_directory' OR registration_status = 'pending'`.

The later admin-review migration also hardens `admin_review_station_registration(...)`: if the target is `official_directory`, it fails closed with **“Official-directory stations require the publication review workflow.”** It does not approve, verify, claim, timestamp verification or grant operator role for directory records. Genuine submitted non-directory registration behavior is preserved.

The main Earthoc Admin **Network onboarding → Station registrations** queue filters out `official_directory`, so that queue remains a workflow for actual submitted registrations only.

## Dedicated admin publication workflow

Directory publication review lives at `/admin/stations/publication`, not inside the already-large main admin queue. It is admin-gated and reads only `record_source_type='official_directory'` rows.

The queue supports:

- search by station/operator/address/source reference;
- filters for publication status, state and mapped/unmapped;
- summary counts for unreviewed, eligible, withheld, mapped and unmapped;
- bounded pagination;
- station identity, official-directory provenance, source reference, coordinate confidence/source, verification state and operational status;
- per-station review history.

Available decisions are only:

- **Mark eligible**
- **Withhold** — a non-empty reason is required
- **Return to unreviewed**

There is no bulk status mutation and no direct publication control.

## Review RPC semantics

`admin_review_station_publication(p_station_id, p_decision, p_notes)` is `SECURITY DEFINER`, uses a fixed safe search path, requires authentication, performs an explicit admin-role check, and locks the target official-directory station before mutation.

It accepts only `eligible`, `withheld`, and `unreviewed`. It rejects non-directory stations and rejects any other decision, including `published`.

A review decision changes only `publication_status` and `publication_reviewed_at`, then appends an audit event. It preserves registration status, verification, ownership/submission fields, record provenance, coordinate provenance, latitude/longitude/geography, operational status, price, queue, availability and freshness timestamps.

## Trust language

For official-directory rows the admin review UI uses evidence-specific language:

- **Listed in official directory**
- **Not CNGx verified** when verification is absent
- **Operational status unknown** when operational status is unknown
- **Approximate location** for the four currently mapped approximate records
- **No trusted map location yet** for unconfirmed records

Directory provenance is never translated into “live”, “open”, “available now” or CNGx verification without separate evidence.

## Pre-migration preview safety

Production currently has no `publication_status`. The feature preview therefore detects missing publication schema and shows **“Publication review schema has not been applied yet.”** It does not crash, mutate data, fall back to registration approval or guess publication states. The main admin page continues to function because its new directory exclusion uses the already-existing `record_source_type` field.

## Offline review manifest

`data/enrichment/picng-publication-review-manifest-2026-09-24.json` remains offline planning evidence only. It is not imported into the database. It remains 90 records: 4 `mapped_candidate`, 86 `directory_only_candidate`, all 90 `unreviewed`.

Once the schema is later applied, database publication state becomes authoritative only through explicit admin review actions.

## Future publication/RLS transition

003D-2 still does not alter public-read RLS or `nearby_stations`. A later explicit gate must decide how `publication_status='published'` integrates with anonymous station reads while preserving current approved non-directory behavior and coordinate-dependent discovery safety.

No bulk publication is authorized by this model. The `published` state exists now only for legacy approved non-directory backfill and a future explicitly approved publication gate.
