#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
export PGHOST PGPORT PGUSER PGPASSWORD

MAIN_DB="observatory_validation"
ROLLBACK_DB="observatory_rollback"
PROJECT_ID="00000000-0000-0000-0000-000000000001"

psql_db() {
  local db="$1"
  shift
  psql -X -v ON_ERROR_STOP=1 -d "$db" "$@"
}

apply_baseline() {
  local db="$1"
  psql_db "$db" -c "create publication supabase_realtime;"
  for migration in supabase/migrations/*.sql; do
    echo "Applying baseline migration to ${db}: ${migration}"
    psql_db "$db" -f "$migration"
  done
}

expect_sql_failure() {
  local label="$1"
  local sql="$2"
  if psql_db "$MAIN_DB" -c "$sql" >/tmp/observatory-expected-failure.log 2>&1; then
    echo "ERROR: ${label} unexpectedly succeeded"
    cat /tmp/observatory-expected-failure.log
    exit 1
  fi
  echo "Expected failure PASS: ${label}"
}

assert_scalar() {
  local label="$1"
  local expected="$2"
  local sql="$3"
  local actual
  actual="$(psql_db "$MAIN_DB" -Atqc "$sql")"
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: ${label}: expected '${expected}', got '${actual}'"
    exit 1
  fi
  echo "Assertion PASS: ${label} = ${actual}"
}

command -v psql >/dev/null
command -v createdb >/dev/null
command -v dropdb >/dev/null
psql --version

# Supabase-specific cluster roles are bootstrapped in the disposable cluster.
# They are NOLOGIN because the test only needs privilege/RLS semantics.
psql_db postgres <<'SQL'
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
SELECT gen_random_uuid();
SQL

for db in "$MAIN_DB" "$ROLLBACK_DB"; do
  dropdb --if-exists "$db"
  createdb "$db"
  apply_baseline "$db"
done

# Real PostgreSQL execution of the candidate adapter.
psql_db "$MAIN_DB" -f supabase/candidates/observatory_v1_candidate.sql

# Structural assertions: tables, columns, constraints, indexes, RLS and grants.
assert_scalar "canonical adapter tables" "4" "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('agents','entities','relationships','transitions');"
assert_scalar "canonical_kind column" "1" "select count(*) from information_schema.columns where table_schema='public' and table_name='knowledge_items' and column_name='canonical_kind';"
assert_scalar "Knowledge completeness constraint" "1" "select count(*) from pg_constraint where conname='knowledge_items_canonical_completeness_check';"
assert_scalar "source_event FK" "1" "select count(*) from pg_constraint where conname='knowledge_items_source_event_id_fkey' and contype='f';"
assert_scalar "required relationship adjacency indexes" "2" "select count(*) from pg_indexes where schemaname='public' and indexname in ('idx_relationships_source','idx_relationships_target');"
assert_scalar "canonical kind index" "1" "select count(*) from pg_indexes where schemaname='public' and indexname='idx_knowledge_canonical_kind';"
assert_scalar "new tables RLS enabled" "4" "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('agents','entities','relationships','transitions') and c.relrowsecurity;"
assert_scalar "new tables expose no RLS policies" "0" "select count(*) from pg_policies where schemaname='public' and tablename in ('agents','entities','relationships','transitions');"
assert_scalar "service_role CRUD on agents" "t" "select has_table_privilege('service_role','public.agents','SELECT,INSERT,UPDATE,DELETE');"
assert_scalar "anon cannot SELECT agents" "f" "select has_table_privilege('anon','public.agents','SELECT');"
assert_scalar "authenticated cannot SELECT agents" "f" "select has_table_privilege('authenticated','public.agents','SELECT');"
assert_scalar "canonical tables not silently added to Realtime" "0" "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename in ('agents','entities','relationships','transitions');"
assert_scalar "baseline Realtime tables preserved" "2" "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename in ('agent_jobs','agent_job_events');"

# Database-level rejection cases.
expect_sql_failure "invalid Agent kind" "insert into agents (kind,name,version) values ('invalid-kind','bad-agent','1');"
expect_sql_failure "canonical Knowledge missing canonical_kind" "insert into knowledge_items (project_id,type,title,content,status,subject_entity_id,epistemic_stage,canonical_payload,producer_agent_id,producer_agent_version,evidence_ids,schema_version) values ('${PROJECT_ID}','observation','missing kind','{}','captured','b3a06943-6b3f-58c9-be00-6e917529fb8e','observation','{}','dd0e056a-8cde-51f6-a14e-5d833b8c4ce3','1.0','{}',1);"

# Load all three canonical fixtures into the real adapter.
node scripts/generate-observatory-postgres-fixtures.mjs > /tmp/observatory-fixtures.sql
psql_db "$MAIN_DB" -f /tmp/observatory-fixtures.sql

assert_scalar "fixture Agents" "5" "select count(*) from agents;"
assert_scalar "fixture Entities" "18" "select count(*) from entities;"
assert_scalar "fixture Knowledge" "6" "select count(*) from knowledge_items where canonical_kind is not null;"
assert_scalar "fixture Relationships" "10" "select count(*) from relationships;"
assert_scalar "fixture Transitions" "3" "select count(*) from transitions;"
assert_scalar "fixture lineage Events" "3" "select count(*) from events where event_type='ObservatoryContribution';"
assert_scalar "research decisions remain Entities" "3" "select count(*) from entities where type='research-decision';"
assert_scalar "informs_decision relationships" "4" "select count(*) from relationships where type='informs_decision';"
assert_scalar "canonical kind round-trips independently of legacy type" "0" "select count(*) from knowledge_items where canonical_kind is not null and canonical_kind <> title;"
assert_scalar "canonical payload round-trips" "0" "select count(*) from knowledge_items where canonical_kind is not null and content::jsonb is distinct from canonical_payload;"
assert_scalar "no legacy confidence inferred" "0" "select count(*) from knowledge_items where canonical_kind is not null and confidence is not null;"
assert_scalar "CAF WAIT decision survives persistence" "1" "select count(*) from entities where type='research-decision' and attributes->>'nextAction'='WAIT' and attributes->>'domainVerdict'='KNOWLEDGE_SUFFICIENT_ACQUISITION_NOT_AUTHORIZED';"
assert_scalar "EXP-2026-013 exact FKC blob survives persistence" "1" "select count(*) from entities where type='observatory-research-run' and attributes->>'label'='EXP-2026-013' and attributes->'scope'->>'blobSha'='d7fa6ff077b8d07aadb5f295d737f52d75d22dba';"
assert_scalar "shared-context lineage preserved" "2" "select count(*) from events where context_fingerprint='sha256:shared-context';"
assert_scalar "explicit parent lineage preserved" "1" "select count(*) from events where parent_event_id is not null;"

# Additional constraint/FK cases after fixture identities exist.
expect_sql_failure "epistemic confidence > 1" "insert into knowledge_items (project_id,type,title,content,status,subject_entity_id,canonical_kind,epistemic_stage,canonical_payload,producer_agent_id,producer_agent_version,evidence_ids,epistemic_confidence,research_run_id,schema_version) values ('${PROJECT_ID}','observation','bad confidence','{}','captured','b3a06943-6b3f-58c9-be00-6e917529fb8e','test','observation','{}','dd0e056a-8cde-51f6-a14e-5d833b8c4ce3','1.0','{}',1.01,'f1a311fc-20c9-5d92-be8a-4c604a8b493a',1);"
expect_sql_failure "both canonical subjects populated" "insert into knowledge_items (project_id,type,title,content,status,subject_entity_id,subject_relationship_id,canonical_kind,epistemic_stage,canonical_payload,producer_agent_id,producer_agent_version,evidence_ids,research_run_id,schema_version) values ('${PROJECT_ID}','observation','two subjects','{}','captured','b3a06943-6b3f-58c9-be00-6e917529fb8e','2809f8c1-6915-50bf-96f8-33f80442ad44','test','observation','{}','dd0e056a-8cde-51f6-a14e-5d833b8c4ce3','1.0','{}','f1a311fc-20c9-5d92-be8a-4c604a8b493a',1);"
expect_sql_failure "unknown source Event FK" "insert into knowledge_items (project_id,type,title,content,status,source_event_id) values ('${PROJECT_ID}','observation','bad event','{}','captured','ffffffff-ffff-ffff-ffff-ffffffffffff');"
expect_sql_failure "Transition idempotency duplicate" "insert into transitions (project_id,subject,kind,agent_id,idempotency_key) values ('${PROJECT_ID}','f1a311fc-20c9-5d92-be8a-4c604a8b493a','research-run-state-changed','dd0e056a-8cde-51f6-a14e-5d833b8c4ce3','ri-tr1');"

# Legacy compatibility: all new canonical fields may remain null.
psql_db "$MAIN_DB" -c "insert into knowledge_items (project_id,type,title,content,status,confidence) values ('${PROJECT_ID}','temporary_note','legacy-compatible','legacy','captured','low');"
assert_scalar "legacy Knowledge remains valid" "1" "select count(*) from knowledge_items where title='legacy-compatible' and canonical_kind is null and epistemic_stage is null;"

# Contradictory canonical Knowledge may coexist; storage does not collapse claims.
psql_db "$MAIN_DB" <<SQL
insert into knowledge_items (id,project_id,type,title,content,status,subject_entity_id,canonical_kind,epistemic_stage,canonical_payload,producer_agent_id,producer_agent_version,evidence_ids,research_run_id,schema_version)
values
('aaaaaaaa-0000-0000-0000-000000000001','${PROJECT_ID}','observation','contradiction-a','{}','captured','44415fd3-53e4-5aa9-8fe1-3a86703ec16d','contradiction-test','observation','{"claim":"A"}','dd0e056a-8cde-51f6-a14e-5d833b8c4ce3','1.0','{}','f1a311fc-20c9-5d92-be8a-4c604a8b493a',1),
('aaaaaaaa-0000-0000-0000-000000000002','${PROJECT_ID}','observation','contradiction-b','{}','captured','44415fd3-53e4-5aa9-8fe1-3a86703ec16d','contradiction-test','observation','{"claim":"NOT A"}','dd0e056a-8cde-51f6-a14e-5d833b8c4ce3','1.0','{}','f1a311fc-20c9-5d92-be8a-4c604a8b493a',1);
SQL
assert_scalar "contradictory Knowledge coexistence" "2" "select count(*) from knowledge_items where canonical_kind='contradiction-test';"

# Atomicity: inject a failure immediately before candidate COMMIT in a second
# disposable database. On connection close PostgreSQL must roll back all DDL.
awk '{ if ($0 == "commit;") { print "select 1/0;"; print "commit;"; } else { print; } }' \
  supabase/candidates/observatory_v1_candidate.sql > /tmp/observatory-candidate-forced-failure.sql
if psql_db "$ROLLBACK_DB" -f /tmp/observatory-candidate-forced-failure.sql >/tmp/observatory-rollback.log 2>&1; then
  echo "ERROR: forced-failure candidate unexpectedly succeeded"
  exit 1
fi
rollback_table="$(psql_db "$ROLLBACK_DB" -Atqc "select to_regclass('public.agents') is null;")"
rollback_column="$(psql_db "$ROLLBACK_DB" -Atqc "select count(*) from information_schema.columns where table_schema='public' and table_name='knowledge_items' and column_name='canonical_kind';")"
baseline_survives="$(psql_db "$ROLLBACK_DB" -Atqc "select to_regclass('public.knowledge_items') is not null;")"
[[ "$rollback_table" == "t" ]] || { echo "ERROR: candidate table survived rollback"; exit 1; }
[[ "$rollback_column" == "0" ]] || { echo "ERROR: candidate column survived rollback"; exit 1; }
[[ "$baseline_survives" == "t" ]] || { echo "ERROR: baseline was damaged by rollback test"; exit 1; }
echo "Atomic rollback PASS"

echo "Observatory PostgreSQL 17 disposable validation PASS"
