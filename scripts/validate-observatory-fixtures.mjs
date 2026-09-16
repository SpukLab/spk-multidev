import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FIXTURE_DIR = path.join(ROOT, "fixtures", "observatory");
const FILES = [
  "repository-intelligence.json",
  "capability-acquisition-framework.json",
  "exp-2026-013.json",
];

const ALLOWED_STAGES = new Set([
  "observation",
  "hypothesis",
  "validated",
  "canon",
  "deprecated",
]);
const ALLOWED_NEXT_ACTIONS = new Set([
  "BUILD",
  "EXPERIMENT",
  "RESEARCH",
  "WAIT",
  "ESCALATE",
  "REFRAME",
  "REJECT",
  "ABANDON",
  "DO_NOTHING",
]);
const FKC_BLOB_SHA = "d7fa6ff077b8d07aadb5f295d737f52d75d22dba";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function loadFixture(filename) {
  const fullPath = path.join(FIXTURE_DIR, filename);
  const parsed = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  return { filename, fixture: parsed };
}

function allIds(fixture) {
  return [
    fixture.intent?.id,
    fixture.run?.id,
    ...(fixture.agents ?? []).map((item) => item.id),
    ...(fixture.subjects ?? []).map((item) => item.id),
    ...(fixture.evidence ?? []).map((item) => item.id),
    ...(fixture.knowledge ?? []).map((item) => item.id),
    ...(fixture.relationships ?? []).map((item) => item.id),
    ...(fixture.transitions ?? []).map((item) => item.id),
    fixture.decision?.id,
  ].filter(Boolean);
}

function relationExists(fixture, type, source, target) {
  return (fixture.relationships ?? []).some(
    (relation) =>
      relation.type === type && relation.source === source && relation.target === target
  );
}

function lineageDependenceDisproven(left, right) {
  if (
    left.contextFingerprint &&
    right.contextFingerprint &&
    left.contextFingerprint === right.contextFingerprint
  ) {
    return true;
  }
  if (left.sourceEventId && right.parentEventId === left.sourceEventId) {
    return true;
  }
  if (right.sourceEventId && left.parentEventId === right.sourceEventId) {
    return true;
  }
  return false;
}

function validateCommon(filename, fixture) {
  assert(typeof fixture.fixtureId === "string" && fixture.fixtureId.length > 0, `${filename}: fixtureId missing`);
  assert(fixture.intent?.type === "research-intent", `${filename}: intent must be research-intent`);
  assert(fixture.run?.type === "observatory-research-run", `${filename}: run must be observatory-research-run`);
  assert(fixture.decision?.type === "research-decision", `${filename}: decision must be research-decision`);

  const ids = allIds(fixture);
  assert(new Set(ids).size === ids.length, `${filename}: duplicate record ids detected`);

  const agents = new Map((fixture.agents ?? []).map((agent) => [agent.id, agent]));
  const evidenceIds = new Set((fixture.evidence ?? []).map((item) => item.id));
  const knowledgeIds = new Set((fixture.knowledge ?? []).map((item) => item.id));

  assert(
    relationExists(fixture, "investigates_intent", fixture.run.id, fixture.intent.id),
    `${filename}: Research Run must investigate its Research Intent`
  );

  for (const knowledge of fixture.knowledge ?? []) {
    assert(ALLOWED_STAGES.has(knowledge.stage), `${filename}: invalid epistemic stage ${knowledge.stage}`);
    assert(knowledge.stage !== "canon", `${filename}: fixture must not self-promote Knowledge to canon`);
    assert(agents.has(knowledge.agentId), `${filename}: Knowledge references unknown Agent ${knowledge.agentId}`);
    assert(
      agents.get(knowledge.agentId).version === knowledge.agentVersion,
      `${filename}: Knowledge Agent version mismatch for ${knowledge.id}`
    );
    assert(
      knowledge.confidence === null ||
        (Number.isFinite(knowledge.confidence) && knowledge.confidence >= 0 && knowledge.confidence <= 1),
      `${filename}: Knowledge confidence must be null or 0..1`
    );
    for (const evidenceId of knowledge.evidence ?? []) {
      assert(evidenceIds.has(evidenceId), `${filename}: Knowledge references unknown Evidence ${evidenceId}`);
    }
  }

  for (const relation of fixture.relationships ?? []) {
    assert(agents.has(relation.agentId), `${filename}: Relationship references unknown Agent ${relation.agentId}`);
    for (const evidenceId of relation.evidence ?? []) {
      assert(evidenceIds.has(evidenceId), `${filename}: Relationship references unknown Evidence ${evidenceId}`);
    }
    if (relation.type === "informs_decision") {
      assert(knowledgeIds.has(relation.source), `${filename}: informs_decision source must be Knowledge`);
      assert(relation.target === fixture.decision.id, `${filename}: informs_decision target must be fixture decision`);
    }
  }

  for (const transition of fixture.transitions ?? []) {
    assert(agents.has(transition.agentId), `${filename}: Transition references unknown Agent ${transition.agentId}`);
    assert(typeof transition.idempotencyKey === "string" && transition.idempotencyKey.length > 0, `${filename}: Transition idempotencyKey missing`);
  }

  const action = fixture.decision?.attributes?.nextAction;
  assert(ALLOWED_NEXT_ACTIONS.has(action), `${filename}: invalid research nextAction ${action}`);

  assert(Array.isArray(fixture.lineage), `${filename}: lineage must be explicit`);
  for (const lineage of fixture.lineage) {
    const agent = agents.get(lineage.producerAgentId);
    assert(agent, `${filename}: lineage references unknown Agent ${lineage.producerAgentId}`);
    assert(agent.version === lineage.producerAgentVersion, `${filename}: lineage Agent version mismatch`);
    assert(lineage.researchRunId === fixture.run.id, `${filename}: lineage must bind to fixture Research Run`);
    for (const evidenceId of lineage.evidenceIds ?? []) {
      assert(evidenceIds.has(evidenceId), `${filename}: lineage references unknown Evidence ${evidenceId}`);
    }
  }
}

function validateRepositoryIntelligence(fixture) {
  assert(fixture.fixtureId === "repository-intelligence", "repository-intelligence: wrong fixtureId");
  assert((fixture.subjects ?? []).some((subject) => subject.attributes?.immutableVersion), "repository-intelligence: subject must be pinned to immutable version");
  assert((fixture.evidence ?? []).length >= 2, "repository-intelligence: expected multiple Evidence references");
  assert(["EXPERIMENT", "BUILD", "REJECT", "DO_NOTHING"].includes(fixture.decision.attributes.nextAction), "repository-intelligence: decision does not exercise acquisition outcome vocabulary");
}

function validateCaf(fixture) {
  assert(fixture.fixtureId === "capability-acquisition-framework", "CAF: wrong fixtureId");
  assert((fixture.knowledge ?? []).some((item) => item.kind === "capability-knowledge"), "CAF: capability knowledge missing");
  assert(fixture.decision.attributes.nextAction === "WAIT", "CAF: expected WAIT to prove knowledge does not imply acquisition");
  assert(fixture.decision.id !== fixture.knowledge?.[0]?.id, "CAF: decision must remain structurally distinct from Knowledge");
}

function validateExp013(fixture) {
  assert(fixture.fixtureId === "exp-2026-013", "EXP-2026-013: wrong fixtureId");
  assert(fixture.run.attributes?.label === "EXP-2026-013", "EXP-2026-013: run label missing");
  assert(fixture.run.attributes?.scope?.blobSha === FKC_BLOB_SHA, "EXP-2026-013: exact FKC blob SHA missing from run scope");
  assert((fixture.subjects ?? []).some((subject) => subject.attributes?.immutableVersion === FKC_BLOB_SHA), "EXP-2026-013: exact FKC blob SHA missing from subject");
  assert((fixture.evidence ?? []).some((item) => item.attributes?.immutableVersion === FKC_BLOB_SHA), "EXP-2026-013: exact FKC blob SHA missing from Evidence");
  assert((fixture.agents ?? []).filter((agent) => agent.kind === "ai_model").length >= 2, "EXP-2026-013: multiple auditor Agents required");
  assert(["NO_CHANGE", "CLARIFICATION", "REVIEW"].includes(fixture.decision.attributes?.domainVerdict), "EXP-2026-013: invalid constitutional verdict vocabulary");
  assert((fixture.decision.attributes?.unresolvedUncertainty ?? []).length > 0, "EXP-2026-013: unresolved uncertainty must survive closure");

  const lineage = fixture.lineage ?? [];
  let dependentPairFound = false;
  let distinctContextPairFound = false;
  for (let i = 0; i < lineage.length; i += 1) {
    for (let j = i + 1; j < lineage.length; j += 1) {
      if (lineageDependenceDisproven(lineage[i], lineage[j])) dependentPairFound = true;
      if (
        lineage[i].contextFingerprint &&
        lineage[j].contextFingerprint &&
        lineage[i].contextFingerprint !== lineage[j].contextFingerprint &&
        !lineageDependenceDisproven(lineage[i], lineage[j])
      ) {
        distinctContextPairFound = true;
      }
    }
  }
  assert(dependentPairFound, "EXP-2026-013: fixture must contain an explicitly dependent lineage pair");
  assert(distinctContextPairFound, "EXP-2026-013: fixture must contain a distinct-context lineage candidate for independence review");
}

const loaded = FILES.map(loadFixture);
for (const { filename, fixture } of loaded) {
  validateCommon(filename, fixture);
}

validateRepositoryIntelligence(loaded[0].fixture);
validateCaf(loaded[1].fixture);
validateExp013(loaded[2].fixture);

console.log(`Observatory fixture validation PASS (${loaded.length}/${FILES.length} fixtures)`);
