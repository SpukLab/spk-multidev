# ForgeWorks Observatory v1 — Minimal Schema/API Delta

Status: PROPOSED IMPLEMENTATION DELTA — CANON-ALIGNED
Date: 2026-09-16
Depends on:
- Observatory contract PR #2
- production Supabase baseline PR #3
- production baseline SHA `7c5fe1f8277ab7d57f7cb795c01d46e7f7f916b0`
- Governance Canon ADR-002, ADR-003, ADR-006, ADR-007, ADR-008, ADR-009
- Spk_Alchemy canonical primitive reference implementation

This document translates the Observatory v1 contract into the smallest additive runtime/database change that can represent Research Intent, research lineage, evidence, producer identity, epistemic state and research outcomes without inventing a parallel ontology or rewriting existing runtime semantics.

No DDL is applied by this document.

## 1. Verdict

The minimum coherent delta is:

- **4 new persistence collections/tables for already-canonical primitives**: `agents`, `entities`, `relationships`, `transitions`;
- **additive canonical fields only** on the existing `knowledge_items` physical store and `events` operational log;
- **no replacement** of Task, Event Log, Knowledge Layer, ContextProvider or Inspector;
- **no new structural primitive**;
- **no new database product, vector store, Graph-RAG or agent framework**;
- **no automatic Governance Canon promotion**;
- **no UI work in implementation block 1**.

The current `knowledge_items` table remains the physical Knowledge store. Its existing `captured/promoted/rejected` state is preserved as a runtime curation/context lifecycle and is never reinterpreted as epistemic state.

## 2. Canonical-vs-adapter boundary

ADR-009 requires the canonical model to remain independent of the storage engine. Therefore:

- the TypeScript Observatory contracts are the portable semantic boundary;
- Supabase/PostgreSQL is one runtime persistence adapter for `spk-multidev`;
- SQL tables, FKs, RLS and indexes are adapter details, not new canonical authority;
- domain code must not expose SQL concepts as ontology;
- a future IndexedDB/SQLite adapter must be able to represent the same records without changing their semantics.

The candidate SQL generated from this design must therefore live outside `supabase/migrations/` until validated and authorized.

## 3. Primitive alignment

The design must project cleanly to the five canonical structures already implemented in Spk_Alchemy:

### Entity

Minimum portable shape:

- id
- type
- role
- lifecycleState
- attributes
- schemaVersion
- createdAt
- updatedAt when applicable

### Relationship

Minimum portable shape:

- id
- type
- source
- target
- agentId
- evidence references
- metadata
- schemaVersion
- createdAt
- updatedAt when applicable

Relationships require adjacency indexes by source and target.

### Knowledge

Minimum portable shape:

- id
- subject (Entity or Relationship)
- subjectKind
- kind
- epistemic stage
- structured payload
- producer Agent
- producer Agent version
- evidence references
- confidence when applicable
- schemaVersion
- createdAt
- supersedes/revision reference

### Transition

Minimum portable shape:

- id
- subject
- kind
- fromState
- toState
- agentId
- idempotencyKey
- rationale
- context
- schemaVersion
- createdAt

### Agent

Minimum portable shape:

- id
- kind
- name
- version
- metadata
- status
- schemaVersion
- createdAt

Agent kinds initially remain:

`human | analyzer | ai_model | system_process | external_source`.

## 4. New adapter table: `agents`

Proposed PostgreSQL columns:

- `id uuid primary key default gen_random_uuid()`
- `kind text not null`
- `name text not null`
- `version text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `status text not null default 'active'`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`

Checks:

- `kind in ('human','analyzer','ai_model','system_process','external_source')`
- `status in ('active','retired')`

Identity constraint:

- unique `(kind, name, version)`

Provider/model-specific identifiers belong in `metadata`, not in additional canonical fields.

Agent rows are immutable in identity fields (`kind/name/version`). A newer model/analyzer version creates or resolves a different Agent identity rather than mutating the old one.

## 5. New adapter table: `entities`

Proposed PostgreSQL columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id) on delete cascade`
- `type text not null`
- `role text not null`
- `lifecycle_state text not null`
- `attributes jsonb not null default '{}'::jsonb`
- `created_by_agent_id uuid null references agents(id) on delete restrict`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz null`

`created_by_agent_id` and `project_id` are adapter/runtime provenance and scoping fields. They do not alter the portable Entity contract.

Observatory v1 domain Entity types:

- `research-intent`
- `observatory-research-run`
- `evidence-reference`
- `research-subject`
- `research-decision`

These are domain vocabulary built on Entity, not new primitives.

Initial roles:

- `research`
- `evidence`
- `subject`
- `decision`

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
- decision timestamp

## 6. New adapter table: `relationships`

Proposed PostgreSQL columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id) on delete cascade`
- `type text not null`
- `source uuid not null`
- `target uuid not null`
- `agent_id uuid not null references agents(id) on delete restrict`
- `evidence_ids uuid[] not null default '{}'::uuid[]`
- `metadata jsonb not null default '{}'::jsonb`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz null`

`source` and `target` are canonical record identifiers. Their record kind is validated in the domain layer rather than encoded into the Relationship primitive itself.

Required adapter indexes:

- `relationships(source)`
- `relationships(target)`
- `relationships(type)` when justified for current queries

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

Evidence IDs reference `evidence-reference` Entities by convention validated in the domain layer. Rich evidence lineage may additionally use Relationships; the canonical `evidence` field is not removed merely because richer relations exist.

## 7. New adapter table: `transitions`

Proposed PostgreSQL columns:

- `id uuid primary key default gen_random_uuid()`
- `project_id uuid not null references projects(id) on delete cascade`
- `subject uuid not null`
- `kind text not null`
- `from_state text null`
- `to_state text null`
- `agent_id uuid not null references agents(id) on delete restrict`
- `idempotency_key text not null unique`
- `rationale text null`
- `context jsonb not null default '{}'::jsonb`
- `schema_version integer not null default 1`
- `created_at timestamptz not null default now()`
- `event_id uuid null references events(event_id) on delete restrict`

`event_id` and `project_id` are runtime adapter provenance fields. They are not additions to the canonical Transition primitive.

Initial Observatory transition kinds:

- `research-intent-state-changed`
- `research-run-state-changed`
- `knowledge-epistemic-stage-changed`

A Transition records a state change. It does not assert that the changed state is valid, true, authorized or canonical merely because the change occurred.

## 8. Canonical projection of existing `knowledge_items`

`knowledge_items` remains one physical store so that ADR-002's Epistemic Canon remains a view over the same Knowledge store.

Existing fields remain unchanged:

- `id`
- `project_id`
- `task_id`
- `session_id`
- `source_message_id`
- `source_event_id`
- `type`
- `title`
- `content`
- `status` (`captured/promoted/rejected`)
- legacy `confidence` (`low/medium/high`)
- timestamps

Add nullable/compatible canonical columns:

- `subject_entity_id uuid null references entities(id) on delete restrict`
- `subject_relationship_id uuid null references relationships(id) on delete restrict`
- `epistemic_stage text null`
- `canonical_payload jsonb null`
- `producer_agent_id uuid null references agents(id) on delete restrict`
- `producer_agent_version text null`
- `evidence_ids uuid[] null`
- `epistemic_confidence double precision null`
- `research_run_id uuid null references entities(id) on delete restrict`
- `supersedes_knowledge_id uuid null references knowledge_items(id) on delete restrict`
- `schema_version integer not null default 1`

Add a FK to the existing but currently unwired column:

- `source_event_id -> events(event_id) on delete restrict`

Epistemic-stage check:

`observation | hypothesis | validated | canon | deprecated`.

Confidence check:

- `epistemic_confidence is null or (>= 0 and <= 1)`

### Portable canonical mapping

For an Observatory/canonical Knowledge row:

- canonical `id` = `knowledge_items.id`
- canonical `subject` = the non-null `subject_entity_id` or `subject_relationship_id`
- canonical `subjectKind` is derived from which subject FK is populated
- canonical `kind` = `knowledge_items.type`
- canonical `stage` = `epistemic_stage`
- canonical `payload` = `canonical_payload`
- canonical `agentId` = `producer_agent_id`
- canonical `agentVersion` = `producer_agent_version`
- canonical `evidence` = `evidence_ids`
- canonical `confidence` = `epistemic_confidence`
- canonical `schemaVersion` = `schema_version`
- canonical `createdAt` = `created_at`
- canonical `supersedes` = `supersedes_knowledge_id`

The legacy `title/content/confidence/status` fields continue serving current runtime/UI behavior. Canonical Knowledge creation must populate the canonical fields explicitly; it must never synthesize canonical meaning from `promoted/rejected` or `low/medium/high`.

### Canonical completeness checks

Legacy rows may keep all new canonical fields null.

If `epistemic_stage is not null`, require:

- exactly one of `subject_entity_id` / `subject_relationship_id` non-null;
- `canonical_payload` non-null;
- `producer_agent_id` non-null;
- `producer_agent_version` non-null;
- `evidence_ids` non-null (empty array is valid);
- `schema_version >= 1`.

Observatory service-level invariants additionally require:

- `research_run_id` points to an `observatory-research-run` Entity;
- producer Agent exists and its version equals `producer_agent_version` at creation time;
- every `evidence_ids` member resolves to an `evidence-reference` Entity;
- `canon` stage cannot be created/promoted by ordinary Observatory/model APIs.

### Hard non-equivalence

Changing `status` MUST NOT modify `epistemic_stage`.

Changing `epistemic_stage` MUST NOT modify `status`.

Legacy `confidence` MUST NOT be converted implicitly into `epistemic_confidence`.

No migration may infer historical epistemic state from `captured/promoted/rejected`.

## 9. Additive delta to `events`

Add nullable runtime provenance columns:

- `producer_agent_id uuid null references agents(id) on delete restrict`
- `research_run_id uuid null references entities(id) on delete restrict`
- `context_fingerprint text null`
- `parent_event_id uuid null references events(event_id) on delete restrict`

Purpose:

- `producer_agent_id`: identify the system/model that produced a contribution independently of `actor` and `source`;
- `research_run_id`: bind execution/observations to a durable Research Run;
- `context_fingerprint`: detect shared/dependent context across model outputs;
- `parent_event_id`: preserve direct execution lineage.

Existing Event Log rows remain valid with all four columns null.

The Event Log remains an operational occurrence system. It does not become the canonical Transition store.

## 10. Event API compatibility

Current `emitEvent()` returns `boolean`.

Minimal compatible change:

- return `string | null`, where the string is the persisted `event_id`;
- existing truthiness checks such as `if (!logged)` remain valid;
- callers that ignore the return remain valid;
- research flows can retain exact event identity.

No existing caller should be forced to understand Observatory fields; they remain optional parameters.

`POST /api/events/emit` should return `{ ok: true, eventId }` on successful persistence.

## 11. Context lineage and deterministic fingerprint

General chat remains unchanged when no Research Run is active.

When a Research Run is supplied:

1. `ContextBundle.meta` carries optional `researchRunId`;
2. the final budgeted context is transformed into a canonical serialization;
3. volatile fields such as `generatedAt` are excluded from the fingerprint input;
4. ordering is deterministic for arrays/sets whose order is not semantic;
5. SHA-256 of that canonical serialization becomes `context_fingerprint`;
6. `ContextBuilt` is persisted and its event id retained;
7. `/api/chat` receives optional `researchRunId`, `contextEventId`, `contextFingerprint`;
8. server resolves the typed/versioned AI Agent from provider/model identity;
9. `ResponseStarted/Completed/Failed` carry producer Agent + Research Run + parent ContextBuilt event;
10. `/api/chat` returns the completed/failed response event id when available;
11. Knowledge captured from that response can set `source_event_id` exactly.

A different model with the same context fingerprint is not automatically independent.

## 12. Server-side domain boundary

The portable Observatory semantic contracts must live above Supabase-specific DB access.

Proposed layers:

- `lib/observatory/contracts.ts` — engine-independent record/domain contracts
- `lib/observatory/invariants.ts` — pure validation/decision rules
- `lib/db/agents.ts` — Supabase adapter
- `lib/db/entities.ts` — Supabase adapter
- `lib/db/relationships.ts` — Supabase adapter
- `lib/db/transitions.ts` — Supabase adapter
- `lib/db/observatory.ts` — adapter orchestration

Browser code does not receive generic CRUD over canonical primitive tables.

`observatory.ts` owns domain orchestration:

- create Research Intent;
- create/close/suspend Research Run;
- register Research Subject;
- capture Evidence Reference;
- capture canonical research Knowledge using `knowledge_items`;
- record support/contradiction/derivation;
- record convergence assessment;
- record Research Decision;
- enforce that Observatory cannot directly create epistemic `canon` or mutate Governance Canon.

## 13. Proposed API surface

Keep v1 small:

- `GET/POST /api/observatory/intents`
- `GET/POST /api/observatory/runs`
- `POST /api/observatory/runs/[id]/close`
- `POST /api/observatory/evidence`
- `POST /api/observatory/knowledge`

No generic browser-facing endpoints for arbitrary Agent/Entity/Relationship/Transition mutation are required.

Existing `/api/knowledge` remains backward compatible and continues to serve current Knowledge Drawer/curation behavior.

## 14. Security / RLS / Data API

New canonical-adapter tables are server-side infrastructure.

Candidate migration must explicitly:

- enable RLS on `agents`, `entities`, `relationships`, `transitions`;
- create no `anon`/`authenticated` policies for them in v1;
- `REVOKE ALL` from `anon` and `authenticated` on them;
- explicitly grant only required privileges to `service_role`;
- not rely on Supabase automatic Data API exposure defaults.

Existing Event/Task/Knowledge RLS behavior is not changed in implementation block 1.

Adding nullable Observatory columns to `events`/`knowledge_items` must not create new client write authority.

## 15. Migration compatibility

The candidate migration is additive.

No table is renamed or dropped.
No existing field changes meaning.
No existing row must be rewritten to remain valid.

Production contained zero application rows during the 2026-09-15 audit, but compatibility must not rely on that fact.

Therefore:

- new canonical fields are nullable for legacy rows;
- canonical completeness constraints activate only when `epistemic_stage` is used;
- no destructive backfill exists;
- existing Knowledge remains legacy-curated Knowledge until an explicit future migration decision;
- old Event rows remain valid;
- Agent/version history is never backfilled from free-text provider/source strings without explicit evidence.

## 16. Evidence and source independence

Evidence is represented as `evidence-reference` Entities. Canonical Knowledge and Relationship records store evidence IDs directly, while richer lineage can additionally be represented with Relationships.

Required Evidence attributes include exact locator/version/hash when available.

For multi-model research, each contribution records enough lineage to distinguish:

- producer Agent;
- Agent version;
- Research Run;
- source event;
- context fingerprint;
- parent event when directly derived;
- evidence IDs consumed when material;
- material assumptions/method metadata when relevant.

Convergence classification is revisable Knowledge, not a vote count.

Allowed derived classifications in v1:

- `independent`
- `partially_dependent`
- `dependent`
- `unknown`

No numeric consensus threshold is introduced.

## 17. Research Decision model

A Research Decision is an Entity, not Knowledge.

Reason: FKC requires inference, decision, permission, authority and commitment to remain distinguishable.

`research-decision.attributes` must contain:

- domain verdict;
- next action: `BUILD | EXPERIMENT | RESEARCH | WAIT | ESCALATE | REFRAME | REJECT | ABANDON | DO_NOTHING`;
- evidence basis;
- unresolved uncertainty;
- open contradictions;
- authority/decision metadata;
- decision timestamp.

Knowledge informs the decision through `informs_decision` Relationships.

Closing a Research Run requires either:

- an explicit Research Decision; or
- an explicit suspended/abandoned state with rationale.

Closing the run does not authorize implementation by itself.

## 18. Reference fixtures required before UI

### Fixture A — Repository Intelligence

Must represent:

- one Research Intent;
- one external repository Research Subject pinned to exact commit/release;
- multiple Evidence References;
- findings as Knowledge;
- dependency/risk findings;
- a Research Decision such as `EXPERIMENT`, `BUILD`, `REJECT` or `DO_NOTHING` without changing Governance Canon.

### Fixture B — Capability Acquisition Framework

Must prove:

- Knowledge about a capability is distinct from a decision to acquire it;
- dependency/reversibility/security/maintenance evidence remains attached and inspectable;
- acquisition decision is separate from descriptive findings;
- right-to-stop outcomes remain representable.

### Fixture C — EXP-2026-013

Must represent:

- Research Intent;
- run label `EXP-2026-013`;
- FKC-000 exact blob SHA as subject/evidence;
- multiple auditor Agents with explicit versions;
- findings supporting/challenging exact targets;
- at least one dependent lineage and one independently-produced lineage;
- final domain verdict `NO_CHANGE | CLARIFICATION | REVIEW` plus a general next-action value;
- unresolved uncertainty retained after closure.

## 19. Acceptance invariants

Implementation is not accepted unless it demonstrates:

1. Research Run creation fails without an existing Research Intent relation.
2. Canonical Observatory Knowledge fails without subject + structured payload + producer Agent/version + Research Run + epistemic stage + explicit evidence list.
3. `status=promoted` does not change `epistemic_stage`.
4. epistemic-stage transition creates an attributable Transition and does not change curation status.
5. `canon` stage cannot be reached through ordinary model/Observatory capture endpoints.
6. contradictory Knowledge records coexist without overwrite.
7. Evidence references retain exact SHA/version where available.
8. Relationship adjacency is queryable through both source and target indexes.
9. same-context agreeing outputs are not classified independent merely because model ids differ.
10. a Research Decision can conclude `WAIT`, `RESEARCH`, `REJECT` or `DO_NOTHING`.
11. no Observatory operation mutates Governance Canon directly.
12. the three reference fixtures can be reconstructed from durable records without chat history.
13. producer Agent version remains attributable after newer Agent versions exist.
14. existing Task/Knowledge/chat behavior continues when no Observatory fields are supplied.
15. Supabase-specific representation can be projected into the portable primitive contracts without semantic loss.

## 20. Validation strategy before production DDL

`spk-multidev` currently has no automated test runner configured in `package.json`.

Do not silently acquire a testing framework inside this schema block.

Before production migration, validation requires either:

- a Supabase development branch, only after explicit cost approval; or
- a local disposable PostgreSQL/Supabase environment available at no extra service cost.

Until such an environment exists, permitted work is repo-only and reversible:

- candidate SQL stored outside migrations;
- pure TypeScript contracts/invariants;
- fixture data;
- static review against Canon and production baseline.

Full validation later must include:

- applying the recovered 8-file baseline to a disposable environment;
- applying the candidate migration there;
- schema/constraint/index assertions;
- reference fixture persistence/reconstruction;
- TypeScript build;
- security advisor;
- performance advisor;
- explicit proof that production remained unchanged.

## 21. Explicit exclusions from implementation block 1

- no production DDL;
- no UI/Observatory dashboard;
- no autonomous multi-model research loop;
- no model voting;
- no embeddings/vector database;
- no Graph-RAG;
- no auto-promotion to Epistemic Canon;
- no Governance Canon writes;
- no redesign of Task;
- no replacement of current Knowledge Drawer;
- no index cleanup merely because the advisor reports an index unused;
- no unrelated optimization.

## 22. Repo-only execution order

1. finish canonical review of this delta;
2. create candidate SQL under `supabase/candidates/`, never `supabase/migrations/`;
3. create engine-independent Observatory TypeScript contracts/invariants;
4. create Repository Intelligence / CAF / EXP-2026-013 fixtures;
5. statically cross-check candidate SQL against the recovered baseline and contracts;
6. commit + push one coherent recoverable checkpoint;
7. stop before any runtime wiring that depends on unvalidated DDL.

## 23. Later implementation order after disposable DB validation is available

1. validate candidate migration in disposable environment;
2. fix only defects exposed by validation;
3. convert validated candidate into a new real migration without rewriting the eight historical migrations;
4. implement Supabase adapters/domain orchestration;
5. make Event Log return stable event identity while preserving current caller truthiness behavior;
6. wire optional research lineage through ContextBuilt/chat;
7. expose only the small Observatory API surface;
8. validate the three reference fixtures and acceptance invariants;
9. run TypeScript/build and advisors;
10. checkpoint remotely before UI/automation.

## 24. Decision

**This delta is an adapter-aware projection of the existing canonical ontology, not a new ontology. Proceed only with repo-only candidate artifacts until a disposable validation environment is available.**
