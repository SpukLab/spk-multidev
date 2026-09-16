# Observatory v1 — Repo-only Candidate Validation — 2026-09-16

Status: PARTIALLY VALIDATED / DATABASE EXECUTION PENDING

## Remote base

Candidate branch is stacked on:

`docs/forgeworks-observatory-v1-schema-api-delta@88326ab271efbb82f956824e0755e42982c0e9e7`

No production database operation was performed.

## Artifact scope

Validated candidate scope contains only:

- `supabase/candidates/observatory_v1_candidate.sql`
- `lib/observatory/contracts.ts`
- `lib/observatory/invariants.ts`
- `fixtures/observatory/repository-intelligence.json`
- `fixtures/observatory/capability-acquisition-framework.json`
- `fixtures/observatory/exp-2026-013.json`

The SQL file is deliberately outside `supabase/migrations/` and is not runtime-wired.

## TypeScript static validation

The exact GitHub contents of `contracts.ts` and `invariants.ts` were reproduced in a local disposable directory and compiled with:

```text
tsc --strict --noEmit --target ES2020 --module ESNext --moduleResolution Bundler
```

Compiler available in the execution environment: TypeScript 5.8.3.

Result: **PASS — zero TypeScript errors.**

Repository `package.json` pins TypeScript 5.5.4. Because this environment has no network/package install path, the exact 5.5.4 compiler was not reinstalled. The candidate intentionally uses conservative TypeScript syntax compatible with the project's current strict configuration, but an exact-version build remains part of later repository/runtime validation.

## Pure invariant execution

The same two TypeScript files were emitted to disposable CommonJS JavaScript and exercised directly in Node.

Result: **10/10 checks PASS**.

Checks covered:

1. epistemic confidence accepts null/0/1;
2. confidence > 1 is rejected;
3. ordinary Observatory API rejects `canon`;
4. ordinary Observatory accepts non-canon stage;
5. curation transition cannot also change epistemic stage;
6. curation transition may preserve epistemic stage;
7. epistemic transition cannot also change curation status;
8. identical context fingerprints disprove an independence claim;
9. distinct non-parent lineage is not automatically marked dependent;
10. context canonicalization removes `generatedAt` and deterministically sorts object keys.

These checks validate pure domain behavior only. They do not validate persistence.

## Fixture review

All three fixture artifacts are present and retrievable from the remote branch.

They exercise distinct research semantics:

- Repository Intelligence: pinned external subject + evidence + reversible-pilot decision;
- CAF: knowledge about a capability remains distinct from authority/decision to acquire it;
- EXP-2026-013: exact FKC-000 blob identity, multiple versioned auditors, shared-context/dependent lineage, separately represented independent-context lineage, unresolved uncertainty, explicit Research Decision.

`ResearchFixture` now explicitly includes `lineage: ResearchContributionLineage[]`, matching the fixture payloads.

Fixture persistence/reconstruction remains unvalidated until a disposable DB exists.

## SQL status

`observatory_v1_candidate.sql` has received static review against:

- the eight-file recovered production migration baseline;
- the live schema audit recorded in PR #3;
- canonical primitive contracts from Governance Canon / Spk_Alchemy;
- the new portable TypeScript contracts.

Result: **STATIC-ONLY CANDIDATE**.

Not claimed:

- successful PostgreSQL execution;
- constraint/FK/index runtime behavior;
- PostgREST/Data API behavior after migration;
- rollback behavior;
- Supabase advisor result after candidate DDL.

Those require a disposable PostgreSQL/Supabase environment. Production is not an acceptable validation target.

## Remaining gate

Do not:

- move the SQL into `supabase/migrations/`;
- wire runtime APIs to candidate columns/tables;
- apply candidate DDL to production;
- claim the DB layer is validated.

The next database-dependent step remains blocked until a free disposable local PostgreSQL/Supabase environment becomes available, or the user later explicitly approves another isolated validation environment.

## Verdict

**Repo-only candidate block is internally coherent enough for review. Database implementation remains intentionally stopped.**
