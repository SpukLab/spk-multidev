-- ADR-010 / FKC-000 v0.3
-- Permission/authority conflict experiment v1.
--
-- Exact-scope pilot: no implicit inheritance and no silent precedence.

create table if not exists permission_directives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  issuer text not null,
  grantee text not null,
  action text not null,
  resource_scope text not null,
  decision text not null check (decision in ('allow','deny')),
  conditions jsonb not null default '{}'::jsonb,
  precedence integer,
  valid_from timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_permission_directives_eval
  on permission_directives(project_id, grantee, action, resource_scope);
create index if not exists idx_permission_directives_project
  on permission_directives(project_id);

alter table permission_directives enable row level security;

create or replace function evaluate_permission_directives(
  p_project_id uuid,
  p_grantee text,
  p_action text,
  p_resource_scope text,
  p_at timestamptz default now()
)
returns table (
  state text,
  allow_count bigint,
  deny_count bigint,
  active_count bigint,
  directive_ids uuid[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with active as (
    select id, decision
    from permission_directives
    where project_id = p_project_id
      and grantee = p_grantee
      and action = p_action
      and resource_scope = p_resource_scope
      and revoked_at is null
      and valid_from <= p_at
      and (expires_at is null or expires_at > p_at)
  ),
  counts as (
    select
      count(*) filter (where decision = 'allow')::bigint as allow_count,
      count(*) filter (where decision = 'deny')::bigint as deny_count,
      count(*)::bigint as active_count,
      coalesce(array_agg(id order by id), '{}'::uuid[]) as directive_ids
    from active
  )
  select
    case
      when active_count = 0 then 'unknown'
      when allow_count > 0 and deny_count > 0 then 'authority_conflict'
      when allow_count > 0 then 'allow'
      when deny_count > 0 then 'deny'
      else 'unknown'
    end as state,
    allow_count,
    deny_count,
    active_count,
    directive_ids
  from counts;
$$;

comment on function evaluate_permission_directives(uuid,text,text,text,timestamptz) is
'Deterministic exact-scope evaluator. Conflicting active allow/deny directives remain AUTHORITY_CONFLICT. precedence is preserved as data but deliberately not used by v1.';
