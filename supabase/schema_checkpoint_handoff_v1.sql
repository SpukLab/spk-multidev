-- ADR-013 / ADR-010 ACTIVE
-- Checkpoint + Handoff vertical slice v1.
--
-- A checkpoint is an immutable recovery artifact bound to an exact Work Item
-- state and repository HEAD. Session identifiers are intentionally retained
-- without foreign keys so provenance survives Session deletion/archive.

create table if not exists work_checkpoints (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  work_item_id uuid not null references tasks(id) on delete cascade,
  source_session_id uuid not null,

  work_item_updated_at timestamptz not null,
  work_item_snapshot jsonb not null,

  repo_owner text not null,
  repo_name text not null,
  branch text not null,
  repo_head_sha text not null,

  declared_state jsonb not null,
  created_by text not null check (created_by in ('user','system')),
  created_at timestamptz not null,
  version integer not null default 1
);

create index if not exists idx_work_checkpoints_work_item
  on work_checkpoints(work_item_id, created_at desc);
create index if not exists idx_work_checkpoints_project
  on work_checkpoints(project_id, created_at desc);
create index if not exists idx_work_checkpoints_source_session
  on work_checkpoints(source_session_id, created_at desc);
create index if not exists idx_work_checkpoints_repo_state
  on work_checkpoints(repo_owner, repo_name, branch, repo_head_sha);

create table if not exists checkpoint_evidence_links (
  checkpoint_id uuid not null references work_checkpoints(id) on delete cascade,
  evidence_id uuid not null references evidence_records(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (checkpoint_id, evidence_id)
);

create index if not exists idx_checkpoint_evidence_links_evidence
  on checkpoint_evidence_links(evidence_id);

create table if not exists checkpoint_handoffs (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  work_item_id uuid not null references tasks(id) on delete cascade,
  checkpoint_id uuid not null references work_checkpoints(id) on delete cascade,
  target_session_id uuid not null,

  state text not null check (state in ('same_state','changed_state','unknown')),
  reasons text[] not null default '{}'::text[],

  checkpoint_repo_head_sha text not null,
  observed_repo_head_sha text,
  checkpoint_work_item_updated_at timestamptz not null,
  observed_work_item_updated_at timestamptz not null,

  verifier text not null,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now(),
  version integer not null default 1
);

create index if not exists idx_checkpoint_handoffs_checkpoint
  on checkpoint_handoffs(checkpoint_id, evaluated_at desc);
create index if not exists idx_checkpoint_handoffs_work_item
  on checkpoint_handoffs(work_item_id, evaluated_at desc);
create index if not exists idx_checkpoint_handoffs_target_session
  on checkpoint_handoffs(target_session_id, evaluated_at desc);
create index if not exists idx_checkpoint_handoffs_project
  on checkpoint_handoffs(project_id, evaluated_at desc);

-- v1 is server-side-only. No client policies are created.
alter table work_checkpoints enable row level security;
alter table checkpoint_evidence_links enable row level security;
alter table checkpoint_handoffs enable row level security;
