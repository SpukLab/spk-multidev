# Observatory v1 — Repo-only candidate artifact boundary

The next branch must contain only non-executed, reversible candidate artifacts:

- `supabase/candidates/observatory_v1_candidate.sql`
- `lib/observatory/contracts.ts`
- `lib/observatory/invariants.ts`
- three reference fixtures under `fixtures/observatory/`

These files are not runtime-wired, are not imported by existing application code, and the SQL file is deliberately outside `supabase/migrations/`.

No production database operation is authorized by their presence in the repository.
