#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE="public.ecr.aws/supabase/postgres:17.6.1.171"
NAME="cngx-f2-db-$$"

BASELINE="tests/fixtures/f2/production-compatible-baseline.sql"
ASSERTIONS="tests/fixtures/f2/database-readiness-assert.sql"
RESET="tests/fixtures/f2/rate-limit-concurrency-reset.sql"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "${TMPDIR_PATH:-}"
}
trap cleanup EXIT

docker image inspect "$IMAGE" >/dev/null

TMPDIR_PATH="$(mktemp -d)"

echo "===== F2-03 START ISOLATED POSTGRES ====="

docker run -d \
  --pull=never \
  --name "$NAME" \
  --network none \
  --tmpfs /var/lib/postgresql/data:rw,size=768m \
  --tmpfs /run/postgresql:rw,size=16m \
  -e POSTGRES_PASSWORD=local_disposable_test_only \
  "$IMAGE" >/dev/null

READY=0

for _ in $(seq 1 45); do
  if docker exec "$NAME" \
    pg_isready -U postgres -d postgres \
    >/dev/null 2>&1; then
    READY=1
    break
  fi

  sleep 2
done

if [ "$READY" -ne 1 ]; then
  docker logs --tail 100 "$NAME" 2>&1 || true
  echo "FAIL: disposable Postgres startup"
  exit 1
fi

run_sql() {
  docker exec -i "$NAME" \
    psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 < "$1"
}

echo "===== F2-03 APPLY SANITIZED BASELINE ====="
run_sql "$BASELINE"

echo "===== F2-03 VERIFY PENDING SOURCE HASHES ====="

python3 - <<'PY'
import hashlib
import json
from pathlib import Path

ledger = json.load(
    open("docs/production-migration-ledger.json")
)

expected = {
    item["file"]: item["sha256"]
    for item in ledger["pendingRepositorySources"]
}

for name, digest in expected.items():
    path = Path("supabase/migrations") / name

    if not path.is_file():
        raise SystemExit(f"missing pending source: {name}")

    actual = hashlib.sha256(
        path.read_bytes()
    ).hexdigest()

    if actual != digest:
        raise SystemExit(
            f"hash mismatch: {name}\n"
            f"expected {digest}\n"
            f"actual   {actual}"
        )

    print(f"PASS HASH {actual} {name}")
PY

echo "===== F2-03 APPLY PENDING FORWARD MIGRATIONS ====="

python3 - <<'PY' > "$TMPDIR_PATH/migrations.txt"
import json

ledger = json.load(
    open("docs/production-migration-ledger.json")
)

for item in ledger["pendingRepositorySources"]:
    print("supabase/migrations/" + item["file"])
PY

while IFS= read -r migration; do
  echo "APPLY $(basename "$migration")"
  run_sql "$migration"
done < "$TMPDIR_PATH/migrations.txt"

echo "===== F2-03 DATABASE SECURITY ASSERTIONS ====="
run_sql "$ASSERTIONS"

echo "===== F2-03 CONCURRENCY RESET ====="
run_sql "$RESET"

echo "===== F2-03 ATOMIC CONCURRENCY TEST ====="

RESULTS="$TMPDIR_PATH/concurrency-results.txt"
: > "$RESULTS"

export NAME RESULTS

seq 1 40 | xargs -P 20 -I{} bash -c '
  docker exec "$NAME" \
    psql -X -A -t -U postgres -d postgres \
    -v ON_ERROR_STOP=1 \
    -c "
      set role service_role;
      select allowed
      from public.check_trip_rate_limit_shared(
        '\''trip_plan'\'',
        repeat('\''d'\'',64),
        repeat('\''e'\'',64)
      );
    " \
    | tail -n 1 >> "$RESULTS"
'

ALLOWED="$(grep -c '^t$' "$RESULTS" || true)"
REJECTED="$(grep -c '^f$' "$RESULTS" || true)"
TOTAL="$((ALLOWED + REJECTED))"

echo "concurrent_total=$TOTAL"
echo "concurrent_allowed=$ALLOWED"
echo "concurrent_rejected=$REJECTED"

test "$TOTAL" -eq 40
test "$ALLOWED" -eq 12
test "$REJECTED" -eq 28

echo "PASS: atomic shared quota under 40 concurrent callers"

echo "===== F2-03 COUNTER STATE ====="

docker exec -i "$NAME" \
  psql -X -U postgres -d postgres \
  -v ON_ERROR_STOP=1 <<'SQL'
select
  action,
  subject_kind,
  request_count
from public.trip_rate_limit_counters
where subject_key in (
  repeat('d',64),
  repeat('e',64)
)
order by subject_kind;
SQL

echo "===== F2-03 NO DISPOSABLE CONTAINER LEAK ====="
echo "cleanup is armed"

echo "PASS: F2 database readiness / recovery fixture"
