import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";

const ROOT = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "observatory-validation-"));

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function expectThrow(fn, label) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, `${label}: expected rejection`);
}

try {
  const tsc = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
  assert(fs.existsSync(tsc), "Local repository TypeScript compiler is missing. Run npm ci first.");

  const compile = spawnSync(
    process.execPath,
    [
      tsc,
      "--strict",
      "--skipLibCheck",
      "--target",
      "ES2020",
      "--module",
      "CommonJS",
      "--moduleResolution",
      "node",
      "--outDir",
      tempDir,
      path.join(ROOT, "lib", "observatory", "contracts.ts"),
      path.join(ROOT, "lib", "observatory", "invariants.ts"),
    ],
    { stdio: "inherit" }
  );
  assert(compile.status === 0, `TypeScript candidate compilation failed with status ${compile.status}`);

  const require = createRequire(import.meta.url);
  const invariants = require(path.join(tempDir, "invariants.js"));

  let checks = 0;
  const check = (condition, message) => {
    checks += 1;
    assert(condition, message);
  };

  invariants.assertEpistemicConfidence(null);
  invariants.assertEpistemicConfidence(0);
  invariants.assertEpistemicConfidence(1);
  checks += 1;

  expectThrow(() => invariants.assertEpistemicConfidence(1.01), "confidence > 1");
  checks += 1;

  expectThrow(() => invariants.assertOrdinaryObservatoryStage("canon"), "ordinary canon promotion");
  checks += 1;
  invariants.assertOrdinaryObservatoryStage("validated");
  checks += 1;

  expectThrow(
    () =>
      invariants.assertCurationDoesNotImplyEpistemicStage({
        previousCurationStatus: "captured",
        nextCurationStatus: "promoted",
        previousEpistemicStage: "observation",
        nextEpistemicStage: "validated",
      }),
    "curation changing epistemic stage"
  );
  checks += 1;

  invariants.assertCurationDoesNotImplyEpistemicStage({
    previousCurationStatus: "captured",
    nextCurationStatus: "promoted",
    previousEpistemicStage: "observation",
    nextEpistemicStage: "observation",
  });
  checks += 1;

  expectThrow(
    () =>
      invariants.assertEpistemicTransitionDoesNotChangeCuration({
        previousCurationStatus: "captured",
        nextCurationStatus: "promoted",
        previousEpistemicStage: "observation",
        nextEpistemicStage: "validated",
      }),
    "epistemic transition changing curation"
  );
  checks += 1;

  const sharedA = {
    producerAgentId: "agent-a",
    producerAgentVersion: "1",
    researchRunId: "run",
    sourceEventId: "event-a",
    parentEventId: null,
    contextFingerprint: "sha256:shared",
    evidenceIds: [],
  };
  const sharedB = {
    producerAgentId: "agent-b",
    producerAgentVersion: "1",
    researchRunId: "run",
    sourceEventId: "event-b",
    parentEventId: null,
    contextFingerprint: "sha256:shared",
    evidenceIds: [],
  };
  check(
    invariants.independenceClaimIsDisprovenByLineage(sharedA, sharedB) === true,
    "same context must disprove an independence claim"
  );

  const distinct = { ...sharedB, contextFingerprint: "sha256:distinct" };
  check(
    invariants.independenceClaimIsDisprovenByLineage(sharedA, distinct) === false,
    "distinct non-parent lineage must not be automatically marked dependent"
  );

  const canonicalized = invariants.canonicalizeContextFingerprintInput({
    z: 1,
    generatedAt: "volatile",
    nested: { generatedAt: 123, b: 2, a: 1 },
    a: 0,
  });
  check(
    JSON.stringify(canonicalized) === '{"a":0,"nested":{"a":1,"b":2},"z":1}',
    "context canonicalization must remove generatedAt recursively and sort keys"
  );

  const validDraft = {
    id: "knowledge-1",
    projectId: "project-1",
    researchRunId: "run-1",
    subject: "subject-1",
    subjectKind: "entity",
    kind: "finding",
    stage: "validated",
    payload: { claim: "A" },
    agentId: "agent-v1",
    agentVersion: "1",
    evidence: [],
    confidence: 0.8,
    schemaVersion: 1,
    sourceEventId: null,
    supersedes: null,
  };
  invariants.assertObservatoryKnowledgeDraft(validDraft);
  checks += 1;

  for (const field of ["projectId", "researchRunId", "subject", "agentId", "agentVersion", "kind"]) {
    expectThrow(
      () => invariants.assertObservatoryKnowledgeDraft({ ...validDraft, [field]: "" }),
      `Knowledge missing ${field}`
    );
    checks += 1;
  }

  expectThrow(
    () => invariants.assertObservatoryKnowledgeDraft({ ...validDraft, payload: null }),
    "Knowledge missing structured payload"
  );
  checks += 1;
  expectThrow(
    () => invariants.assertObservatoryKnowledgeDraft({ ...validDraft, evidence: null }),
    "Knowledge missing explicit evidence list"
  );
  checks += 1;

  const agentV1 = {
    id: "agent-v1",
    kind: "analyzer",
    name: "auditor",
    version: "1",
    metadata: {},
    status: "active",
    schemaVersion: 1,
    createdAt: 1,
  };
  const agentV2 = { ...agentV1, id: "agent-v2", version: "2", createdAt: 2 };
  invariants.assertAgentVersionMatches(agentV1, validDraft.agentVersion);
  checks += 1;
  expectThrow(
    () => invariants.assertAgentVersionMatches(agentV2, validDraft.agentVersion),
    "newer Agent version substituting historical producer"
  );
  checks += 1;

  for (const action of ["WAIT", "RESEARCH", "REJECT", "DO_NOTHING"]) {
    invariants.assertResearchDecisionNextAction(action);
    checks += 1;
  }

  // Two contradictory records about one subject are both valid domain records;
  // no pure-domain invariant overwrites one with the other.
  invariants.assertObservatoryKnowledgeDraft(validDraft);
  invariants.assertObservatoryKnowledgeDraft({
    ...validDraft,
    id: "knowledge-2",
    payload: { claim: "NOT A" },
    confidence: 0.7,
  });
  checks += 1;

  console.log(`Observatory pure invariant validation PASS (${checks} checks)`);

  const fixtures = spawnSync(process.execPath, [path.join(ROOT, "scripts", "validate-observatory-fixtures.mjs")], {
    cwd: ROOT,
    stdio: "inherit",
  });
  assert(fixtures.status === 0, `Fixture/static candidate validation failed with status ${fixtures.status}`);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
