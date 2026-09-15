# Supabase production schema baseline — 2026-09-15

Status: VERIFIED READ-ONLY BASELINE

This document records the real production schema of the Supabase project used by `SpukLab/spk-multidev` and reconciles it with the repository. No database mutation was performed while producing this baseline.

## 1. Authoritative production source

Supabase project:

- name: `Spk_Multidev`
- project ref: `jomcqtwnpaeckzxstbkh`
- region: `us-east-2`
- project status during verification: `ACTIVE_HEALTHY`
- PostgreSQL: 17.6
- verification date: 2026-09-15

Repository base used for comparison:

- repository: `SpukLab/spk-multidev`
- branch: `main`
- SHA: `aee8985887ed3aeb1285afe5b1802ca0e4d57125`

## 2. Result

**Production migration history and the live public schema are internally consistent.**

The recoverability problem was repository drift: GitHub contained the initial schema and an accumulated OpenHands schema, but it did not contain the actual ordered Supabase migration history for Event Log, Task, Knowledge or Active Task.

This baseline restores the eight production migration files under `supabase/migrations/` using the exact versions, names and SQL statements stored by `supabase_migrations.schema_migrations`.

No migration was applied to production by this recovery work.

## 3. Production migration history

| Version | Name | Durable capability |
|---|---|---|
| `20260707023149` | `initial_schema` | projects, sessions, messages, Code Intake queue |
| `20260707023527` | `enable_rls_deny_public` | RLS enabled on initial four tables |
| `20260707222156` | `agent_jobs_openhands` | OpenHands jobs/events + public read + Realtime |
| `20260713225442` | `add_start_task_id_to_agent_jobs` | `openhands_start_task_id` |
| `20260813202648` | `event_log_sprint1` | append-oriented Event Log |
| `20260815222742` | `tasks_sprint2` | Task Tier-A projection |
| `20260815232141` | `knowledge_items_sprint3` | Knowledge Tier-A projection |
| `20260824215033` | `active_project_context_sprint4` | active Task operational projection |

## 4. Live public tables

The production `public` schema contains exactly these application tables:

1. `projects`
2. `sessions`
3. `messages`
4. `code_intake_queue`
5. `agent_jobs`
6. `agent_job_events`
7. `events`
8. `tasks`
9. `knowledge_items`
10. `active_project_context`

All ten tables currently have RLS enabled.

## 5. Verified late-schema contracts

### `events`

Live columns:

- `event_id uuid` PK, default `gen_random_uuid()`
- `timestamp timestamptz` NOT NULL, default `now()`
- `project_id uuid` nullable, FK → `projects(id)` ON DELETE SET NULL
- `entity_id text` nullable
- `event_type text` NOT NULL
- `actor text` NOT NULL
- `source text` NOT NULL
- `version integer` NOT NULL, default `1`
- `payload jsonb` NOT NULL, default `{}`
- `created_at timestamptz` NOT NULL, default `now()`

Indexes verified:

- `idx_events_project(project_id)`
- `idx_events_type(event_type)`
- `idx_events_entity(entity_id)`
- `idx_events_timestamp(timestamp)`

RLS policy verified:

- `public read events` — SELECT, `USING (true)`

### `tasks`

Live columns:

- `id uuid` PK
- `project_id uuid` NOT NULL, FK → `projects(id)` ON DELETE CASCADE
- `title text` NOT NULL
- `objective text` nullable
- `acceptance_criteria text` nullable
- `status text` NOT NULL default `open`
- `created_at timestamptz` NOT NULL default `now()`
- `updated_at timestamptz` NOT NULL default `now()`
- `completed_at timestamptz` nullable
- `abandoned_at timestamptz` nullable

Status check verified:

`open | in_progress | completed | abandoned`

Indexes verified:

- `idx_tasks_project(project_id)`
- `idx_tasks_status(status)`

RLS policy verified:

- `public read tasks` — SELECT, `USING (true)`

### `knowledge_items`

Live columns:

- `id uuid` PK
- `project_id uuid` NOT NULL, FK → `projects(id)` ON DELETE CASCADE
- `task_id uuid` nullable, FK → `tasks(id)` ON DELETE SET NULL
- `session_id uuid` nullable, FK → `sessions(id)` ON DELETE SET NULL
- `source_message_id uuid` nullable, FK → `messages(id)` ON DELETE SET NULL
- `source_event_id uuid` nullable, currently no FK
- `type text` NOT NULL
- `title text` NOT NULL
- `content text` NOT NULL
- `status text` NOT NULL default `captured`
- `confidence text` nullable
- `created_at timestamptz` NOT NULL default `now()`
- `updated_at timestamptz` NOT NULL default `now()`

Type check verified:

`observation | insight | decision | hypothesis | experiment | pattern | adr_candidate | rejected_idea | open_question | implementation_note | temporary_note`

Status check verified:

`captured | promoted | rejected`

Confidence check verified:

`low | medium | high`

Indexes verified:

- `idx_knowledge_project(project_id)`
- `idx_knowledge_status(status)`
- `idx_knowledge_type(type)`
- `idx_knowledge_task(task_id)`

RLS policy verified:

- `public read knowledge_items` — SELECT, `USING (true)`

Important Observatory finding retained from the v1 contract: `captured/promoted/rejected` is a runtime curation lifecycle and is not the canonical epistemic stage `observation/hypothesis/validated/canon/deprecated`.

### `active_project_context`

Live columns:

- `project_id uuid` PK, FK → `projects(id)` ON DELETE CASCADE
- `active_task_id uuid` nullable, FK → `tasks(id)` ON DELETE SET NULL
- `updated_at timestamptz` NOT NULL default `now()`

RLS policy verified:

- `public read active_project_context` — SELECT, `USING (true)`

This confirms the ratified design that active Task is operational state and does not mutate `projects`.

## 6. Realtime publication

Production `supabase_realtime` publication currently includes only:

- `agent_jobs`
- `agent_job_events`

No Event Log, Task, Knowledge or Active Task table was found in that publication. This matches the stored migration history.

## 7. Policies and Data API access

Policies present in production:

- `public read agent_jobs`
- `public read agent_job_events`
- `public read events`
- `public read tasks`
- `public read knowledge_items`
- `public read active_project_context`

The initial tables `projects`, `sessions`, `messages` and `code_intake_queue` have RLS enabled with no policies, matching the original deny-public migration and the current Supabase security advisor.

At verification time, database grants to `anon`, `authenticated` and `service_role` exist on all application tables. Effective access remains constrained by RLS.

### Platform-default warning

Supabase is changing automatic Data API exposure/default grants for new tables. The eight files in this baseline intentionally preserve the historical production migrations exactly; they do not retroactively add GRANT statements that were not part of those migrations.

Therefore future schema work must make Data API exposure an explicit design choice rather than relying on project defaults. This is particularly relevant to Observatory migrations created after this baseline.

## 8. Security advisor snapshot

Security advisor reported one informational lint class:

`rls_enabled_no_policy` on:

- `projects`
- `sessions`
- `messages`
- `code_intake_queue`

This is consistent with their intentional server-side/service-role access model in the original schema. No change is made by this baseline.

## 9. Performance advisor snapshot

Observed unindexed foreign keys:

- `active_project_context.active_task_id`
- `agent_jobs.project_id`
- `knowledge_items.session_id`
- `knowledge_items.source_message_id`
- `sessions.project_id`

Observed indexes currently reported as unused include the existing Event, Task and Knowledge indexes plus several original indexes.

These are observations, not authorization to add/drop indexes. Index changes require workload evidence and belong to a separate optimization decision.

## 10. Repository drift before this baseline

### Already represented in GitHub

`supabase/schema.sql` semantically covered:

- `20260707023149_initial_schema`
- `20260707023527_enable_rls_deny_public`

`supabase/schema_agent_jobs.sql` represented the accumulated end state of:

- `20260707222156_agent_jobs_openhands`
- `20260713225442_add_start_task_id_to_agent_jobs`

### Missing from GitHub as durable SQL history

Before this recovery, no versioned SQL migration files existed for:

- `20260813202648_event_log_sprint1`
- `20260815222742_tasks_sprint2`
- `20260815232141_knowledge_items_sprint3`
- `20260824215033_active_project_context_sprint4`

The runtime code depended on those production tables despite the absence of their migration files in the repository.

## 11. Drift verdict

For the inspected scope:

- production migration history: CONSISTENT
- production live table structure: CONSISTENT WITH MIGRATIONS
- PK/FK/check constraints: CONSISTENT WITH MIGRATIONS
- indexes: CONSISTENT WITH MIGRATIONS
- RLS/policies: CONSISTENT WITH MIGRATIONS
- Realtime publication: CONSISTENT WITH MIGRATIONS
- triggers on public application tables: NONE
- GitHub migration history before recovery: INCOMPLETE

Verdict:

**SCHEMA DRIFT: none detected between recorded production migrations and current production objects. REPOSITORY DRIFT: confirmed and recovered by this baseline.**

## 12. Recovery rule from this point

The files under `supabase/migrations/` are the durable historical baseline and must not be rewritten to describe a nicer architecture.

Future schema changes must:

1. start from this migration history;
2. be expressed as a new migration rather than editing an old applied migration;
3. be validated against the real database/schema;
4. run security/performance advisors after DDL;
5. commit + push + record the remote SHA before proceeding to later Observatory layers.

No Observatory schema delta should be implemented until the Observatory v1 contract PR and this schema baseline have both been reviewed.
