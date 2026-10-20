# CNGx staging and recovery readiness

## Staging strategy

Create an isolated Supabase development branch or separate project and bind Vercel preview/release-candidate deployments to it. It must contain synthetic seed/load-test data only, have no production notification credentials or recipients, be safe for destructive migration rehearsal, and be reusable later by mobile preview builds. Preview/staging must never fall back to production Supabase variables.

Current status: **not provisioned**. The connected production project has only its default `main` branch. Supabase branch creation may incur cost, and L1 does not contain cost authorization, so no branch was created.

## Production backup evidence

Production project `knhrgugextsmisyxzdgc` is currently on the Supabase **Free** plan. Supabase's current backup documentation states that managed daily backups are provided to Pro, Team and Enterprise projects; Free-tier projects should regularly export using `supabase db dump` and retain off-site backups. Therefore managed daily backup retention is not verified/available for the current plan.

Current backup result: **foundation blocker**. Before launch, either upgrade to a plan with managed backups or implement and independently verify an automated encrypted off-site logical-backup process with restore tests.

## PITR evidence

Supabase PITR is an add-on for Pro, Team and Enterprise and requires eligible compute. It is not available on the current Free plan. No PITR setting was enabled and no cost-bearing action was taken.

## Restore rehearsal

Never restore over production. Once isolated staging exists:

1. Capture the approved schema/backup artifact and production migration head.
2. Restore/bootstrap only into staging.
3. Verify all public tables/columns/constraints/indexes.
4. Verify functions/RPC definitions and EXECUTE grants.
5. Verify RLS is enabled and policy predicates match the baseline.
6. Verify PostGIS and required extensions.
7. Verify triggers and generated geography behavior.
8. Verify migration head and application connectivity.
9. Run the full test/build chain against staging.
10. Record elapsed restore time and any manual steps; destroy test data when complete.

Current restore rehearsal result: **pending human/cost gate because no safe non-production database exists**.

## Launch objectives

- **Proposed RPO:** 15 minutes or better. This is not currently verified. If Supabase PITR is adopted, its documented worst-case WAL backup interval is substantially tighter than this target.
- **Proposed RTO:** 2 hours for database/platform recovery. This is not currently verified and must be measured in the restore rehearsal.

Until backup availability and a restore rehearsal are evidenced, the recovery gate remains open.
