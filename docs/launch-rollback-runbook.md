# CNGx launch rollback runbook

## Web rollback

1. Freeze further production merges and record the incident/release identifier.
2. Identify the last-good Git commit and the Vercel deployment produced from it. Confirm that the database schema at the current production migration head is backward-compatible with that application build.
3. Prefer Vercel's production rollback mechanism: `vercel rollback <previous-deployment-id-or-url>`. Where rollback-to-specific-deployment is unavailable on the account plan, promote the known-good existing deployment with `vercel promote <deployment-url>` rather than rebuilding it.
4. Do **not** reverse database migrations merely because the web deployment is rolled back. Database rollback requires a separately reviewed forward repair unless an isolated restore has been explicitly approved.
5. After traffic moves, verify `/`, `/stations`, one station detail, `/auth`, admin login, `/admin/stations/publication`, `/marketplace`, `/services`, `/business`, and `/savings`.
6. Verify production station counts and Candidate A/B invariants, check security headers, then review production error logs before lifting the release freeze.

## Database compatibility gate

Before web rollback, compare the last-good application commit with every migration applied after that commit. A rollback is permitted only when the older application can safely tolerate the current schema. If not, contain traffic and create a forward compatibility repair first.

## Evidence to retain

Record the bad deployment ID, last-good deployment ID, Git SHAs, migration head, rollback operator, reason, timestamps, smoke-test result, and any logs/screenshots required for the incident review. Never commit credentials or private customer data to the repository.
