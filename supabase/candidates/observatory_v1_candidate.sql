-- FORGEWORKS OBSERVATORY V1 — CANDIDATE ONLY
--
-- DO NOT APPLY TO PRODUCTION.
-- DO NOT MOVE INTO supabase/migrations/ UNTIL VALIDATED IN A DISPOSABLE DB.
--
-- Static source baseline:
--   20260824215033_active_project_context_sprint4
--   recovered in PR #3 / SHA 7c5fe1f8277ab7d57f7cb795c01d46e7f7f916b0
--
-- This SQL is a Supabase/PostgreSQL adapter representation of the portable
-- Observatory contracts. It is not canonical ontology authority.

begin;

create table agents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('human','analyzer','ai_model','system_process','external_source')
  ),
  name text not null,
  version text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','retired')),
  schema_version integer not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  constraint agents_identity_unique unique (kind, name, version)
);

create table entities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null,
  role text not null,
  lifecycle_state text not null,
  attributes jsonb not null default '{}'::jsonb,
  created_by_agent_id uuid references agents(id) on delete restrict,
  schema_version integer not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null,
  source uuid not null,
  target uuid not null,
  agent_id uuid not null references agents(id) on delete restrict,
  evidence_ids uuid[] not null default '{}'::uuid[],
  metadata jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table transitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  subject uuid not null,
  kind text not null,
  from_state text,
  to_state text,
  agent_id uuid not null references agents(id) on delete restrict,
  idempotency_key text not null unique,
  rationale text,
  context jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1 check (schema_version >= 1),
  created_at timestamptz not null default now(),
  event_id uuid references events(event_id) on delete restrict
);

-- ADR-003 adjacency requirements.
create index idx_relationships_source on relationships(source);
create index idx_relationships_target on relationships(target);
create index idx_relationships_type on relationships(type);

create index idx_entities_project on entities(project_id);
create index idx_entities_type on entities(type);
create index idx_transitions_subject on transitions(subject);
create index idx_transitions_project on transitions(project_id);

-- Existing physical Knowledge store: add canonical projection fields without
-- changing legacy curation/status/confidence semantics.
alter table knowledge_items
  add column subject_entity_id uuid references entities(id) on delete restrict,
  add column subject_relationship_id uuid references relationships(id) on delete restrict,
  add column epistemic_stage text,
  add column canonical_payload jsonb,
  add column producer_agent_id uuid references agents(id) on delete restrict,
  add column producer_agent_version text,
  add column evidence_ids uuid[],
  add column epistemic_confidence double precision,
  add column research_run_id uuid references entities(id) on delete restrict,
  add column supersedes_knowledge_id uuid references knowledge_items(id) on delete restrict,
  add column schema_version integer not null default 1;

alter table knowledge_items
  add constraint knowledge_items_epistemic_stage_check
  check (
    epistemic_stage is null or epistemic_stage in (
      'observation','hypothesis','validated','canon','deprecated'
    )
  ),
  add constraint knowledge_items_epistemic_confidence_check
  check (
    epistemic_confidence is null or
    (epistemic_confidence >= 0 and epistemic_confidence <= 1)
  ),
  add constraint knowledge_items_schema_version_check
  check (schema_version >= 1),
  add constraint knowledge_items_canonical_completeness_check
  check (
    epistemic_stage is null or (
      canonical_payload is not null and
      producer_agent_id is not null and
      producer_agent_version is not null and
      evidence_ids is not null and
      (
        (subject_entity_id is not null and subject_relationship_id is null) or
        (subject_entity_id is null and subject_relationship_id is not null)
      )
    )
  );

alter table knowledge_items
  add constraint knowledge_items_source_event_id_fkey
  foreign key (source_event_id) references events(event_id) on delete restrict;

create index idx_knowledge_subject_entity on knowledge_items(subject_entity_id);
create index idx_knowledge_subject_relationship on knowledge_items(subject_relationship_id);
create index idx_knowledge_epistemic_stage on knowledge_items(epistemic_stage);
create index idx_knowledge_producer_agent on knowledge_items(producer_agent_id);
create index idx_knowledge_research_run on knowledge_items(research_run_id);
create index idx_knowledge_supersedes on knowledge_items(supersedes_knowledge_id);

-- Operational Event Log lineage. All columns remain nullable for historical rows.
alter table events
  add column producer_agent_id uuid references agents(id) on delete restrict,
  add column research_run_id uuid references entities(id) on delete restrict,
  add column context_fingerprint text,
  add column parent_event_id uuid references events(event_id) on delete restrict;

create index idx_events_producer_agent on events(producer_agent_id);
create index idx_events_research_run on events(research_run_id);
create index idx_events_parent on events(parent_event_id);
create index idx_events_context_fingerprint on events(context_fingerprint);

-- New canonical-adapter tables are server-only in v1.
alter table agents enable row level security;
alter table entities enable row level security;
alter table relationships enable row level security;
alter table transitions enable row level security;

revoke all on table agents from anon, authenticated;
revoke all on table entities from anon, authenticated;
revoke all on table relationships from anon, authenticated;
revoke all on table transitions from anon, authenticated;

grant select, insert, update, delete on table agents to service_role;
grant select, insert, update, delete on table entities to service_role;
grant select, insert, update, delete on table relationships to service_role;
grant select, insert, update, delete on table transitions to service_role;

-- Intentionally unchanged in this candidate:
--   * existing public-read policies on events/tasks/knowledge_items
--   * legacy Knowledge status/confidence fields
--   * Event actor/source fields
--   * current UI/API behavior
--
-- Multi-tenant authorization requires its own explicit threat model and migration.

commit;
