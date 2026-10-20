# L1B Local Database Reconstruction Result

**Environment:** Alienware / WSL2 / Ubuntu 26.04.1 LTS
**Runtime:** Docker Engine 29.8.1
**Supabase CLI:** 2.118.0
**Database major version:** PostgreSQL 17
**Production data used:** none

## Result

A completely isolated local Supabase environment was initialized successfully.

The first clean migration replay failed while applying:

`20260921125805_restrict_user_role_self_assignment.sql`

with:

`ERROR: relation "public.user_roles" does not exist (SQLSTATE 42P01)`

The immediately preceding repository migration was:

`0001_phase0.sql`

## Root cause

This is a historical migration-source gap, not a Docker/Supabase runtime failure.

The live production database contained `public.user_roles` before
`20260921125805_restrict_user_role_self_assignment` was applied.

However, the repository does not contain the original SQL for the first 22
production migrations that created the complete pre-20260921125805 schema.

`supabase/baseline/2026-09-21-public-schema.sql` is explicitly a documentation
snapshot only and is not executable reconstruction SQL.

The missing historical migrations will not be invented, renamed, or rewritten.

## L1B conclusion

Raw repository migration replay from an empty database is NOT currently
sufficient to reconstruct the production schema.

This is the exact local-only reconstruction blocker permitted by the L1B exit
policy.

Forward migration integrity remains independently testable from the documented
production baseline and migration ledger.

No production database was linked, reset, modified, or supplied with local
test data during this reconstruction attempt.
