# Observatory v1 — Repo-only Candidate Validation — 2026-09-16

Status: PARTIALLY VALIDATED / DATABASE EXECUTION PENDING

## Remote base

Candidate branch is stacked on:

`docs/forgeworks-observatory-v1-schema-api-delta@88326ab271efbb82f956824e0755e42982c0e9e7`

No production database operation was performed.

## Candidate scope

Repo-only candidate artifacts include:

- `supabase/candidates/observatory_v1_candidate.sql`
- `lib/observatory/contracts.ts`
- `lib/observatory/invariants.ts`
- `fixtures/observatory/repository-intelligence.json`
- `fixtures/observatory/capability-acquisition-framework.json`
- `fixtures/observatory/exp-2026-013.json`
- `scripts/validate-observatory.mjs`
- `scripts/validate-observatory-fixtures.mjs`
- `package.json` validation command
- `.github/workflows/observatory-candidates.yml`

The SQL file remains deliberately outside `supabase/migrations/` and nothing is runtime-wired.

## Reproducible command

The repository contains:

```text
npm run validate:observatory
```

This command uses the repository-pinned TypeScript compiler and:

1. compiles `contracts.ts` and `invariants.ts` under strict TypeScript into a disposable temporary directory;
2. executes the **actual compiled invariant functions**;
3. validates the three reference fixtures;
4. statically validates required SQL adapter contracts;
5. verifies no application runtime wiring imports Observatory candidate code;
6. removes the temporary compiled output.

No test framework or new npm dependency was added.

## Pure invariant execution

Latest remote validation result:

**26/26 PASS**

Coverage includes:

- epistemic confidence null / 0..1;
- rejection of invalid confidence;
- ordinary Observatory rejection of `canon` promotion;
- curation status cannot implicitly change epistemic stage;
- epistemic transition cannot implicitly change curation status;
- same context fingerprint disproves an independence claim;
- distinct non-parent lineage is not automatically marked dependent;
- deterministic context canonicalization removes volatile `generatedAt` fields;
- canonical Observatory Knowledge requires project, Research Run, subject, structured payload, producer Agent/version, kind and explicit evidence list;
- historical Agent version remains attributable and is not replaced by a newer Agent version;
- `WAIT`, `RESEARCH`, `REJECT`, `DO_NOTHING` are valid right-to-stop research decisions;
- contradictory Knowledge records are both accepted by the pure domain layer rather than overwriting one another.

These checks validate domain semantics, not database persistence.

## Fixture/static validation

Latest remote validation result:

**3/3 fixtures PASS**

The validator checks:

- unique record identity;
- Research Run → Research Intent linkage;
- Agent existence/version matching for Knowledge, Relationships, Transitions and lineage;
- structured Knowledge payload and explicit evidence list;
- epistemic stage vocabulary and no fixture self-promotion to `canon`;
- Evidence identity references;
- confidence 0..1/null;
- Research Decision next-action vocabulary;
- explicit lineage;
- Repository Intelligence immutable subject pinning;
- CAF separation of capability knowledge from acquisition decision;
- EXP-2026-013 exact FKC-000 blob SHA, multiple auditor Agents, explicitly dependent lineage and distinct-context lineage candidate.

A distinct-context pair is deliberately **not** declared independent merely because no direct dependency is known.

Static SQL checks assert that the candidate still contains:

- all five canonical primitive projections (`Knowledge` remains the existing physical store);
- Relationship evidence storage;
- source and target adjacency indexes;
- structured canonical Knowledge payload;
- producer Agent version;
- numeric epistemic confidence;
- canonical completeness constraint;
- server-only RLS/revocation posture for new primitive adapter tables;
- no silent Realtime publication for those tables.

The validator also scans application code to ensure no candidate Observatory module is runtime-wired before DB validation.

## GitHub Actions evidence

Workflow:

`Observatory candidate validation`

Security posture:

- public repository;
- workflow token: `contents: read` plus GitHub metadata read;
- no Supabase credentials;
- no production access;
- no deployment step.

Latest strengthened push run:

- run id: `35115666713`
- triggering SHA: `138cc9811b2df1e53b477f05a10d4bdb2fa4d4a1`
- result: **SUCCESS**
- Node requested for project validation: `20.20.2`
- `npm ci`: PASS
- pure invariant validation: **26 PASS**
- fixture/static validation: **3/3 PASS**

The GitHub runner also warns that `actions/checkout@v4` and `actions/setup-node@v4` target a deprecated Node 20 action runtime and are currently forced onto Node 24 internally. This is CI-maintenance evidence, not an Observatory correctness failure.

## Dependency-security observation

`npm audit` on the same remote SHA reports **7 pre-existing dependency-tree vulnerabilities**:

- 2 low
- 2 moderate
- 2 high
- 1 critical

Reported packages:

- `@octokit/plugin-paginate-rest` — moderate, transitive
- `@octokit/rest` — moderate, direct
- `@supabase/auth-js` — low, transitive
- `@supabase/supabase-js` — low, direct
- `nanoid` — high, transitive
- `next` — critical, direct
- `postcss` — high, transitive

This is tracked separately in **Issue #6 — Security audit: pre-existing npm dependency vulnerabilities**.

No dependency fix was applied automatically. In particular, npm proposes a major Next.js upgrade, so dependency remediation requires separate research and compatibility validation.

## SQL status

`observatory_v1_candidate.sql` remains:

**STATIC-ONLY CANDIDATE**

Not claimed:

- successful PostgreSQL execution;
- constraint/FK/index runtime behavior;
- PostgREST/Data API behavior after migration;
- rollback behavior;
- Supabase advisor result after candidate DDL;
- fixture persistence/reconstruction from a real DB.

Those require a disposable PostgreSQL/Supabase environment. Production is not an acceptable validation target.

## Remaining gate

Do not:

- move candidate SQL into `supabase/migrations/`;
- wire runtime APIs to candidate columns/tables;
- apply candidate DDL to production;
- claim the DB layer is validated;
- mix dependency-security upgrades into this Observatory candidate PR.

The next database-dependent step remains blocked until a free disposable local PostgreSQL/Supabase environment becomes available, or the user explicitly authorizes another isolated validation environment.

## Verdict

**Repo-only Observatory candidate now has reproducible remote compilation, executable invariant validation, fixture validation, static SQL contract validation, and a scoped CI gate. Database implementation remains intentionally stopped.**
