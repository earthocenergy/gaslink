# CNGx migration-history reconciliation

Captured: 2026-09-26  
Production project: `knhrgugextsmisyxzdgc`  
Production migration head: `20260926014037_foundation_performance_and_rpc_hardening`

## Result

Production now has **31** applied migrations, including the L1 foundation migration. The repository has **10** migration files. Eight repository timestamp versions exactly match production. Two repository files are logical historical equivalents whose version identifiers do not match the production ledger. Therefore **23 production-applied versions have no exact source migration file in the repository**.

This is a historical-source gap, not authorization to replay or edit production history. Already-applied migrations must never be reapplied merely to make filenames line up.

The machine-readable production ledger is `docs/production-migration-ledger.json`.

## Production ledger reconciliation

- `0001_phase0.sql` is the surviving logical predecessor of production `20260920022817_init_gaslink_phase0`, but its version does not match.
- Production migrations from `20260920031605` through `20260921063158` have no exact repository source files.
- `20260921125805_restrict_user_role_self_assignment.sql` exactly matches production.
- Repository `20260921170000_phase1_station_geospatial_foundation.sql` is the logical source for production `20260922065101_phase1_station_geospatial_foundation`; do not replay it on production.
- Repository migrations from `20260924165232` through `20260926014037` exactly match production versions.

## Reconciliation strategy

1. Treat the production migration ledger as historical truth.
2. Do not rename production ledger entries, repair the ledger, or reapply any already-applied migration.
3. Keep surviving historical migration files for forensic context only.
4. Use the current authoritative schema baseline manifest in `docs/current-schema-baseline.md` plus a future sanitized executable schema dump as the deterministic cutover point for a clean environment.
5. Apply only forward migrations created after that baseline when reconstructing a new environment.
6. Never place production rows, auth users, secrets, or PII in the baseline.
7. Validate a reconstruction in an isolated non-production project/branch before declaring the migration gate closed.

## Baseline cutover rule

The authoritative baseline is a **schema snapshot**, not a migration to be applied to the existing production database. Existing production continues from its current ledger head and receives forward-only migrations.

## Remaining proof gate

Migration history is reconciled and the exact current ledger is source-controlled, but deterministic clean reconstruction remains unverified until a sanitized executable schema-only dump is captured and restored into an isolated non-production database for comparison. That rehearsal must not be performed over production.
