# CNGx shared rate / abuse foundation

## Protected write classes

The shared application layer currently covers these authenticated user-facing writes:

1. station reports
2. station claims
3. station registration
4. marketplace listings
5. marketplace enquiries
6. provider onboarding
7. service offerings
8. service enquiries
9. business enquiries

Authentication endpoints continue to rely on Supabase Auth provider-native protections during L1B. Provider-native auth limits are additive and are not treated as a substitute for application-level protection on CNGx business writes.

## Reusable decision model

Each protected write is evaluated server-side before the business write.

The limiter receives:

- action
- authenticated user ID
- privacy-preserving network/device fingerprint
- normalized duplicate fingerprint
- current database time

The browser never decides whether a protected write is permitted.

## Controls

The source-controlled foundation provides:

1. **Per-user window** — broad one-minute authenticated-user limit.
2. **Per-network/device window** — keyed/HMAC-derived network identifier; raw IP is not persisted.
3. **Burst bucket** — short-window protection against rapid repeated writes.
4. **Duplicate suppression** — action-specific normalized fingerprint within a bounded window.
5. **Audit events** — allow/reject decision, reason and retry interval without raw network address storage.
6. **Stable response contract** — `rate_limited`, `duplicate`, or `temporarily_blocked`, with retry-after where appropriate.
7. **Action allowlist** — only the nine protected write classes may invoke the shared decision RPC.

## Enforcement placement

All nine protected browser write classes now route through:

`/api/write/[action]`

The route:

- authenticates the caller server-side;
- derives the HMAC network fingerprint server-side;
- derives a deterministic duplicate fingerprint;
- invokes `check_write_abuse`;
- fails closed if the limiter cannot be evaluated;
- performs the business write only after an allow decision;
- assigns authentication-owned IDs server-side rather than trusting caller-supplied user IDs.

RLS remains authoritative for database authorization.

A browser-only timer, disabled button, or client-supplied identity is not enforcement.

## Threshold status

The migration contains deliberately conservative **staging defaults**, not final production tuning:

- short user burst window;
- one-minute per-user window;
- one-minute per-network/action window;
- short duplicate-suppression window.

Exact production thresholds require staging/load evidence and false-positive review. Registration, onboarding and enquiry actions may ultimately require longer duplicate windows than transient station-condition reports.

## CAPTCHA

CAPTCHA is not enabled by default.

It should be introduced only if observed automated abuse persists after server-side limits, duplicate suppression and provider-native authentication protections.

## L1B implementation status

The application integration is complete in source control.

No protected user-facing direct `.insert()` remains under `app/`; the nine protected classes use the trusted server gateway.

The database migration:

`20260927200000_rate_abuse_foundation.sql`

is an **unapplied forward migration**.

It has not been applied to production and must remain unapplied during L1B. The RPC and audit table therefore do not yet exist in the production database.

Production activation requires the L1C staging/recovery gate:

1. establish the approved staging environment;
2. apply the forward migration there;
3. configure a staging-only `ABUSE_FINGERPRINT_SECRET`;
4. exercise allowed, duplicate, burst and sustained-limit behavior;
5. measure false positives;
6. tune thresholds if required;
7. complete backup/restore and deployment gates;
8. only then consider the normal approved production migration path.

Until that activation gate is completed, the application route intentionally fails closed if an authenticated protected write reaches a database where `check_write_abuse` is unavailable.
