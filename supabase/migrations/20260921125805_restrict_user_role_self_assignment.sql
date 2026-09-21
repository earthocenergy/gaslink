-- Forward-only security migration applied to live Supabase as
-- 20260921125805 restrict_user_role_self_assignment.
-- Preserved here so repository state records the production security change.
drop policy if exists "users add own nonadmin roles" on public.user_roles;

create policy "users add own ordinary roles"
on public.user_roles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and role in ('driver','buyer')
);
