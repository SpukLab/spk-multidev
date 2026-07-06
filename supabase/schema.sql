-- Ejecutar en el SQL editor de Supabase para crear el esquema inicial.
-- Cubre: persistencia de sesión entre dispositivos (sección 11) y
-- cola de Code Intake pendiente (sección 7).

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  github_owner text not null,
  github_repo text not null,
  default_branch text not null default 'main',
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  panel_left_provider text,
  panel_left_model text,
  panel_left_role text,
  panel_right_provider text,
  panel_right_model text,
  panel_right_role text,
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  panel text not null check (panel in ('left', 'right')),
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists code_intake_queue (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  action text not null check (action in ('write', 'delete', 'rename', 'patch')),
  path text not null,
  from_path text,
  find_block text,
  replace_block text,
  content text,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_session on messages(session_id);
create index if not exists idx_intake_session on code_intake_queue(session_id);
