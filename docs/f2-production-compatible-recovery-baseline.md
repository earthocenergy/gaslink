# CNGx F2 Production-Compatible Recovery Baseline

## Status

This document records the F2-03 recovery approach. It does **not** reconstruct or replace missing historical production migration SQL.

- Recorded production migration head: `20260926014037`
- Applied production migration versions: 31
- Exact historical production versions without repository source: 23
- Current unapplied forward migration sources: 5

## Reconciliation rule

The 23 historical versions below remain ledger-known but source-unavailable. They must not be recreated from migration names or inferred SQL.

F2 uses `tests/fixtures/f2/production-compatible-baseline.sql` as a **sanitized, noncanonical, test-only current-schema contract** for disposable recovery and authenticated/RLS testing. It is not inserted into the Supabase migration chain and must never be marked as applied production history.

## Historical source gaps

- `20260920022817` — `init_gaslink_phase0`
- `20260920031605` — `secure_roles_and_operator_workflow`
- `20260920031643` — `lock_internal_trigger_functions`
- `20260920033250` — `allow_backend_role_administration`
- `20260920033941` — `operator_station_update_policy`
- `20260920064019` — `station_registration_and_freshness`
- `20260920100716` — `marketplace_foundation`
- `20260920121326` — `cng_services_foundation`
- `20260920123504` — `gaslink_business_and_marketplace_review`
- `20260920200959` — `gaslink_multi_roles_admin_ops`
- `20260920202547` — `station_admin_moderation_and_freshness`
- `20260920203850` — `role_activation_and_verified_role_sync`
- `20260920205321` — `admin_business_and_equipment_controls`
- `20260920205715` — `account_signup_profile_bootstrap`
- `20260920205821` — `backfill_buyer_role`
- `20260920210920` — `qa_controlled_test_dataset_v2`
- `20260920211729` — `qa_visibility_policy_hardening`
- `20260920212050` — `qa_station_report_visibility_guard`
- `20260921002609` — `harden_rpc_execute_permissions`
- `20260921002900` — `gate_verified_commercial_roles`
- `20260921002954` — `qa_numeric_integrity_constraints`
- `20260921063158` — `qa_performance_indexes_and_rls_cleanup`
- `20260922065101` — `phase1_station_geospatial_foundation`

## Forward recovery validation

The disposable F2 recovery test applies the pending forward migrations strictly from `docs/production-migration-ledger.json`, verifies each SHA-256 first, then executes operator authorization, RLS/privilege, Trip corridor and shared rate-limit adversarial tests.

The fixture contains no production user/station identifiers, no Candidate A/B identifiers, no secrets and no production data.

Passing this fixture demonstrates forward compatibility of the verified schema surface. It does not by itself prove hosted backup restoration or reconstruct the unavailable historical migration chronology.
