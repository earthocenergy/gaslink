# Controlled official-directory publication pilot

This pilot prepares CNGx for a deliberately small, reversible publication exercise. It does **not** publish either pilot station during 003F-2 and does not apply the prepared database migration.

## What publication means

For an `official_directory` record, publication is a distinct editorial state. It does not change or imply registration approval, CNGx verification, coordinates, operational freshness, price, queue, `open_now`, ownership or provenance.

A published directory record may legitimately remain:

- `registration_status = pending`;
- `is_verified = false`;
- `status = unknown`;
- price, queue and `open_now` null;
- approximate or unconfirmed in location precision.

## State machine

Review states are `unreviewed`, `eligible` and `withheld`. `published` is the public state. **Eligible is not public** and does not make an official-directory record visible through the publication branch.

Allowed transitions:

- `unreviewed → eligible`;
- `unreviewed → withheld`;
- `eligible → unreviewed`;
- `eligible → withheld`;
- `eligible → published`;
- `withheld → unreviewed`;
- `withheld → eligible`;
- `published → eligible`.

Not allowed:

- `unreviewed → published`;
- `withheld → published`;
- `published → unreviewed`;
- `published → withheld`;
- any same-state transition.

Publication therefore requires two distinct administrative decisions: first a review decision to make a record `eligible`, then a separate explicit publish decision. Rollback from public visibility is only `published → eligible` through the dedicated unpublish action.

## Temporary 003F-2 pilot scope

The first controlled publication pilot is temporarily authorized for exactly two frozen `record_source_reference` values from the canonical pilot manifest. The prepared `admin_publish_station` function must lock the target row, confirm it is an `official_directory` record, confirm its source reference is one of those two records, and then confirm its locked publication state is `eligible` before any station update or audit insert.

This temporary database allowlist is intentionally narrower than the general review workflow. A non-pilot directory record may still be reviewed and marked `eligible` for future work, but it cannot be published during this first pilot. After successful pilot closeout, a later forward migration may deliberately generalize publication scope.

Unpublish is not restricted by the temporary pilot allowlist. It remains a safety rollback for **any published official-directory** record so an unexpectedly published directory record can always be removed from public discovery and returned to `eligible` with an auditable reason.

## Explicit publication safety

`admin_review_station_publication` remains review-only and must reject a station that is currently `published`. Publishing and unpublishing use separate admin-only RPCs. All three mutation RPCs acquire a row lock before trusting the station's current publication state, so concurrent calls re-read serialized state rather than acting on stale pre-lock assumptions.

Publish and unpublish require a mandatory trimmed note/reason, a 2,000-character maximum, and one append-only `station_publication_reviews` event for each actual successful state transition. Review notes remain optional except that Withhold requires a reason.

The admin UI requires an eligible pilot record, a publication note and exact typed confirmation `PUBLISH`. The confirmation identifies the station and source reference and restates the current location precision, verification state and operational state. It warns that publishing makes the directory record visible in CNGx but does not verify the station or confirm live operating conditions. There is no bulk publish or publish-all action.

Unpublishing requires a mandatory reason and clear confirmation that the record will be removed from public discovery and returned to `eligible`.

## Frozen pilot records

The canonical pilot manifest contains exactly two source references:

1. `picng-7acdd2023622ddc15506e499` — NIPCO Gas Limited, KU Plaza, Edo — mapped/approximate.
2. `picng-8156d44c6cd771ead33e9f0d` — Tetracore, Benin City Bypass, Uwusan, Edo — text-only/unconfirmed.

No substitute station is permitted without a new product gate. The UI derives its pilot authorization set from this manifest; the migration contains the same two database-layer references, and the dedicated test suite compares them so they cannot silently diverge.

After a later controlled publication decision, the mapped/approximate candidate is expected to be public in text/list discovery and eligible for trusted map/proximity discovery while remaining labelled `Approximate location`; directions use its coordinates. The text-only/unconfirmed candidate is expected to be public in text/list discovery but excluded from trusted map pins and proximity results, with `No trusted map location yet` and address-based directions.

## What this pilot does not establish

Publication does **not** establish that either station is:

- CNGx verified;
- currently operational;
- open now;
- dispensing gas now;
- price confirmed;
- queue confirmed.

The pilot is intended to prove only:

1. controlled editorial publication;
2. provenance-safe public presentation;
3. map eligibility based on independent coordinate confidence;
4. reversible public visibility;
5. append-only auditability;
6. temporary pilot-scope enforcement at both database and UI layers.

## 003F-2 safety boundary

003F-2 hardens code, the still-unapplied migration, documentation and tests only. Production must remain at 90 unreviewed official-directory records, zero eligible, zero published, zero withheld, and the existing three historical publication-review audit rows. The migration is not applied, neither pilot record is reviewed, and no production station row or review-audit row is changed.
