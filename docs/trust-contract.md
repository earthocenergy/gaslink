# CNGx station trust contract

## Independent trust states

The following states are deliberately independent:

- registration approval;
- station ownership / claim approval;
- community-report moderation;
- operational freshness;
- directory publication;
- CNGx verification.

No registration, claim, moderation, publication or operator operational workflow
may implicitly confer CNGx verification.

## Operator mutation contract

Web and future native clients must use:

`operator_update_station_operational(...)`

Inputs:

- `p_station_id uuid`
- `p_status station_status`
- `p_price_per_scm numeric`
- `p_queue_minutes integer`
- `p_opening_hours text`
- `p_open_now boolean`

The only station business fields this boundary may change are:

- `status`
- `price_per_scm`
- `queue_minutes`
- `opening_hours`
- `open_now`

The normal row `updated_at` value and existing database operational-freshness
triggers may change as consequences of an accepted operational update.

The RPC must never change:

- `publication_status`
- `publication_reviewed_at`
- `is_verified`
- `last_verified_at`
- record-source provenance
- location-source provenance
- `location_precision`
- trusted latitude / longitude / geography
- `registration_status`
- `submitted_by`
- `claimed_by`
- ownership authority
- other admin-controlled trust fields.

A caller must be either the station's current `claimed_by` user or an admin.

Raw client-side `stations.update(...)` is not part of the CNGx operator contract.

Every accepted material operator change is recorded in
`station_operator_update_audit`.

## Registration review

`admin_review_station_registration(uuid, boolean)`

may approve/reject registration and may establish the submitted operator's
ownership/role state.

It does not verify the station.

The historical compatibility RPC `approve_station_registration(uuid, boolean)`
is subject to the same trust rule and remains unavailable to normal
authenticated callers.

## Claim review

`approve_station_claim(uuid, boolean)`

may approve/reject a claim and establish ownership/operator authority.

It does not verify the station and does not refresh verification time.

## Community moderation

`admin_moderate_station_report(uuid, boolean)`

records `station_reports.moderated_at`.

When the reviewed report is applied, only supported operational information
may flow to the station.

Moderation does not set `is_verified` and does not touch `last_verified_at`.

Operational freshness remains separate from verification freshness.

## Explicit CNGx verification

`admin_set_station_verification(uuid, boolean)`

is the explicit independent verification/unverification boundary.

Only an authenticated CNGx admin may successfully execute the privileged
operation.

Verification writes are recorded separately in
`station_verification_audit`.

No registration, claim, moderation or operator workflow calls this RPC
automatically.

## L1C staging requirement

`20260928193000_trust_contract_hardening.sql` is a forward migration.

It must remain unapplied in production during L1B-T.

After L1C staging exists, migration order is:

1. `20260927200000_rate_abuse_foundation.sql`
2. `20260928193000_trust_contract_hardening.sql`

Both must be validated in staging before production consideration.
