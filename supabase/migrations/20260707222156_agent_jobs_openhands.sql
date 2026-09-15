create table if not exists agent_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_description text not null,
  repo_owner text not null,
  repo_name text not null,
  branch text not null default 'main',
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  openhands_conversation_id text,
  result_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references agent_jobs(id) on delete cascade,
  event_type text not null,
  content text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_job_events_job on agent_job_events(job_id);
create index if not exists idx_agent_jobs_conversation on agent_jobs(openhands_conversation_id);

alter table agent_jobs enable row level security;
alter table agent_job_events enable row level security;

create policy "public read agent_jobs" on agent_jobs for select using (true);
create policy "public read agent_job_events" on agent_job_events for select using (true);

alter publication supabase_realtime add table agent_jobs;
alter publication supabase_realtime add table agent_job_events;
