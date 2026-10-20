# ForgeWorks Observatory v1 — Canon-to-Runtime Mapping and Research Contract

Status: PROPOSED
Date: 2026-09-15
Issue: #1
Base runtime: `aee8985887ed3aeb1285afe5b1802ca0e4d57125`

## 1. Purpose

Define the minimum operational contract required for ForgeWorks Observatory to run durable research on top of the existing `spk-multidev` runtime without inventing a parallel ontology, silently changing Canon, or treating chat/model agreement as evidence by repetition.

This document is a mapping and contract. It authorizes no implementation by itself.

## 2. Verdict

**MINIMAL EXTENSION REQUIRED.**

The current runtime is a strong substrate and should be reused. There is no architectural contradiction requiring a new Kernel primitive, database product, repository, vector store, agent framework, or replacement runtime.

However, the existing `Task` + `knowledge_items` + Event Log model is not yet sufficient to act as the authoritative operational research record required by the Governance Canon and FKC-000.

The missing capability is not “more AI”. It is explicit research identity and provenance:

- Research Intent is not represented as its own durable Entity;
- producer Agent identity is only partially represented;
- Evidence is not first-class enough to audit source lineage;
- source dependence/independence cannot be represented reliably;
- `knowledge_items.status` expresses curation/context lifecycle, not the canonical epistemic stage;
- important research relations are not reified;
- a research outcome/sufficiency judgment is not explicitly bound to the investigation that produced it.

These gaps can be filled as an extension of the existing runtime and the already validated Knowledge Graph contract.

## 3. Durable architectural bases

### Governance / Kernel

- FKC-000 v0.2 is `CANDIDATE`.
- Current Kernel primitive convergence: `STATE / RELATION / EVENT`.
- Knowledge, Belief, Truth and Canon remain distinct.
- occurrence does not imply validity, permission or endorsement;
- reasoning closure, intervention selection and authorization are distinct judgments;
- repeated agreement is not independent convergence;
- provenance loss is cognitive capacity loss.

### Canonical Knowledge Graph

ADR-001..009 are `ACTIVE` and the foundational model is frozen against speculative redesign.

Relevant existing contracts:

- `Research Intent` is an Entity and exists before the investigation it motivates;
- `Knowledge` has a subject, epistemic stage, producer Agent, evidence references, schema version and supersession/revision history;
- `Relationship` is first-class and reified when the relation matters to investigation;
- `Agent` is typed and versioned; free-text author/source labels are not sufficient provenance;
- epistemic stages are `observation | hypothesis | validated | canon | deprecated`;
- Canon is explicit institutional endorsement, not a synonym for confidence or promotion.

The validated Alchemy reference implementation demonstrates the same small canonical core using `Entity`, `Relationship`, `Knowledge`, `Transition` and `Agent`, with `Research Intent` constructed as an Entity. Observatory must reuse this ontology rather than add another root structure.

## 4. What the current runtime already provides

### 4.1 Event Log — KEEP

Current strengths:

- append-oriented operational history;
- common envelope with `project_id`, `entity_id`, event type, actor, source, payload and timestamp;
- Task, Knowledge and Active Task already use stronger Tier-A semantics by refusing the state mutation when the required event cannot be persisted;
- chat execution already records provider/model in event payloads.

Observatory use:

- occurrence/history;
- runtime trace;
- transition provenance;
- context-construction trace;
- execution trace.

It must not be interpreted as proof that an event was valid, authorized, correct or institutionally endorsed.

### 4.2 Task — KEEP AS OPERATIONAL WORK UNIT

Current Task provides:

- stable id;
- project;
- title;
- objective;
- acceptance criteria;
- auditable lifecycle `open → in_progress → completed | abandoned`;
- event-derived reconstruction.

Observatory mapping:

**Task is the operational unit of work used to execute research. Task is NOT Research Intent.**

A Research Intent may span multiple Tasks. Completing a Task means the assigned work completed; it does not mean the research question is resolved, validated, canonized or even answered.

### 4.3 Active Task — KEEP AS RUNTIME SELECTION

`ActiveTaskChanged` correctly represents a current operational focus.

It is not:

- Purpose;
- Research Intent;
- epistemic priority;
- authority;
- Canon.

### 4.4 Knowledge Layer MVP — KEEP, BUT RECLASSIFY ITS SEMANTICS

Current `knowledge_items` provides useful durable memory:

- project/task/session/message provenance;
- typed content;
- human-controlled capture;
- confidence;
- explicit promote/reject action;
- Tier-A event-first mutation.

This is valuable and should remain.

But its current lifecycle:

`captured → promoted | rejected`

is a **curation/context lifecycle**, not ADR-002's epistemic lifecycle.

Therefore:

- `promoted` MUST NOT mean `validated`;
- `promoted` MUST NOT mean `canon`;
- `rejected` MUST NOT mean `false`;
- `confidence = high` MUST NOT mean `validated`, `authorized` or `canonical`.

The existing prompt-priority logic may continue to use promoted/captured as curation relevance, but wording such as “more authoritative” should be removed in implementation because context priority is not authority.

### 4.5 ContextProvider / ContextBundle / Inspector — KEEP

These already solve an important Observatory problem: making the context that informed a model response inspectable.

Current strengths:

- one context entry point;
- active Task + Knowledge assembly;
- explicit inclusion/omission telemetry;
- budget omissions distinguished from irrelevance;
- repository and project context;
- provider/panel trace.

Observatory requires one additional concept here: a reproducible **context fingerprint** and explicit producer Agent identity, so two outputs can be evaluated for shared/dependent context rather than assumed independent because different models produced them.

## 5. Semantic non-equivalences — hard rules

The implementation MUST preserve these distinctions:

| Existing runtime concept | Must NOT be treated as |
|---|---|
| Task objective | Research Intent |
| Task completed | Research resolved / validated |
| Active Task | institutional priority / authority |
| Knowledge captured | observation proven true |
| Knowledge promoted | validated Knowledge / Epistemic Canon |
| Knowledge rejected | false proposition |
| confidence | durability / endorsement / authority |
| source message id | sufficient evidence record |
| AI provider label | typed/versioned Agent identity |
| two model outputs that agree | independent convergence |
| Event occurrence | validity / permission / endorsement |
| implementation success | general Law / Principle |

## 6. Minimum Observatory domain contract

No new primitive is introduced. The following are domain uses of the canonical Knowledge Graph.

### 6.1 Research Intent — REQUIRED

Canonical nature: Entity (`type = research-intent`).

Minimum Observatory attributes:

- `id`;
- `title`;
- `purpose` — why the research exists;
- `scope` — what decision/problem it addresses;
- `successCriteria` — what evidence would make the investigation sufficient for its next decision;
- `lifecycleState = active | closed`;
- creator Agent;
- timestamps;
- schema version.

Research Intent must exist before durable research findings are attributed to the investigation.

### 6.2 Research Run — REQUIRED DOMAIN ENTITY

Observatory needs a stable identity for a concrete investigation such as `EXP-2026-013` without overloading Task.

Canonical nature: Entity (`type = observatory-research-run`, role `research`).

Minimum attributes:

- stable id;
- human label when applicable (`EXP-2026-013`, etc.);
- method / protocol identifier when applicable;
- start/end timestamps;
- status (`active | closed | suspended` as domain lifecycle, not epistemic state);
- project/scope metadata;
- schema version.

Required reified relation:

`research-run —investigates_intent→ research-intent`

A Task may optionally point to a Research Run for UI/workflow convenience. Task remains operational; Research Run is the durable research identity.

### 6.3 Research Subject — REQUIRED WHEN FINDINGS ARE ABOUT AN OBJECT

Findings must have a subject. Examples:

- an external GitHub repository;
- a capability/tool;
- FKC-000 at a specific blob SHA;
- a runtime component;
- an architecture proposal.

These are represented as Entity types/roles in Observatory vocabulary, not as new primitives.

A source must be version-addressable whenever its contents can change. A mutable URL alone is insufficient for high-impact verification.

### 6.4 Agent — REQUIRED

Every knowledge-producing act must have a typed producer Agent.

Required kinds reuse the canonical registry:

- `human`;
- `ai_model`;
- `analyzer`;
- `system_process`;
- `external_source`.

For AI research output the minimum identity must retain:

- provider;
- model identifier;
- version/revision when available;
- relevant runtime metadata;
- active/retired status.

Important distinction:

- the **producer Agent** generated the claim;
- the **curator/transition actor** may be the human who captured, promoted, rejected or institutionally accepted it.

Those identities must not be collapsed.

### 6.5 Evidence — REQUIRED AS DURABLE REFERENCES

Evidence is not declared a new Kernel primitive.

Observatory requires durable evidence references sufficient to recover what was actually inspected. A reference must support, as applicable:

- evidence id;
- source Agent;
- immutable locator or snapshot/version/hash;
- retrieval/observation timestamp;
- evidence kind;
- content digest when feasible;
- metadata required to re-check the claim.

For repository analysis, a branch name such as `main` is not sufficient by itself when a commit SHA is available.

For constitutional verification, the exact FKC blob SHA is evidence; “current FKC” is not.

### 6.6 Knowledge — EXTEND, DO NOT REPLACE

The existing `knowledge_items` lifecycle remains useful as curation state.

Observatory Knowledge needs an **orthogonal epistemic dimension**:

`observation | hypothesis | validated | canon | deprecated`

Minimum required semantics/fields:

- stable knowledge id;
- subject id + subject kind (`entity | relationship`);
- kind;
- existing curation status (`captured | promoted | rejected`) retained separately;
- canonical epistemic stage;
- producer Agent id/version;
- evidence references;
- confidence when applicable;
- Research Run association;
- schema version;
- supersedes/revision reference;
- creation timestamp.

No transition into epistemic `canon` may be caused by the model or by context promotion. It requires the explicit institutional act defined by Governance Canon.

### 6.7 Relationships — REQUIRED, REIFIED

Important Observatory relations cannot be hidden in arrays or inferred from naming.

Minimum relationship vocabulary for v1:

- `investigates_intent` — Research Run → Research Intent;
- `examines` — Research Run → Research Subject;
- `produced_in` — Knowledge → Research Run;
- `supports` — Knowledge/Evidence → Knowledge;
- `contradicts` — Knowledge/Evidence → Knowledge;
- `derived_from` — evidence/output → upstream evidence/output;
- `supersedes` — replacement/revision relation where applicable;
- `informs_decision` — Knowledge → Research Decision.

These are Observatory domain relation types over the existing Relationship primitive, not new structural primitives.

### 6.8 Transition / Event boundary

The Event Log remains the operational EVENT record.

A subset of events represents canonical state transitions when it contains enough structure to preserve:

- subject;
- from state;
- to state;
- responsible Agent/actor;
- timestamp;
- rationale/context where relevant.

Not every Event is a Transition.

Observatory implementation should reuse the Event Log for transition history where this information can be represented without ambiguity; a second generic event system is not justified.

## 7. Required Event Log improvements for research provenance

The existing envelope is close but insufficient for research attribution.

Minimum changes required at contract level:

1. knowledge-producing events carry `producerAgentId` independently of `actor`/`source`;
2. AI response events retain provider + model and resolve them to the registered Agent;
3. `ContextBuilt` records a deterministic context fingerprint/digest plus the Research Run id when present;
4. Knowledge capture can retain the source event/context event id, not only a message id;
5. event persistence used for Tier-A research mutations must return a stable event identity, not only boolean success;
6. documentation must reflect that Task, Knowledge and Active Task events are Tier A where callers already enforce that behavior.

The current `KnowledgeItem` interface already contains `source_event_id`, but the current capture path does not populate it and `emitEvent()` only returns a boolean. Observatory should close that traceability gap instead of inventing another provenance channel.

## 8. Source independence / convergence contract

### 8.1 Core rule

Different model names do not establish independence.

Two outputs may be dependent because they share:

- the same source documents;
- the same prior model answer;
- the same supplied summary;
- the same context bundle;
- substantially identical assumptions;
- one output copied/forwarded into another model.

### 8.2 What must be recorded

For each research contribution, Observatory must be able to recover:

- producer Agent;
- Research Run;
- evidence ids consumed;
- context fingerprint;
- direct parent output when one response was passed into another;
- declared assumptions when material;
- method/role used (auditor, researcher, implementer, etc.).

### 8.3 Convergence classification

Convergence is a derived judgment, never a raw counter of agreeing outputs.

A research synthesis may classify agreement as, for example:

- `independent` — materially distinct evidence/reasoning lineage;
- `partially_dependent` — some shared evidence/context;
- `dependent` — shared upstream output or substantially same evidence/context;
- `unknown` — provenance insufficient to establish independence.

The classification itself is revisable Knowledge and must retain its basis.

No numerical voting rule is established by v1.

## 9. Research outcome / sufficiency contract

Every closed Research Run must produce an explicit outcome record.

The minimum decision outcomes follow FKC's right-to-stop vocabulary:

- `BUILD`;
- `EXPERIMENT`;
- `RESEARCH`;
- `WAIT`;
- `ESCALATE`;
- `REFRAME`;
- `REJECT`;
- `ABANDON`;
- `DO_NOTHING`.

Domain-specific verdicts may exist inside the decision payload, for example EXP-2026-013's `NO_CHANGE | CLARIFICATION | REVIEW`, but they do not replace the general next-action decision.

The outcome must state:

- Research Run;
- Research Intent;
- conclusion/verdict;
- evidence considered sufficient for this decision;
- unresolved uncertainty;
- contradictions still open;
- next action;
- decision Agent/authority;
- timestamp.

Research sufficiency is decision-relative. Closing a research phase does not authorize an implementation automatically.

## 10. Governance boundary

Observatory MAY:

- create Research Intents/Runs;
- capture evidence;
- produce observations/hypotheses/findings;
- record contradiction/convergence;
- assess sufficiency;
- produce recommendations and decision candidates;
- propose ADR/Law/Principle/Constitution changes.

Observatory MUST NOT:

- self-promote a Law/Principle/ADR/FKC change to `ACTIVE`;
- convert `promoted` runtime memory into Epistemic Canon;
- infer authority from repeated user approval;
- treat implementation success as automatic generalization;
- silently erase rejected or contradictory evidence;
- overwrite prior Knowledge instead of preserving revision/supersession history.

Governance Canon retains normative/institutional authority.

## 11. Pre-development research gate v1

This gate is a current ForgeWorks operating discipline, not yet a universal Canon Law.

### Trigger

Run the gate before:

- meaningful new architectural capabilities;
- adoption of external repositories/frameworks/services as durable dependencies;
- irreversible/high-cost design choices;
- changes that alter authority, persistence, provenance, security boundaries or system-wide contracts.

Routine localized fixes, documentation corrections and changes already fully governed by an existing accepted contract do not require a new Observatory study unless new uncertainty appears.

### Required questions

A qualifying change cannot proceed directly to implementation until the Research Run has addressed, proportionally to impact:

1. **Need:** what concrete problem/capability gap exists?
2. **Existing capability:** can the current system already solve it?
3. **Alternatives:** what credible options exist, including doing nothing?
4. **Evidence:** what is known from primary/direct evidence versus model assertion?
5. **Fit:** does it align with FKC and active ADRs?
6. **Dependency:** what upstream/vendor/repository dependency is introduced?
7. **Sovereignty:** does an external system become owner or indispensable source of cognitive assets/history/decision logic?
8. **Authority/security:** what new permissions or attack surface appear?
9. **Maintenance:** who owns upgrades, breakage, deprecation and migration?
10. **Reversibility:** how hard is exit/replacement/fork?
11. **Cost:** direct and operational cost, including complexity cost.
12. **Validation:** what pilot/experiment would provide stronger evidence than further reasoning?
13. **Sufficiency:** enough evidence for which decision specifically?

### Possible gate result

`BUILD | EXPERIMENT | RESEARCH | WAIT | ESCALATE | REFRAME | REJECT | ABANDON | DO_NOTHING`

The gate records a result; it does not manufacture permission to execute.

## 12. Validation against existing Observatory cases

### 12.1 Repository Intelligence — PASS WITH MINIMAL EXTENSION

Purpose already defined in prior Observatory work:

- audit reusable external infrastructure, not collect “interesting repos”;
- evaluate utility/problem solved, savings, maturity, security, integration, dependency/upstream risk, reversibility, multi-model compatibility, persistence and architectural fit;
- process: `External Capability Intake → Audit → Pilot → Measure → Adopt / Reject / Fork`.

Representation under this contract:

- Research Intent: improve ForgeWorks through justified external capability acquisition;
- Research Run: one repository/capability audit or a comparative batch;
- Research Subject: repository at exact owner/repo + commit/release snapshot;
- external repository/source: `external_source` Agent where appropriate;
- findings: Knowledge tied to the repository Entity;
- GitHub/docs/security/community observations: Evidence;
- alternatives/dependencies: reified relations/findings;
- decision: pilot/adopt/reject/fork expressed as outcome plus domain verdict.

Current Task/Knowledge/Event alone cannot preserve all of this lineage, but no new primitive is needed.

### 12.2 Capability Acquisition Framework (CAF) — PASS WITH MINIMAL EXTENSION

CAF's central distinction is preserved:

**acquiring knowledge about a capability is not the same as acquiring the capability.**

A technically valid external capability can still introduce:

- dependency;
- implicit authority;
- maintenance burden;
- architectural constraints;
- security/licensing/supply-chain exposure;
- exit/reversibility cost.

Representation under this contract:

- Research Intent: determine whether acquiring a capability improves decision/system quality enough to justify its costs and dependencies;
- evidence from standards/guidance/case studies remains attributable to exact sources;
- capability candidates are Research Subjects;
- findings remain Knowledge, not adoption decisions;
- adoption/fork/reject is a separate outcome/decision;
- an adopted capability still does not gain governance authority by being installed.

The contract therefore preserves the core CAF boundary instead of collapsing `KNOW ABOUT` into `ADOPT`.

### 12.3 EXP-2026-013 — PASS WITH MINIMAL EXTENSION

Authoritative object:

- `SpukLab/spuklab-canon/01-constitution/FKC-000.md`;
- version `0.2`;
- exact blob SHA `d7fa6ff077b8d07aadb5f295d737f52d75d22dba`.

Primary verification targets:

1. PRIMITIVE (`STATE / RELATION / EVENT`);
2. OCCURRENCE != VALIDITY;
3. STORAGE / ATTRIBUTION != ENDORSEMENT;
4. INFERENCE != DECISION.

Representation under this contract:

- Research Intent: independently verify constitutional sufficiency, not rewrite FKC;
- Research Run label: `EXP-2026-013`;
- Research Subject: exact FKC-000 v0.2 blob;
- each auditor/model: typed/versioned Agent;
- exact FKC text/blob: primary Evidence;
- findings: Knowledge with support/challenge relation and explicit target;
- adversarial cases: evidence/test records tied to findings;
- cross-auditor agreement: convergence classification based on lineage, not vote count;
- final domain verdict: `NO_CHANGE | CLARIFICATION | REVIEW`;
- unresolved gaps remain recorded even when final verdict is `NO_CHANGE`.

This case is especially important because it proves Observatory must distinguish the occurrence/storage of an auditor output from the validity and institutional authority of that output.

## 13. Concrete gaps found in the current repo

### Gap A — Knowledge semantic collision

`knowledge_items.status = captured/promoted/rejected` is currently used for context curation. It cannot substitute for canonical epistemic stage.

Disposition: preserve the field/behavior and add an orthogonal epistemic stage in the implementation design.

### Gap B — Agent provenance is incomplete

The Event Log uses `actor = user | system` and source labels such as GPT/Claude/NIM. Chat events include provider/model in payload, which is useful but not a registered typed/versioned Agent identity.

Disposition: resolve provider/model/external sources to Agent identities; keep actor/source for compatibility/telemetry.

### Gap C — source-message trace is not evidence lineage

Knowledge can link a source message, but external evidence, source versions and shared source lineage are absent.

Disposition: add durable evidence references and reified derivation/dependency relations.

### Gap D — `source_event_id` is structurally anticipated but not wired

`KnowledgeItem` declares `source_event_id`, but `captureKnowledge()` does not populate it and `emitEvent()` only returns boolean success.

Disposition: make research-relevant event identity recoverable and link captured Knowledge to the producing/context events.

### Gap E — context independence cannot be demonstrated

`ContextBuilt` reports included/omitted Knowledge and provider/panel but does not persist an immutable fingerprint of the actual research context nor a Research Run id.

Disposition: add context fingerprint + research-run linkage.

### Gap F — important research relationships are absent

Task↔Knowledge links exist as columns, but Observatory needs first-class relations for intent, subject, evidence support/challenge and derivation.

Disposition: reuse canonical Relationship primitive and introduce only Observatory vocabulary.

### Gap G — current database evolution is not reproducible from repository files

`supabase/schema.sql` contains the initial projects/sessions/messages/Code Intake schema and `schema_agent_jobs.sql` contains OpenHands jobs, but the repository currently contains no versioned migration/schema files for the later Event Log, Task, Knowledge or Active Task tables that the runtime code depends on.

Disposition: **before any Observatory schema implementation**, recover the exact current production schema and establish version-controlled migrations/baseline. Do not modify production schema from conversational memory.

This is a process/recoverability blocker for schema changes, not an ontology blocker.

### Gap H — stale Event Log documentation

`emit.ts` still comments that RepoDeleted is the only real Tier-A exception, while Task, Knowledge and Active Task callers now explicitly enforce Tier-A durability.

Disposition: documentation correction during implementation; no behavioral redesign required.

## 14. Minimum implementation boundary — NOT YET AUTHORIZED

If/when this contract is accepted, the implementation should be intentionally narrow:

- same `spk-multidev` repository;
- same Supabase database;
- recover/version current DB schema first;
- reuse existing Event Log, Task, Knowledge, ContextProvider and Inspector;
- introduce only the canonical records/fields/relations required above;
- no vector database;
- no Graph-RAG requirement;
- no autonomous multi-agent loop;
- no new provider abstraction;
- no new Kernel concept;
- no automatic Canon promotion;
- no migration of unrelated project code.

A separate implementation checkpoint/branch must be created only after contract review.

## 15. Acceptance tests for the future implementation

Observatory v1 is not complete merely because tables exist. It must demonstrate at least:

1. a Research Run cannot become durable without a pre-existing Research Intent;
2. a finding cannot be treated as canonical Knowledge without a subject and attributable producer Agent;
3. `promoted` curation does not change epistemic stage;
4. two agreeing model outputs sharing the same upstream answer are classified as dependent, not independent convergence;
5. two independently produced findings can both remain even when contradictory;
6. a source document/repository can be traced to exact SHA/version where available;
7. a research decision records unresolved uncertainty and the evidence basis for sufficiency;
8. the system can conclude `RESEARCH`, `WAIT`, `REJECT` or `DO_NOTHING`, not only `BUILD`;
9. no Observatory output can directly change Governance Canon status;
10. the three reference cases (Repository Intelligence, CAF, EXP-2026-013) can be reconstructed from durable records without consulting the original chat.

## 16. Decision

**Existing runtime sufficient as substrate. Minimal extension required for authoritative Observatory research. No architectural contradiction found.**

The next step after review is not “build Observatory” broadly. It is:

1. recover and version the real current Supabase schema;
2. translate this contract into the smallest schema/API delta;
3. validate that delta against the three reference cases on fixtures/tests;
4. implement in one recoverable block with typecheck/tests;
5. commit + push + record remote SHA before expanding UI or automation.
