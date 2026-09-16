# Observatory v1 — Static Preflight Review — 2026-09-16

Status: REPO-ONLY / NO DATABASE EXECUTION

## Scope

This review checks the proposed Observatory v1 delta against:

- the recovered production Supabase baseline;
- Governance Canon ADR-002, ADR-003, ADR-006 and ADR-009;
- the Spk_Alchemy canonical primitive implementation;
- current `spk-multidev` runtime boundaries.

## Findings resolved before candidate SQL

1. **Relationship evidence was missing in the first draft.** Corrected: canonical Relationships retain explicit evidence references and require source/target adjacency indexes.
2. **Knowledge canonical completeness was underspecified.** Corrected: canonical projection now includes structured payload, producer Agent version, explicit evidence references, numeric epistemic confidence, schema version and supersession.
3. **Supabase risked becoming ontology authority.** Corrected: SQL is explicitly an adapter representation; portable TypeScript contracts remain the semantic boundary.
4. **Transition carried non-canonical shape as if structural.** Corrected: adapter-only fields are clearly separated from the canonical Transition contract.
5. **Context fingerprint could have included volatile timestamps.** Corrected: volatile values such as `generatedAt` are excluded from fingerprint input.

## Legacy security fact retained, not solved here

Production currently has public-read RLS policies for `events`, `tasks`, `knowledge_items`, `agent_jobs`, `agent_job_events` and `active_project_context`. The Observatory delta does not reinterpret that as a safe multi-tenant authorization model.

The current Observatory block must not silently redesign authorization because that would broaden scope and potentially break existing behavior. Before ForgeWorks becomes multi-tenant or stores confidential research for multiple principals, access control requires its own explicit threat-model and migration.

New primitive adapter tables (`agents`, `entities`, `relationships`, `transitions`) are designed server-only from their first migration: RLS enabled, no anon/authenticated policy, explicit privilege posture.

## Validation boundary

Without a free disposable PostgreSQL/Supabase environment, we can validate only:

- canonical shape consistency;
- SQL-vs-baseline static compatibility;
- type-level contracts/invariants;
- fixture representability;
- branch/PR recoverability.

We cannot claim:

- candidate DDL executes successfully;
- DB checks/FKs/indexes behave as intended;
- PostgREST behavior remains unchanged;
- migration rollback behavior;
- runtime API integration.

Those claims remain blocked until a disposable database is available.

## Static verdict

**Proceed with repo-only candidate artifacts. Do not promote candidate SQL into `supabase/migrations/`, wire runtime code to it, or execute it against production.**
