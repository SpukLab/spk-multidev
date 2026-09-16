# Observatory v1 — Canonical Knowledge `kind` correction

Status: PROPOSED CORRECTION TO PR #4
Date: 2026-09-16

## Finding

Disposable-fixture preparation exposed a semantic loss in Section 8 of `forgeworks-observatory-v1-schema-api-delta.md`.

The portable `KnowledgeRecord` contract defines `kind` independently from structured `payload`. PR #4 originally mapped canonical `kind` to the existing `knowledge_items.type` column.

That mapping is not lossless because `knowledge_items.type` is a legacy runtime field constrained to:

`observation | insight | decision | hypothesis | experiment | pattern | adr_candidate | rejected_idea | open_question | implementation_note | temporary_note`

The validated Observatory fixtures use canonical/domain kinds including:

- `dependency-risk`
- `reversibility`
- `capability-knowledge`
- `acquisition-risk`
- `constitutional-finding`

Therefore `knowledge_items.type` cannot represent canonical `kind` without either rejecting valid Knowledge or changing its meaning.

## Correction

The minimum additive adapter delta is:

- add nullable `canonical_kind text` to `knowledge_items`;
- canonical `KnowledgeRecord.kind` maps to `knowledge_items.canonical_kind`;
- legacy `knowledge_items.type` remains unchanged and keeps its existing runtime/UI semantics;
- canonical Knowledge completeness requires non-empty `canonical_kind` when `epistemic_stage` is populated;
- no migration or service may infer canonical `kind` from legacy `type`;
- no legacy row requires backfill.

The corrected portable mapping is therefore:

- canonical `id` = `knowledge_items.id`
- canonical `subject` = non-null canonical subject FK
- canonical `subjectKind` = derived from subject FK
- canonical `kind` = `knowledge_items.canonical_kind`
- canonical `stage` = `epistemic_stage`
- canonical `payload` = `canonical_payload`
- canonical `agentId` = `producer_agent_id`
- canonical `agentVersion` = `producer_agent_version`
- canonical `evidence` = `evidence_ids`
- canonical `confidence` = `epistemic_confidence`
- canonical `schemaVersion` = `schema_version`
- canonical `createdAt` = `created_at`
- canonical `supersedes` = `supersedes_knowledge_id`

## Evidence

A disposable PostgreSQL 17 experiment on child branch `test/observatory-postgres17-disposable` executed the recovered eight-migration production baseline plus the corrected candidate adapter and durably reconstructed Repository Intelligence, CAF and EXP-2026-013 fixtures.

Run: `35123399397`
Job: `104886462261`
Candidate test SHA: `79bea3e6d38cc12e349cf40f7aed064618765568`
Result: **SUCCESS**

The DB test specifically verified that all six canonical Knowledge records preserved their exact `kind` independently from legacy `type`.

## Scope

This is an adapter-field correction, not a new ontology primitive and not a change to Governance Canon.

It supersedes only the PR #4 Section 8 statement that canonical `kind` maps to legacy `knowledge_items.type`. All other PR #4 boundaries remain in force.