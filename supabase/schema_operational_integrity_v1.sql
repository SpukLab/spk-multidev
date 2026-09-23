-- ADR-010 / ForgeWorks FKC-000 v0.3
-- Operational Integrity vertical slice v1.
--
-- Apply AFTER the existing Event/Task/Session schema is present.
-- Additive only: no existing table or behavior is replaced.

create table if not exists work_item_session_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  work_item_id uuid not null references tasks(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  linked_by text not null default 'user',
  linked_at timestamptz not null default now(),
  unique (work_item_id, session_id)
);

create index if not exists idx_work_item_session_links_work_item
  on work_item_session_links(work_item_id, linked_at);
create index if not exists idx_work_item_session_links_session
  on work_item_session_links(session_id);

create table if not exists control_definitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  control_key text not null,
  name text not null,
  mechanism text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, control_key)
);

create table if not exists control_runs (
  id uuid primary key default gen_random_uuid(),
  control_definition_id uuid not null references control_definitions(id) on delete restrict,
  project_id uuid not null references projects(id) on delete cascade,
  work_item_id uuid references tasks(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,

  subject_kind text not null,
  subject_id text not null,
  subject_version text,

  executed_at timestamptz not null,
  outcome text not null check (outcome in ('pass','fail','error','unknown')),
  executor text not null,

  environment jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  artifact_ref text,
  created_at timestamptz not null default now()
);

create index if not exists idx_control_runs_work_item
  on control_runs(work_item_id, executed_at desc);
create index if not exists idx_control_runs_subject
  on control_runs(subject_kind, subject_id, subject_version);

create table if not exists evidence_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  work_item_id uuid references tasks(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  control_run_id uuid references control_runs(id) on delete set null,

  claim text not null,
  subject_kind text not null,
  subject_id text not null,
  subject_version text,

  source text not null,
  observed_at timestamptz not null,
  environment jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  verifier text not null,
  verifier_relation text not null check (
    verifier_relation in (
      'external_authoritative',
      'independent',
      'shared_control',
      'subject_controlled',
      'unknown'
    )
  ),
  result text not null check (
    result in ('pass','fail','unknown','partial','not_observed','observed')
  ),
  artifact_ref text,
  coverage jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_records_work_item
  on evidence_records(work_item_id, observed_at desc);
create index if not exists idx_evidence_records_subject
  on evidence_records(subject_kind, subject_id, subject_version);
create index if not exists idx_evidence_records_control_run
  on evidence_records(control_run_id);

-- Server-side only in this first vertical slice.
alter table work_item_session_links enable row level security;
alter table control_definitions enable row level security;
alter table control_runs enable row level security;
alter table evidence_records enable row level security;
