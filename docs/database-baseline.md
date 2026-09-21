# GasLink live database baseline

**Captured:** 2026-09-21  
**Supabase project:** `knhrgugextsmisyxzdgc`  
**Repository starting HEAD:** `64877769998d81d9c6ecdea587ccb406b8449460`

This document records the inspected production database. It is a baseline, not a fabricated reconstruction of historical SQL. The existing `supabase/migrations/0001_phase0.sql` is preserved unchanged and is explicitly only a concise Phase 0 snapshot.

## Public schema

All 13 public tables have RLS enabled:

`profiles`, `stations`, `station_reports`, `station_claims`, `search_events`, `marketplace_sellers`, `marketplace_listings`, `marketplace_enquiries`, `service_providers`, `service_offerings`, `service_enquiries`, `business_enquiries`, `user_roles`.

The column/type/default/relationship snapshot is in `supabase/baseline/2026-09-21-public-schema.sql`. Generated PostgREST/Supabase TypeScript types are in `lib/database.types.ts`.

Enums:
- `app_role`: driver, operator, admin
- `claim_status`: pending, approved, rejected
- `station_status`: available, low_supply, out_of_gas, offline, unknown

Important constraints include non-negative station/report prices and queues, non-negative business fleet/demand values, listing quantity > 0, state/status checks, and the expected PK/FK/unique constraints. Relevant FK delete actions were inspected: account-owned records generally CASCADE, station ownership/submission and business/search user references SET NULL, service enquiry offering SET NULL.

## Index baseline

In addition to PK/unique indexes, live production has indexes for business enquiry user, marketplace enquiry buyer/listing, marketplace listing category/seller/status, search-event user, service enquiry customer/offering/provider, service offering category/provider, service provider type, station claim user, station report station/user, and station claimed/submitted user.

## RLS policy baseline

Policies inspected after the Phase-0 security fix:

- `profiles`: authenticated users can select/insert/update their own profile. `protect_profile_role` prevents ordinary users changing the legacy primary role.
- `stations`: approved stations are public; submitter/claimant/admin can see their applicable non-public rows; authenticated users may submit only their own pending, unverified, unclaimed station; claimed operator can update; admin has ALL.
- `station_claims`: users insert/select their own claims; admin can update.
- `station_reports`: users insert/select own reports; only moderated reports for approved stations are public; admin can update.
- `search_events`: anon/authenticated may insert only with null user or their own user id.
- `marketplace_sellers`: verified sellers are public; owner/admin visibility; owner can create/update own profile.
- `marketplace_listings`: public only when listing approved and seller verified; owner/admin visibility; seller can create/update listings belonging to own seller record.
- `marketplace_enquiries`: buyer creates own; buyer, listing seller and admin can read.
- `service_providers`: verified providers public; owner/admin visibility; owner can create/update own provider.
- `service_offerings`: public only when approved and provider verified; owner/admin visibility; provider owner can create.
- `service_enquiries`: customer creates own; customer, provider owner and admin can read.
- `business_enquiries`: authenticated user creates own; user/admin can read.
- `user_roles`: user/admin can read applicable roles; users may delete their own non-admin roles; **direct self-insert is now limited to driver/buyer only**.

Table-level grants to `anon`, `authenticated` and `service_role` are broad Supabase-style grants; RLS is therefore the effective row-level boundary for application roles.

## Role-escalation finding and remediation

Before this task, policy `users add own nonadmin roles` allowed an authenticated user to insert any own role except `admin`. Because authenticated has INSERT privilege on `user_roles`, an ordinary user could directly self-assign `seller`, `service_provider` or `operator`, bypassing the intended verification/approval workflows.

Production was remediated with migration `20260921125805 restrict_user_role_self_assignment`: the direct INSERT policy now permits only own `driver` or `buyer`. Privileged/commercial roles continue to be assigned by trusted SECURITY DEFINER/trigger workflows.

## SECURITY DEFINER inventory

Externally executable by authenticated users:
- `activate_user_role(text)`: safe for self-service; internally allows only driver/buyer.
- `admin_equipment_verification(uuid,text)`: authenticated EXECUTE; internally checks `profiles.role='admin'`.
- `admin_marketplace_listing(uuid,text)`: authenticated EXECUTE; internal admin check.
- `admin_marketplace_seller(uuid,text)`: authenticated EXECUTE; internal admin check.
- `admin_moderate_station_report(uuid,boolean)`: authenticated EXECUTE; internal admin check.
- `admin_review_station_registration(uuid,boolean)`: authenticated EXECUTE; internal admin check; approval assigns operator in `user_roles`.
- `admin_service_offering(uuid,text)`: authenticated EXECUTE; internal admin check.
- `admin_service_provider(uuid,text)`: authenticated EXECUTE; internal admin check.
- `admin_update_business_enquiry(uuid,text)`: authenticated EXECUTE; internal admin check.
- `approve_station_claim(uuid,boolean)`: authenticated EXECUTE; internal admin check.
- `approve_station_registration(uuid,boolean)`: authenticated EXECUTE; internal admin check.

Internal trigger functions are SECURITY DEFINER but are not executable by anon/authenticated:
- `handle_gaslink_new_user()`
- `handle_new_user()`
- `prevent_profile_role_change()`
- `sync_verified_user_role()`

All inspected SECURITY DEFINER functions set `search_path` to `public`. No exposed sensitive admin RPC was found without its own admin authorization check.

## Trigger baseline

- `auth.users` AFTER INSERT: `on_auth_user_created -> handle_new_user()`
- `auth.users` AFTER INSERT: `on_auth_user_created_gaslink -> handle_gaslink_new_user()`
- `profiles` BEFORE UPDATE: `protect_profile_role -> prevent_profile_role_change()`
- `marketplace_sellers` AFTER INSERT/UPDATE: `sync_marketplace_seller_role -> sync_verified_user_role()`
- `service_providers` AFTER INSERT/UPDATE: `sync_service_provider_role -> sync_verified_user_role()`

The duplicate auth-user bootstrap triggers are pre-existing production state; both use idempotent profile insertion, while the GasLink trigger additionally inserts driver and buyer roles.

## Migration ledger

Live migration history inspected:

- 20260920022817 init_gaslink_phase0
- 20260920031605 secure_roles_and_operator_workflow
- 20260920031643 lock_internal_trigger_functions
- 20260920033250 allow_backend_role_administration
- 20260920033941 operator_station_update_policy
- 20260920064019 station_registration_and_freshness
- 20260920100716 marketplace_foundation
- 20260920121326 cng_services_foundation
- 20260920123504 gaslink_business_and_marketplace_review
- 20260920200959 gaslink_multi_roles_admin_ops
- 20260920202547 station_admin_moderation_and_freshness
- 20260920203850 role_activation_and_verified_role_sync
- 20260920205321 admin_business_and_equipment_controls
- 20260920205715 account_signup_profile_bootstrap
- 20260920205821 backfill_buyer_role
- 20260920210920 qa_controlled_test_dataset_v2
- 20260920211729 qa_visibility_policy_hardening
- 20260920212050 qa_station_report_visibility_guard
- 20260921002609 harden_rpc_execute_permissions
- 20260921002900 gate_verified_commercial_roles
- 20260921002954 qa_numeric_integrity_constraints
- 20260921063158 qa_performance_indexes_and_rls_cleanup
- 20260921125805 restrict_user_role_self_assignment

The repository did not contain the original SQL for the first 22 live migrations. They have **not** been invented. From this baseline forward, every production database change must be represented by a new forward-only repository migration. The role-security migration from this task is checked in because its exact SQL is known.

## Generated types

`lib/database.types.ts` is generated from the live Supabase public schema. After any future schema migration, regenerate the types from the target/live schema and commit the updated file in the same branch. This task intentionally does not refactor existing frontend calls to consume all generated types.

## Edge Functions / views / storage

No public custom views were returned by generated types. No GasLink Edge Functions were present at inspection. No application storage bucket dependency is represented by the current frontend; marketplace images remain URL-based.

## Development rule from this point

1. branch from known-good main;
2. inspect target/live DB before schema work;
3. add a forward-only migration for every DB change;
4. apply/test on the intended environment;
5. regenerate DB types;
6. run build and QA;
7. confirm Vercel preview;
8. review before merge;
9. verify production after approved merge.

Never edit this baseline snapshot to make later drift disappear; create a migration.
