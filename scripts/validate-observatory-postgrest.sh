#!/usr/bin/env bash
set -euo pipefail
: "${PGHOST:=127.0.0.1}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"; : "${PGPASSWORD:=postgres}"
export PGHOST PGPORT PGUSER PGPASSWORD
DB=observatory_validation
URL=http://127.0.0.1:3000
NAME=observatory-postgrest16-disposable
PASS=observatory_postgrest_test
SECRET=observatory-postgrest-disposable-secret-2026
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT

jwt() { ROLE="$1" SECRET="$SECRET" node <<'NODE'
const c=require('node:crypto');
const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const h=e({alg:'HS256',typ:'JWT'}),p=e({role:process.env.ROLE,exp:Math.floor(Date.now()/1000)+3600});
process.stdout.write(`${h}.${p}.`+c.createHmac('sha256',process.env.SECRET).update(`${h}.${p}`).digest('base64url'));
NODE
}
req() { local out=$1; shift; curl -sS -o "$out" -w '%{http_code}' "$@"; }
status() { [[ "$2" == "$3" ]] || { echo "FAIL $1 expected=$2 got=$3"; cat "$4" || true; exit 1; }; echo "PASS $1=$3"; }
count() { LABEL="$1" EXPECTED="$2" FILE="$3" node <<'NODE'
const fs=require('node:fs'),x=JSON.parse(fs.readFileSync(process.env.FILE,'utf8'));
if(!Array.isArray(x)||x.length!==Number(process.env.EXPECTED)) throw Error(`${process.env.LABEL}: ${x.length}`);
console.log(`PASS ${process.env.LABEL}=${x.length}`);
NODE
}

psql -X -v ON_ERROR_STOP=1 -d postgres <<SQL
DO \$\$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN
  CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD '${PASS}';
 ELSE ALTER ROLE authenticator WITH LOGIN NOINHERIT PASSWORD '${PASS}'; END IF;
END \$\$;
ALTER ROLE service_role BYPASSRLS;
GRANT anon, authenticated, service_role TO authenticator;
SQL
psql -X -v ON_ERROR_STOP=1 -d "$DB" -c 'GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;'

docker pull postgrest/postgrest:v16.3 >/dev/null
docker run -d --rm --name "$NAME" --network host \
 -e "PGRST_DB_URI=postgres://authenticator:${PASS}@127.0.0.1:5432/${DB}" \
 -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e "PGRST_JWT_SECRET=${SECRET}" \
 postgrest/postgrest:v16.3 >/dev/null
for _ in $(seq 1 30); do curl -s "$URL/" >/dev/null && break; sleep 1; done
curl -s "$URL/" >/dev/null || { docker logs "$NAME"; exit 1; }
A=$(jwt authenticated); S=$(jwt service_role)

c=$(req /tmp/a1 "$URL/agents?select=id"); status 'anon agents denied' 401 "$c" /tmp/a1
c=$(req /tmp/a2 -H "Authorization: Bearer $A" "$URL/agents?select=id"); status 'auth agents denied' 403 "$c" /tmp/a2
c=$(req /tmp/s1 -H "Authorization: Bearer $S" "$URL/agents?select=id"); status 'service agents' 200 "$c" /tmp/s1; count 'service agents rows' 5 /tmp/s1
c=$(req /tmp/s2 -H "Authorization: Bearer $S" "$URL/entities?select=id"); status 'service entities' 200 "$c" /tmp/s2; count 'service entities rows' 18 /tmp/s2

c=$(req /tmp/k1 "$URL/knowledge_items?select=*&order=id.asc"); status 'anon legacy knowledge' 200 "$c" /tmp/k1; count 'anon legacy rows' 1 /tmp/k1
FILE=/tmp/k1 node <<'NODE'
const r=JSON.parse(require('node:fs').readFileSync(process.env.FILE,'utf8'))[0];
if(r.title!=='legacy-compatible'||r.epistemic_stage!==null||r.canonical_kind!==null) throw Error('legacy projection leak');
console.log('PASS anon legacy row only');
NODE
c=$(req /tmp/k2 -H "Authorization: Bearer $A" "$URL/knowledge_items?select=id,canonical_kind&canonical_kind=not.is.null"); status 'auth canonical filtered' 200 "$c" /tmp/k2; count 'auth canonical rows' 0 /tmp/k2
c=$(req /tmp/e1 "$URL/events?select=id:event_id"); status 'anon lineage filtered' 200 "$c" /tmp/e1; count 'anon visible events' 0 /tmp/e1

c=$(req /tmp/sk -H "Authorization: Bearer $S" "$URL/knowledge_items?select=id,type,canonical_kind&canonical_kind=not.is.null"); status 'service canonical knowledge' 200 "$c" /tmp/sk; count 'service canonical rows' 8 /tmp/sk
FILE=/tmp/sk node <<'NODE'
const r=JSON.parse(require('node:fs').readFileSync(process.env.FILE,'utf8'));
if(!r.every(x=>x.canonical_kind&&x.canonical_kind!==x.type)) throw Error('canonical_kind collapse');
console.log('PASS canonical_kind independent over REST');
NODE
c=$(req /tmp/se -H "Authorization: Bearer $S" "$URL/events?select=event_id&research_run_id=not.is.null"); status 'service lineage events' 200 "$c" /tmp/se; count 'service lineage rows' 3 /tmp/se

c=$(req /tmp/w1 -X POST -H 'Content-Type: application/json' -H "Authorization: Bearer $A" --data '{"type":"observation","title":"blocked","content":"blocked","status":"captured"}' "$URL/knowledge_items"); status 'auth knowledge write denied' 403 "$c" /tmp/w1
c=$(req /tmp/si -X POST -H 'Content-Type: application/json' -H 'Prefer: return=representation' -H "Authorization: Bearer $S" --data '{"kind":"system_process","name":"postgrest-probe","version":"1"}' "$URL/agents"); status 'service insert agent' 201 "$c" /tmp/si; count 'insert representation' 1 /tmp/si
c=$(req /tmp/sd -X DELETE -H "Authorization: Bearer $S" "$URL/agents?name=eq.postgrest-probe"); status 'service delete agent' 204 "$c" /tmp/sd

echo 'Observatory PostgREST 16.3 disposable validation PASS'
