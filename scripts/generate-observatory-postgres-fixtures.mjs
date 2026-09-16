import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const FIXTURES = [
  "repository-intelligence.json",
  "capability-acquisition-framework.json",
  "exp-2026-013.json",
];
const PROJECT_ID = "00000000-0000-0000-0000-000000000001";

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`;
const sqlJson = (value) => `${sqlString(JSON.stringify(value))}::jsonb`;
const sqlUuid = (value) => `${sqlString(value)}::uuid`;
const sqlUuidArray = (values = []) =>
  values.length === 0
    ? "'{}'::uuid[]"
    : `ARRAY[${values.map((value) => sqlUuid(value)).join(", ")}]::uuid[]`;
const sqlTimestamp = (milliseconds) => `to_timestamp(${Number(milliseconds)} / 1000.0)`;
const nullableString = (value) => (value == null ? "null" : sqlString(value));
const nullableUuid = (value) => (value == null ? "null" : sqlUuid(value));
const nullableNumber = (value) => (value == null ? "null" : Number(value));

const fixtures = FIXTURES.map((filename) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures", "observatory", filename), "utf8"))
);

const statements = [];
statements.push("begin;");
statements.push(
  `insert into projects (id, name, github_owner, github_repo, default_branch) values (${sqlUuid(PROJECT_ID)}, 'Observatory disposable fixture project', 'SpukLab', 'spk-multidev', 'main');`
);

const agents = new Map();
for (const fixture of fixtures) {
  for (const agent of fixture.agents ?? []) agents.set(agent.id, agent);
}
for (const agent of agents.values()) {
  statements.push(`insert into agents (id, kind, name, version, metadata, status, schema_version, created_at)
values (${sqlUuid(agent.id)}, ${sqlString(agent.kind)}, ${sqlString(agent.name)}, ${sqlString(agent.version)}, ${sqlJson(agent.metadata ?? {})}, ${sqlString(agent.status)}, ${Number(agent.schemaVersion)}, ${sqlTimestamp(agent.createdAt)});`);
}

for (const fixture of fixtures) {
  const entityRecords = [
    fixture.intent,
    fixture.run,
    ...(fixture.subjects ?? []),
    ...(fixture.evidence ?? []),
    fixture.decision,
  ];
  for (const entity of entityRecords) {
    statements.push(`insert into entities (id, project_id, type, role, lifecycle_state, attributes, schema_version, created_at, updated_at)
values (${sqlUuid(entity.id)}, ${sqlUuid(PROJECT_ID)}, ${sqlString(entity.type)}, ${sqlString(entity.role)}, ${sqlString(entity.lifecycleState)}, ${sqlJson(entity.attributes ?? {})}, ${Number(entity.schemaVersion)}, ${sqlTimestamp(entity.createdAt)}, ${entity.updatedAt == null ? "null" : sqlTimestamp(entity.updatedAt)});`);
  }
}

// Persist contribution lineage as real Event Log rows. Parent links are filled
// after every source event exists so ordering does not manufacture dependence.
const lineageByEvent = new Map();
for (const fixture of fixtures) {
  for (const lineage of fixture.lineage ?? []) {
    if (lineage.sourceEventId) lineageByEvent.set(lineage.sourceEventId, { fixture, lineage });
  }
}
for (const [eventId, { fixture, lineage }] of lineageByEvent) {
  statements.push(`insert into events (event_id, project_id, entity_id, event_type, actor, source, version, payload, producer_agent_id, research_run_id, context_fingerprint)
values (${sqlUuid(eventId)}, ${sqlUuid(PROJECT_ID)}, ${sqlString(fixture.run.id)}, 'ObservatoryContribution', 'system', 'System', 1, ${sqlJson({ fixtureId: fixture.fixtureId, evidenceIds: lineage.evidenceIds ?? [] })}, ${sqlUuid(lineage.producerAgentId)}, ${sqlUuid(lineage.researchRunId)}, ${nullableString(lineage.contextFingerprint)});`);
}
for (const [eventId, { lineage }] of lineageByEvent) {
  if (lineage.parentEventId) {
    statements.push(`update events set parent_event_id = ${sqlUuid(lineage.parentEventId)} where event_id = ${sqlUuid(eventId)};`);
  }
}

// Existing legacy fields stay populated only to satisfy the current physical
// store. Canonical semantics come exclusively from canonical_* / epistemic_*
// columns; no inference from legacy type/status/confidence is performed.
for (const fixture of fixtures) {
  for (const knowledge of fixture.knowledge ?? []) {
    const subjectEntity = knowledge.subjectKind === "entity" ? sqlUuid(knowledge.subject) : "null";
    const subjectRelationship = knowledge.subjectKind === "relationship" ? sqlUuid(knowledge.subject) : "null";
    statements.push(`insert into knowledge_items (
  id, project_id, type, title, content, status, confidence,
  subject_entity_id, subject_relationship_id, canonical_kind, epistemic_stage,
  canonical_payload, producer_agent_id, producer_agent_version, evidence_ids,
  epistemic_confidence, research_run_id, supersedes_knowledge_id, schema_version
) values (
  ${sqlUuid(knowledge.id)}, ${sqlUuid(PROJECT_ID)}, 'observation', ${sqlString(knowledge.kind)}, ${sqlString(JSON.stringify(knowledge.payload))}, 'captured', null,
  ${subjectEntity}, ${subjectRelationship}, ${sqlString(knowledge.kind)}, ${sqlString(knowledge.stage)},
  ${sqlJson(knowledge.payload)}, ${sqlUuid(knowledge.agentId)}, ${sqlString(knowledge.agentVersion)}, ${sqlUuidArray(knowledge.evidence)},
  ${nullableNumber(knowledge.confidence)}, ${sqlUuid(fixture.run.id)}, ${nullableUuid(knowledge.supersedes)}, ${Number(knowledge.schemaVersion)}
);`);
  }
}

for (const fixture of fixtures) {
  for (const relation of fixture.relationships ?? []) {
    statements.push(`insert into relationships (id, project_id, type, source, target, agent_id, evidence_ids, metadata, schema_version, created_at, updated_at)
values (${sqlUuid(relation.id)}, ${sqlUuid(PROJECT_ID)}, ${sqlString(relation.type)}, ${sqlUuid(relation.source)}, ${sqlUuid(relation.target)}, ${sqlUuid(relation.agentId)}, ${sqlUuidArray(relation.evidence)}, ${sqlJson(relation.metadata ?? {})}, ${Number(relation.schemaVersion)}, ${sqlTimestamp(relation.createdAt)}, ${relation.updatedAt == null ? "null" : sqlTimestamp(relation.updatedAt)});`);
  }
  for (const transition of fixture.transitions ?? []) {
    statements.push(`insert into transitions (id, project_id, subject, kind, from_state, to_state, agent_id, idempotency_key, rationale, context, schema_version, created_at)
values (${sqlUuid(transition.id)}, ${sqlUuid(PROJECT_ID)}, ${sqlUuid(transition.subject)}, ${sqlString(transition.kind)}, ${nullableString(transition.fromState)}, ${nullableString(transition.toState)}, ${sqlUuid(transition.agentId)}, ${sqlString(transition.idempotencyKey)}, ${nullableString(transition.rationale)}, ${sqlJson(transition.context ?? {})}, ${Number(transition.schemaVersion)}, ${sqlTimestamp(transition.createdAt)});`);
  }
}

statements.push("commit;");
process.stdout.write(`${statements.join("\n\n")}\n`);
