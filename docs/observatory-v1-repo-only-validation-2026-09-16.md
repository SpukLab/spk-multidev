# Observatory v1 — Repo-only Candidate Validation — 2026-09-16

Status: PARTIALLY VALIDATED / DATABASE EXECUTION PENDING

## Remote base

Candidate branch is stacked on:

`docs/forgeworks-observatory-v1-schema-api-delta@88326ab271efbb82f956824e0755e42982c0e9e7`

No production database operation was performed.

## Artifact scope

Validated candidate scope now contains:

- `supabase/candidates/observatory_v1_candidate.sql`
- `lib/observatory/contracts.ts`
- `lib/observatory/invariants.ts`
- `fixtures/observatory/repository-intelligence.json`
- `fixtures/observatory/capability-acquisition-framework.json`
- `fixtures/observatory/exp-2026-013.json`
- `scripts/validate-observatory-fixtures.mjs`
- `package.json` validation command
- `.github/workflows/observatory-candidates.yml`

The SQL file is deliberately outside `supabase/migrations/` and is not runtime-wired.

## TypeScript static validation

Initial local disposable validation compiled the exact candidate contracts/invariants with strict TypeScript and produced zero errors.

The repository now contains the reproducible command:

```text
npm run validate:observatory
```

That command uses the repository-pinned TypeScript dependency and performs:

1. strict/noEmit compilation of `lib/observatory/contracts.ts` and `lib/observatory/invariants.ts`;
2. zero-dependency fixture validation with Node.

## Pure invariant execution

Initial direct Node execution produced **10/10 PASS** for the pure invariants.

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

## Reproducible fixture validator

`scripts/validate-observatory-fixtures.mjs` validates all three durable fixtures without introducing a test framework or new npm dependency.

It checks, among other things:

- unique record identity;
- Research Run → Research Intent linkage;
- Agent existence/version matching for Knowledge, Relationships, Transitions and lineage;
- epistemic stage vocabulary and prohibition of self-promoted `canon` fixtures;
- evidence references;
- confidence range 0..1/null;
- Research Decision next-action vocabulary;
- explicit lineage;
- Repository Intelligence immutable subject pinning;
- CAF separation between capability knowledge and acquisition decision;
- EXP-2026-013 exact FKC blob SHA, multiple auditor Agents, dependent lineage and a distinct-context candidate for independence review.

A distinct-context pair is deliberately **not** declared independent by the validator; it is only eligible for later independence assessment because absence of known dependence is not proof of independence.

## GitHub Actions validation

A scoped workflow now runs only for Observatory candidate paths:

`.github/workflows/observatory-candidates.yml`

Security posture:

- repository: public;
- workflow permissions: `contents: read` only;
- no secrets;
- no Supabase credentials;
- no production access;
- no deployment step.

Verified remote run:

- workflow: `Observatory candidate validation`
- run id: `35115074753`
- triggering SHA: `c08b5ac68ba7e8596ff366135884a7e5a4ba1166`
- event: `push`
- result: **SUCCESS**

Successful steps included:

- Checkout
- Setup Node 20
- `npm ci`
- `npm run validate:observatory`

This confirms the validation command passes against the actual GitHub branch with the repository dependency lock, not only against reconstructed local files.

## Fixture review

All three fixture artifacts are durable on the remote branch.

They exercise distinct research semantics:

- Repository Intelligence: pinned external subject + evidence + reversible-pilot decision;
- CAF: knowledge about a capability remains distinct from authority/decision to acquire it;
- EXP-2026-013: exact FKC-000 blob identity, multiple versioned auditors, shared-context/dependent lineage, separately represented distinct-context lineage, unresolved uncertainty, explicit Research Decision.

`ResearchFixture` explicitly includes `lineage: ResearchContributionLineage[]`, matching the fixture payloads.

Fixture persistence/reconstruction remains unvalidated until a disposable DB exists.

## SQL status

`observatory_v1_candidate.sql` has received static review against:

- the eight-file recovered production migration baseline;
- the live schema audit recorded in PR #3;
- canonical primitive contracts from Governance Canon / Spk_Alchemy;
- the portable TypeScript contracts.

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

**Repo-only candidate block now has reproducible remote validation and is suitable for review. Database implementation remains intentionally stopped.**
