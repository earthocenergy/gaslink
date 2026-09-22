# Station importer isolated-database fixture

**Never run against production.** Use only the product-lead-authorized isolated Supabase database after the Phase 1 migration is applied.

Set `CNGX_ISOLATED_TEST_DATABASE=true`, `SUPABASE_URL`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.

1. Run `first-run.json` without `--apply`: expect 2 new, 0 other categories and no rows inserted.
2. Run it with explicit `--apply`: expect two pending/unverified records with unknown status and null price/queue/open/freshness.
3. Run the identical fixture again: expect 2 unchanged and zero additional rows.
4. Run `conflict.json`: same source reference with changed address must report conflict and must not update the row.
5. Run `possible-duplicate.json`: new source reference with the same normalized operator/address/state must report possible_duplicate and must not insert/update.
6. Mark Fixture Gas A claimed and set status=available, price_per_scm=555, queue_minutes=9, open_now=true. Re-run all fixtures. Confirm the claimed row is never overwritten and operational values remain exactly 555/9/true/available.
7. Confirm row count remains two after all non-new runs.

The fixture URLs use example.invalid intentionally and are not production source data.
