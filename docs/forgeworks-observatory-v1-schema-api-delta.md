# ForgeWorks Observatory v1 — Minimal Schema/API Delta

Status: PROPOSED IMPLEMENTATION DELTA
Date: 2026-09-15
Depends on:
- Observatory contract PR #2
- production Supabase baseline PR #3
- production baseline SHA `7c5fe1f8277ab7d57f7cb795c01d46e7f7f916b0`

This document translates the accepted Observatory v1 contract into the smallest additive runtime/database change that can represent Research Intent, research lineage, evidence, producer identity, epistemic state and research outcomes without inventing a parallel ontology or rewriting existing runtime semantics.

No DDL is applied by this document.

## 1. Verdict

The minimum coherent delta is:

- **4 new canonical tables**: `agents`, `entities`, `relationships`, `transitions`;
- **additive columns only** on `knowledge_items` and `events`;
- **no replacement** of Task, Event Log, Knowledge Layer, ContextProvider or Inspector;
- **no new database product, vector store, Graph-RAG or agent framework**;
- **no automatic Governance Canon promotion**;
- **no UI work in the first implementation block**.

The current `knowledge_items` table remains the physical Knowledge store. Its existing `captured/promoted/rejected` state is preserved as curation/context state and is not renamed or repurposed.

## 2. Why these four tables are necessary

### `agents`

Required because canonical provenance cannot be represented by `actor = user|system` plus a provider label. A producer must be typed and versioned.

### `entities`

Required because Research Intent, Research Run, Evidence Reference, Research Subject and Research Decision all need stable persistent identity without becoming new structural primitives.

### `relationships`

Required because `supports`, `contradicts`, `derived_from`, `investigates_intent`, `examines` and `informs_decision` must be first-class, attributable and auditable rather than hidden in arrays or inferred from text.

### `transitions`

Required to represent explicit state changes such as epistemic stage changes while keeping occurrence history (`events`) distinct from state-transition semantics. Every Observatory Transition may reference the Event that occurred, but not every Event is a Transition.

This is not a second Event Log. `events` remains the operational occurrence/history log; `transitions` is the canonical reified record of a state change.

## 3. New table: `agents`

Proposed columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid null references projects(id) on delete cascade`
- `kind text not null`
- `name text not null`
- `version text not null`
- `provider text null`
- `model_id text null`
- `metadata jsonb not null default '{}'::jsonb`
- `status text not null default 'active'`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`

Checks:

- `kind in ('human','analyzer','ai_model','system_process','external_source')`
- `status in ('active','retired')`

Uniqueness:

- unique `(kind, name, version)`

Notes:

- for an AI model, `name` should be a stable product/model identity; `provider` and `model_id` preserve provider-specific detail;
- `project_id` is nullable because an Agent may be reused across projects;
- producer Agent and human curator/transition actor remain separate concepts.

## 4. New table: `entities`

Proposed columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id) on delete cascade`
- `type text not null`
- `role text not null`
- `lifecycle_state text not null`
- `attributes jsonb not null default '{}'::jsonb`
- `created_by_agent_id uuid null references agents(id) on delete restrict`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Observatory v1 entity types are domain vocabulary, not new primitives:

- `research-intent`
- `observatory-research-run`
- `evidence-reference`
- `research-subject`
- `research-decision`

Initial roles:

- `research`
- `evidence`
- `subject`
- `decision`

Lifecycle is domain-owned. Observatory services validate legal states for each type. The core table does not hard-code every future domain lifecycle.

### Required attributes by type

`research-intent`:

- title
- purpose
- scope
- successCriteria

Lifecycle: `active | closed`.

`observatory-research-run`:

- label when applicable (`EXP-2026-013`, etc.)
- method/protocol id when applicable
- startedAt
- endedAt when closed
- scope metadata

Lifecycle: `active | suspended | closed`.

`evidence-reference`:

- locator
- immutable version/hash/SHA when available
- retrieval/observation timestamp
- evidence kind
- content digest when feasible
- source metadata required for re-checking

`research-subject`:

- canonical locator/name
- version/hash when mutable
- subject kind

`research-decision`:

- domain verdict
- general next action
- evidence basis
- unresolved uncertainty
- open contradictions
- decision authority metadata

## 5. New table: `relationships`

Proposed columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id) on delete cascade`
- `type text not null`
- `source_id uuid not null`
- `source_kind text not null`
- `target_id uuid not null`
- `target_kind text not null`
- `agent_id uuid not null references agents(id) on delete restrict`
- `metadata jsonb not null default '{}'::jsonb`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`source_kind` / `target_kind` remain extensible text because Relationships may connect Entity, Knowledge, Relationship, Event, Agent or existing runtime records. Application validators must verify referenced records exist and belong to the expected project/scope.

Minimum Observatory relation vocabulary:

- `investigates_intent`
- `examines`
- `produced_in`
- `supports`
- `contradicts`
- `derived_from`
- `supersedes`
- `informs_decision`
- `sourced_from`

No evidence arrays are added to Knowledge. Evidence lineage is expressed through reified relationships.

## 6. New table: `transitions`

Proposed columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id) on delete cascade`
- `subject_id uuid not null`
- `subject_kind text not null`
- `kind text not null`
- `from_state text null`
- `to_state text null`
- `agent_id uuid not null references agents(id) on delete restrict`
- `event_id uuid null references events(event_id) on delete restrict`
- `idempotency_key text not null unique`
- `rationale text null`
- `context jsonb not null default '{}'::jsonb`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`

Initial Observatory transition kinds:

- `research-intent-state-changed`
- `research-run-state-changed`
- `knowledge-epistemic-stage-changed`

A Transition does not grant validity or authority. It records that an explicit state change occurred under an attributable Agent.

## 7. Additive delta to `knowledge_items`

Existing fields and behavior remain intact.

Add nullable compatibility columns:

- `subject_entity_id uuid null references entities(id) on delete restrict`
- `subject_relationship_id uuid null references relationships(id) on delete restrict`
- `epistemic_stage text null`
- `producer_agent_id uuid null references agents(id) on delete restrict`
- `research_run_id uuid null references entities(id) on delete restrict`
- `supersedes_knowledge_id uuid null references knowledge_items(id) on delete restrict`
- `schema_version integer not null default 1`

Add a foreign key to the already-existing but unwired field:

- `source_event_id -> events(event_id) on delete restrict`

Epistemic-stage check:

`observation | hypothesis | validated | canon | deprecated`

Compatibility checks:

- legacy/non-Observatory rows may keep `epistemic_stage = null` and canonical provenance columns null;
- if `epistemic_stage is not null`, exactly one of `subject_entity_id` or `subject_relationship_id` must be non-null;
- if `epistemic_stage is not null`, `producer_agent_id` must be non-null.

Observatory service-level invariant:

- Observatory Knowledge additionally requires a valid `research_run_id`;
- the referenced Entity must be `type = observatory-research-run`;
- `promoted/rejected` remains independent of `epistemic_stage`.

### Hard non-equivalence

Changing `status` MUST NOT modify `epistemic_stage`.

Changing `epistemic_stage` MUST NOT modify `status`.

`epistemic_stage = canon` is not available to model-driven Observatory APIs. It requires a separately authorized institutional operation.

## 8. Additive delta to `events`

Add nullable columns:

- `producer_agent_id uuid null references agents(id) on delete restrict`
- `research_run_id uuid null references entities(id) on delete restrict`
- `context_fingerprint text null`
- `parent_event_id uuid null references events(event_id) on delete restrict`

Purpose:

- `producer_agent_id`: identify the system/model that produced a research contribution independently of `actor` and `source`;
- `research_run_id`: bind execution/observations to a durable Research Run;
- `context_fingerprint`: detect shared/dependent context across model outputs;
- `parent_event_id`: preserve direct derivation when one output/input follows another.

Existing Event Log rows remain valid with all four new columns null.

## 9. Event API compatibility

Current `emitEvent()` returns `boolean`.

Minimal compatible change:

- return `string | null`, where the string is `event_id`;
- existing truthiness checks such as `if (!logged)` remain valid;
- callers that ignore the return remain valid;
- new research flows can retain exact event identity.

No caller should be forced to understand Observatory fields; they remain optional parameters.

`/api/events/emit` should return `{ ok: true, eventId }` on success.

## 10. Chat/context lineage delta

General chat remains unchanged when no Research Run is active.

When a research run is supplied:

1. `ContextBundle.meta` carries optional `researchRunId`;
2. the budgeted ContextBundle is deterministically serialized;
3. SHA-256 of that canonical serialization becomes `context_fingerprint`;
4. `ContextBuilt` is persisted and its event id retained;
5. `/api/chat` receives optional `researchRunId`, `contextEventId` and `contextFingerprint`;
6. the server resolves/creates the typed AI Agent from provider/model;
7. `ResponseStarted/Completed/Failed` carry producer Agent + research run + parent ContextBuilt event;
8. `/api/chat` returns the completed/failed response event id when available;
9. Knowledge captured from that response can set `source_event_id` exactly.

A different model with the same context fingerprint is not automatically classified as independent.

## 11. New server-side domain layer

Do not expose raw canonical-table CRUD directly to the browser.

Proposed server modules:

- `lib/db/agents.ts`
- `lib/db/entities.ts`
- `lib/db/relationships.ts`
- `lib/db/transitions.ts`
- `lib/db/observatory.ts`

`observatory.ts` owns domain validation and orchestration:

- create Research Intent;
- create/close/suspend Research Run;
- register Research Subject;
- capture Evidence Reference;
- capture canonical research Knowledge using existing `knowledge_items`;
- record support/contradiction/derivation;
- record convergence assessment;
- record Research Decision;
- enforce that Observatory cannot directly create epistemic `canon` or mutate Governance Canon.

## 12. Proposed API surface

Keep the first implementation API small:

- `GET/POST /api/observatory/intents`
- `GET/POST /api/observatory/runs`
- `POST /api/observatory/runs/[id]/close`
- `POST /api/observatory/evidence`
- `POST /api/observatory/knowledge`

No generic browser-facing endpoints for arbitrary Agent/Entity/Relationship/Transition mutation are required for v1.

Existing `/api/knowledge` remains backward compatible and continues to serve the current Knowledge Drawer/curation flow.

## 13. Security / RLS / Data API

New canonical tables are server-side infrastructure.

Migration must explicitly:

- enable RLS on `agents`, `entities`, `relationships`, `transitions`;
- create no `anon`/`authenticated` policies in v1;
- `REVOKE ALL` from `anon` and `authenticated` on these four tables;
- explicitly grant required privileges to `service_role`;
- not rely on Supabase's changing automatic Data API exposure defaults.

Existing public-read policies on Event/Task/Knowledge are not changed in this implementation block.

Adding Observatory columns to `events`/`knowledge_items` does not create new client write authority because existing RLS write restrictions remain.

## 14. Migration compatibility

The migration is additive.

No table is renamed or dropped.
No existing column changes meaning.
No existing row must be rewritten to remain valid.

Current production observation: application tables had zero rows during the 2026-09-15 schema audit. The migration must nevertheless remain compatible with non-empty installations.

Therefore:

- new provenance/epistemic columns are nullable;
- canonical checks activate only when canonical fields are used;
- no destructive backfill is required;
- existing Knowledge remains legacy-curated Knowledge until explicitly migrated by a future decision;
- old Event rows remain valid.

No migration should infer historical epistemic state from `promoted/rejected`.

## 15. Evidence and source independence

Evidence is represented as `entities.type = evidence-reference` plus Relationships.

Required Evidence attributes include exact locator/version/hash when available.

For multi-model research, a contribution records:

- producer Agent;
- Research Run;
- source event;
- context fingerprint;
- parent event when directly derived;
- relationships to Evidence consumed when material.

Convergence classification is stored as revisable Knowledge, not a vote count.

Allowed derived classifications in v1:

- `independent`
- `partially_dependent`
- `dependent`
- `unknown`

No numeric consensus threshold is introduced.

## 16. Research decision model

A Research Decision is an Entity, not Knowledge.

Reason: FKC requires decisions/authority/commitment to remain distinguishable from descriptive propositions.

`research-decision.attributes` must contain:

- domain verdict;
- next action: `BUILD | EXPERIMENT | RESEARCH | WAIT | ESCALATE | REFRAME | REJECT | ABANDON | DO_NOTHING`;
- evidence basis;
- unresolved uncertainty;
- open contradictions;
- authority/decision metadata;
- decision timestamp.

Knowledge informs the decision through `relationships.type = informs_decision`.

Closing a Research Run requires an explicit Research Decision or an explicit suspension/abandonment rationale.

## 17. Reference fixtures required before UI

### Fixture A — Repository Intelligence

Must represent:

- one Research Intent;
- one external repository Research Subject pinned to exact commit/release;
- multiple Evidence References;
- findings as Knowledge;
- dependency/risk findings;
- outcome `EXPERIMENT`, `BUILD`, `REJECT` or `DO_NOTHING` without changing Canon.

### Fixture B — Capability Acquisition Framework

Must prove:

- `knowledge about capability` is distinct from `decision to acquire capability`;
- dependency/reversibility/security/maintenance evidence can remain attached to the subject;
- adoption decision is separate from findings.

### Fixture C — EXP-2026-013

Must represent:

- Research Intent;
- run label `EXP-2026-013`;
- FKC-000 exact blob SHA as subject/evidence;
- multiple auditor Agents;
- findings supporting/challenging exact targets;
- at least one dependent lineage and one independently-produced lineage;
- final domain verdict `NO_CHANGE | CLARIFICATION | REVIEW` plus a general next-action value;
- unresolved uncertainty retained after closure.

## 18. Acceptance invariants

The first implementation is not accepted unless it demonstrates:

1. Research Run creation fails without an existing Research Intent relation.
2. Observatory Knowledge fails without subject + producer Agent + Research Run + epistemic stage.
3. `status=promoted` does not change `epistemic_stage`.
4. epistemic-stage transition creates an attributable Transition and does not change curation status.
5. `canon` stage cannot be reached through model/Observatory capture endpoints.
6. contradictory Knowledge records coexist without overwrite.
7. Evidence references retain exact SHA/version where available.
8. same-context agreeing outputs are not classified independent merely because model ids differ.
9. a Research Decision can conclude `WAIT`, `RESEARCH`, `REJECT` or `DO_NOTHING`.
10. no Observatory operation mutates the Governance Canon repository directly.
11. the three reference fixtures can be reconstructed from durable database records without consulting chat history.
12. existing Task/Knowledge/chat behavior continues to compile and operate when no Observatory fields are supplied.

## 19. Validation strategy before production DDL

`spk-multidev` currently has no automated test runner configured in `package.json`.

Do not silently add a testing framework as part of this schema delta; that would itself be a new capability/dependency acquisition.

Before production migration, use one of these evidence paths under a separately authorized validation block:

- a Supabase development branch created from the recovered migration history; or
- a local disposable PostgreSQL/Supabase environment proven equivalent enough for schema/API tests.

Validation must include:

- migration from the 8-file baseline;
- schema/constraint assertions;
- API/domain fixture tests for the three reference cases;
- TypeScript compilation/build;
- Supabase security advisor;
- Supabase performance advisor;
- explicit verification that production has not changed until validation passes.

If a Supabase development branch is chosen, its cost must be confirmed before creation.

## 20. Explicit exclusions from implementation block 1

- no UI/Observatory dashboard;
- no autonomous multi-model research loop;
- no model voting;
- no embeddings/vector database;
- no Graph-RAG;
- no auto-promotion to Epistemic Canon;
- no Governance Canon writes;
- no redesign of Task;
- no replacement of current Knowledge Drawer;
- no cleanup of existing indexes merely because advisor reports them unused;
- no optimization work unrelated to Observatory.

## 21. Implementation order after approval

1. create one new migration from the recovered baseline;
2. add `agents/entities/relationships/transitions` and additive columns;
3. implement DB access modules with strict domain invariants;
4. make Event Log return stable event identity while preserving caller truthiness behavior;
5. wire optional research lineage through ContextBuilt/chat without affecting ordinary chat;
6. add Observatory APIs only;
7. load the three reference fixtures in validation environment;
8. run schema/API invariants, TypeScript/build and advisors;
9. fix only defects exposed by those validations;
10. commit + push one coherent implementation checkpoint and record remote SHA;
11. only then consider UI or automation.

## 22. Decision

**Authorize only this additive design as the candidate implementation delta. Do not broaden the first Observatory implementation beyond it without new evidence.**
