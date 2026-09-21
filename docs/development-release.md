# GasLink development and release workflow

GasLink feature work should not be developed directly on `main` by default.

Required sequence:

1. Create a feature/foundation branch from the current known-good `main`.
2. Implement only the approved scope.
3. Run the production build and relevant database/application tests.
4. Confirm a successful Vercel preview deployment for the branch.
5. QA the live preview, including affected authentication, RLS and role workflows.
6. Review the diff and QA evidence.
7. Merge only after approval.
8. Verify the production deployment and repeat critical smoke tests.

Database changes:
- Inspect the live schema before changing it.
- Every new production schema change must have a forward-only migration committed to the repository.
- Never rewrite the historical baseline to disguise drift.
- Regenerate `lib/database.types.ts` from the live/target Supabase schema after schema changes.
- Keep service-role keys and other secrets out of Git.

Release gate: a change is not complete merely because code was committed; build, preview QA, review, merge, and production verification are separate gates.
