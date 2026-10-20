create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  objective text,
  acceptance_criteria text,
  status text not null default 'open' check (status in ('open','in_progress','completed','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz
);

create index if not exists idx_tasks_project on tasks(project_id);
create index if not exists idx_tasks_status on tasks(status);

alter table tasks enable row level security;
create policy "public read tasks" on tasks for select using (true);
