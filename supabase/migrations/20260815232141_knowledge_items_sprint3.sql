create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  session_id uuid references sessions(id) on delete set null,
  source_message_id uuid references messages(id) on delete set null,
  source_event_id uuid,
  type text not null check (type in (
    'observation','insight','decision','hypothesis','experiment',
    'pattern','adr_candidate','rejected_idea','open_question',
    'implementation_note','temporary_note'
  )),
  title text not null,
  content text not null,
  status text not null default 'captured' check (status in ('captured','promoted','rejected')),
  confidence text check (confidence in ('low','medium','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_project on knowledge_items(project_id);
create index if not exists idx_knowledge_status on knowledge_items(status);
create index if not exists idx_knowledge_type on knowledge_items(type);
create index if not exists idx_knowledge_task on knowledge_items(task_id);

alter table knowledge_items enable row level security;
create policy "public read knowledge_items" on knowledge_items for select using (true);
