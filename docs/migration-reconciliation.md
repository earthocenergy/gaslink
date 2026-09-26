# CNGx migration-history reconciliation

Captured: 2026-09-26  
Production project: `knhrgugextsmisyxzdgc`  
Production migration head: `20260925175405_controlled_publication_publish_unpublish`

## Result

Production has **30** applied migrations. The repository currently has **9** migration files. Seven repository timestamp versions exactly match production. Two repository files are logical historical equivalents whose version identifiers do not match the production ledger. Therefore **23 production-applied versions have no exact source migration file in the repository**.

This is a historical-source gap, not authorization to replay or edit production history. Already-applied migrations must never be reapplied merely to make filenames line up.

The machine-readable production ledger is `docs/production-migration-ledger.json`.

## Production ledger

| Version | Production name | Repository source |
|---|---|---|
| 20260920022817 | init_gaslink_phase0 | logical predecessor: `0001_phase0.sql` (version mismatch) |
| 20260920031605 | secure_roles_and_operator_workflow | missing historical source |
| 20260920031643 | lock_internal_trigger_functions | missing historical source |
| 20260920033250 | allow_backend_role_administration | missing historical source |
| 20260920033941 | operator_station_update_policy | missing historical source |
| 20260920064019 | station_registration_and_freshness | missing historical source |
| 20260920100716 | marketplace_foundation | missing historical source |
| 20260920121326 | cng_services_foundation | missing historical source |
| 20260920123504 | gaslink_business_and_marketplace_review | missing historical source |
| 20260920200959 | gaslink_multi_roles_admin_ops | missing historical source |
| 20260920202547 | station_admin_moderation_and_freshness | missing historical source |
| 20260920203850 | role_activation_and_verified_role_sync | missing historical source |
| 20260920205321 | admin_business_and_equipment_controls | missing historical source |
| 20260920205715 | account_signup_profile_bootstrap | missing historical source |
| 20260920205821 | backfill_buyer_role | missing historical source |
| 20260920210920 | qa_controlled_test_dataset_v2 | missing historical source; contained data and must not be reconstructed into the schema baseline |
| 20260920211729 | qa_visibility_policy_hardening | missing historical source |
| 20260920212050 | qa_station_report_visibility_guard | missing historical source |
| 20260921002609 | harden_rpc_execute_permissions | missing historical source |
| 20260921002900 | gate_verified_commercial_roles | missing historical source |
| 20260921002954 | qa_numeric_integrity_constraints | missing historical source |
| 20260921063158 | qa_performance_indexes_and_rls_cleanup | missing historical source |
| 20260921125805 | restrict_user_role_self_assignment | `20260921125805_restrict_user_role_self_assignment.sql` |
| 20260922065101 | phase1_station_geospatial_foundation | logical source: `20260921170000_phase1_station_geospatial_foundation.sql` (version mismatch; do not replay in production) |
| 20260924165232 | grant_service_role_gis_usage | exact match |
| 20260924192838 | station_publication_foundation | exact match |
| 20260924192910 | station_publication_admin_review | exact match |
| 20260925133006 | station_publication_same_state_guard | exact match |
| 20260925143953 | public_discovery_visibility_cutover | exact match |
| 20260925175405 | controlled_publication_publish_unpublish | exact match |

## Reconciliation strategy

1. Treat the production migration ledger as historical truth.
2. Do not rename production ledger entries, repair the ledger, or reapply any already-applied migration.
3. Keep surviving historical migration files for forensic context only.
4. Use the current authoritative schema baseline under `supabase/baseline/` as the deterministic starting point for a clean environment.
5. Apply only forward migrations created after that baseline when reconstructing a new environment.
6. Never place production rows, auth users, secrets, or PII in the baseline.
7. Validate a reconstruction in an isolated non-production project/branch before declaring the migration gate closed.

## Baseline cutover rule

The authoritative baseline is a **schema snapshot**, not a migration to be applied to the existing production database. A fresh environment may use it as its bootstrap schema. Existing production continues from its current ledger head and receives forward-only migrations.

## Remaining proof gate

Migration history is documented and reconciled conceptually, but clean reconstruction remains unverified until the authoritative baseline is applied to an isolated non-production database and compared against production structure. That rehearsal is intentionally not performed on production.
