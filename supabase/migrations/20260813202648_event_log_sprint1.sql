create table if not exists events (
  event_id uuid primary key default gen_random_uuid(),
  "timestamp" timestamptz not null default now(),
  project_id uuid references projects(id) on delete set null,
  entity_id text,
  event_type text not null,
  actor text not null,
  source text not null,
  version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_project on events(project_id);
create index if not exists idx_events_type on events(event_type);
create index if not exists idx_events_entity on events(entity_id);
create index if not exists idx_events_timestamp on events("timestamp");

alter table events enable row level security;
create policy "public read events" on events for select using (true);
