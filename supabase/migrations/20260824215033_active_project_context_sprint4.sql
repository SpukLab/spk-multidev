create table if not exists active_project_context (
  project_id uuid primary key references projects(id) on delete cascade,
  active_task_id uuid references tasks(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table active_project_context enable row level security;
create policy "public read active_project_context" on active_project_context for select using (true);
