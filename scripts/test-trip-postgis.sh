#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

IMAGE="public.ecr.aws/supabase/postgres:17.6.1.171"
MIGRATION="supabase/migrations/20260929210000_trip_intelligence_corridor.sql"
EXPECTED_HASH="5f07ef9207f57643e1b3e260d2b64908207607cf63f4b0ed4503ee9861d70e32"
NAME="cngx-trip-postgis-$$"

cleanup() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

test "$(sha256sum "$MIGRATION" | cut -d' ' -f1)" = \
  "$EXPECTED_HASH"

docker image inspect "$IMAGE" >/dev/null

echo "===== START ISOLATED POSTGIS ====="
docker run -d --pull=never \
  --name "$NAME" \
  --network none \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  --tmpfs /run/postgresql:rw,size=16m \
  -e POSTGRES_PASSWORD=local_disposable_test_only \
  "$IMAGE"

READY=0
for i in $(seq 1 45); do
  if docker exec "$NAME" \
    pg_isready -U postgres -d postgres \
    >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  docker logs --tail 60 "$NAME" 2>&1 || true
  echo "FAIL: PostGIS startup"
  exit 1
fi

run_sql() {
  docker exec -i "$NAME" \
    psql -X -U postgres -d postgres \
    -v ON_ERROR_STOP=1 < "$1"
}

echo "===== SETUP FIXTURES ====="
run_sql tests/fixtures/trip/postgis-setup.sql

echo "===== APPLY UNCHANGED MIGRATION ====="
run_sql "$MIGRATION"

echo "===== ASSERT SECURITY AND CORRIDOR ====="
run_sql tests/fixtures/trip/postgis-assert.sql

echo "PASS: CNGx Trip Intelligence PostGIS regression"
