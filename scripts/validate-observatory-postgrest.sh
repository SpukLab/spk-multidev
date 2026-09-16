#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
export PGHOST PGPORT PGUSER PGPASSWORD

DB_NAME="observatory_validation"
POSTGREST_CONTAINER="observatory-postgrest16-disposable"
POSTGREST_URL="http://127.0.0.1:3000"
AUTHENTICATOR_PASSWORD="observatory_postgrest_test"
JWT_SECRET="observatory-postgrest-disposable-secret-2026"

cleanup() {
  docker rm -f "$POSTGREST_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

assert_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  local body_file="$4"
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: ${label}: expected HTTP ${expected}, got ${actual}" >&2
    cat "$body_file" >&2 || true
    docker logs "$POSTGREST_CONTAINER" >&2 || true
    exit 1
  fi
  echo "HTTP PASS: ${label} = ${actual}"
}

assert_json_count() {
  local label="$1"
  local expected="$2"
  local body_file="$3"
  LABEL="$label" EXPECTED="$expected" BODY_FILE="$body_file" node <<'NODE'
const fs = require('node:fs');
const body = JSON.parse(fs.readFileSync(process.env.BODY_FILE, 'utf8'));
if (!Array.isArray(body)) throw new Error(`${process.env.LABEL}: response is not an array`);
if (body.length !== Number(process.env.EXPECTED)) {
  throw new Error(`${process.env.LABEL}: expected ${process.env.EXPECTED} rows, got ${body.length}`);
}
console.log(`JSON PASS: ${process.env.LABEL} = ${body.length}`);
NODE
}

jwt_for_role() {
  local role="$1"
  ROLE="$role" JWT_SECRET="$JWT_SECRET" node <<'NODE'
const crypto = require('node:crypto');
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const header = encode({ alg: 'HS256', typ: 'JWT' });
const payload = encode({
  role: process.env.ROLE,
  exp: Math.floor(Date.now() / 1000) + 3600,
});
const signingInput = `${header}.${payload}`;
const signature = crypto
  .createHmac('sha256', process.env.JWT_SECRET)
  .update(signingInput)
  .digest('base64url');
process.stdout.write(`${signingInput}.${signature}`);
NODE
}

command -v docker >/dev/null
command -v curl >/dev/null
command -v node >/dev/null
command -v psql >/dev/null

# Model only the Postgres/PostgREST role boundary needed for the disposable test.
# PostgREST connects as authenticator, then SET ROLEs to anon/authenticated/service_role.
psql -X -v ON_ERROR_STOP=1 -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD '${AUTHENTICATOR_PASSWORD}';
  ELSE
    ALTER ROLE authenticator WITH LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOSUPERUSER PASSWORD '${AUTHENTICATOR_PASSWORD}';
  END IF;
END
\$\$;
ALTER ROLE service_role BYPASSRLS;
GRANT anon, authenticated, service_role TO authenticator;
SQL

psql -X -v ON_ERROR_STOP=1 -d "$DB_NAME" <<'SQL'
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
SQL

# Use the exact released PostgREST image, not latest.
docker pull postgrest/postgrest:v16.3

docker run -d --rm \
  --name "$POSTGREST_CONTAINER" \
  --network host \
  -e "PGRST_DB_URI=postgres://authenticator:${AUTHENTICATOR_PASSWORD}@127.0.0.1:5432/${DB_NAME}" \
  -e "PGRST_DB_SCHEMAS=public" \
  -e "PGRST_DB_ANON_ROLE=anon" \
  -e "PGRST_JWT_SECRET=${JWT_SECRET}" \
  postgrest/postgrest:v16.3 >/dev/null

ready=0
for _ in $(seq 1 30); do
  code="$(curl -sS -o /tmp/postgrest-ready.json -w '%{http_code}' "$POSTGREST_URL/" || true)"
  if [[ "$code" != "000" ]]; then
    ready=1
    break
  fi
  sleep 1
done
[[ "$ready" == "1" ]] || { docker logs "$POSTGREST_CONTAINER" >&2; fail "PostgREST did not become reachable"; }

docker logs "$POSTGREST_CONTAINER" 2>&1 | tail -n 20 || true

AUTH_TOKEN="$(jwt_for_role authenticated)"
SERVICE_TOKEN="$(jwt_for_role service_role)"
INVALID_TOKEN="${AUTH_TOKEN%?}x"

# Missing grants must block browser/client roles before RLS can expose rows.
status="$(curl -sS -o /tmp/anon-agents.json -w '%{http_code}' "$POSTGREST_URL/agents?select=id")"
assert_status "anon GET canonical agents denied" "401" "$status" /tmp/anon-agents.json

status="$(curl -sS -o /tmp/auth-agents.json -w '%{http_code}' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  "$POSTGREST_URL/agents?select=id")"
assert_status "authenticated GET canonical agents denied" "403" "$status" /tmp/auth-agents.json

status="$(curl -sS -o /tmp/invalid-jwt.json -w '%{http_code}' \
  -H "Authorization: Bearer ${INVALID_TOKEN}" \
  "$POSTGREST_URL/agents?select=id")"
assert_status "invalid JWT rejected" "401" "$status" /tmp/invalid-jwt.json

status="$(curl -sS -o /tmp/anon-write.json -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  --data '{"kind":"system_process","name":"anon-probe","version":"1"}' \
  "$POSTGREST_URL/agents")"
assert_status "anon POST canonical agents denied" "401" "$status" /tmp/anon-write.json

status="$(curl -sS -o /tmp/auth-write.json -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  --data '{"kind":"system_process","name":"authenticated-probe","version":"1"}' \
  "$POSTGREST_URL/agents")"
assert_status "authenticated POST canonical agents denied" "403" "$status" /tmp/auth-write.json

# Server-side elevated role must reach the canonical adapter and bypass RLS.
status="$(curl -sS -o /tmp/service-agents.json -w '%{http_code}' \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  "$POSTGREST_URL/agents?select=id,kind,name,version&order=name.asc")"
assert_status "service_role GET agents" "200" "$status" /tmp/service-agents.json
assert_json_count "service_role fixture Agents" "5" /tmp/service-agents.json

status="$(curl -sS -o /tmp/service-entities.json -w '%{http_code}' \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  "$POSTGREST_URL/entities?select=id,type,role&order=id.asc")"
assert_status "service_role GET entities" "200" "$status" /tmp/service-entities.json
assert_json_count "service_role fixture Entities" "18" /tmp/service-entities.json

status="$(curl -sS -o /tmp/service-knowledge.json -w '%{http_code}' \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  "$POSTGREST_URL/knowledge_items?select=id,type,canonical_kind,epistemic_stage&canonical_kind=not.is.null&order=id.asc")"
assert_status "service_role GET canonical Knowledge" "200" "$status" /tmp/service-knowledge.json
assert_json_count "service_role canonical Knowledge" "6" /tmp/service-knowledge.json

BODY_FILE=/tmp/service-knowledge.json node <<'NODE'
const fs = require('node:fs');
const rows = JSON.parse(fs.readFileSync(process.env.BODY_FILE, 'utf8'));
if (!rows.every((row) => typeof row.canonical_kind === 'string' && row.canonical_kind.length > 0)) {
  throw new Error('canonical_kind did not survive the REST projection');
}
if (!rows.every((row) => row.canonical_kind !== row.type)) {
  throw new Error('canonical_kind unexpectedly collapsed into legacy type');
}
console.log('JSON PASS: canonical_kind remains independent from legacy type over REST');
NODE

# Validate controlled server-side write/delete through PostgREST.
status="$(curl -sS -o /tmp/service-insert.json -w '%{http_code}' \
  -X POST \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  --data '{"kind":"system_process","name":"postgrest-disposable-probe","version":"1.0"}' \
  "$POSTGREST_URL/agents")"
assert_status "service_role POST disposable Agent" "201" "$status" /tmp/service-insert.json
assert_json_count "service_role inserted Agent representation" "1" /tmp/service-insert.json

status="$(curl -sS -o /tmp/service-delete.json -w '%{http_code}' \
  -X DELETE \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  "$POSTGREST_URL/agents?name=eq.postgrest-disposable-probe&version=eq.1.0")"
assert_status "service_role DELETE disposable Agent" "204" "$status" /tmp/service-delete.json

status="$(curl -sS -o /tmp/service-agents-final.json -w '%{http_code}' \
  -H "Authorization: Bearer ${SERVICE_TOKEN}" \
  "$POSTGREST_URL/agents?select=id")"
assert_status "service_role final GET agents" "200" "$status" /tmp/service-agents-final.json
assert_json_count "service_role Agent cleanup restored fixture count" "5" /tmp/service-agents-final.json

echo "Observatory PostgREST 16.3 disposable validation PASS"
