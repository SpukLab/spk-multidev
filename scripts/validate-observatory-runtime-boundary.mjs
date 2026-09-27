import fs from "node:fs";

const source = fs.readFileSync("lib/db/knowledge.ts", "utf8");

const requiredProjection =
  "id,project_id,task_id,session_id,source_message_id,source_event_id,type,title,content,status,confidence,created_at,updated_at";

const projectionMatch = source.match(
  /const LEGACY_KNOWLEDGE_COLUMNS =\s*\n?\s*"([^"]+)";/
);

if (!projectionMatch) {
  throw new Error("LEGACY_KNOWLEDGE_COLUMNS is missing");
}

if (projectionMatch[1] !== requiredProjection) {
  throw new Error("legacy Knowledge projection drifted");
}

const forbiddenCanonicalColumns = [
  "subject_entity_id",
  "subject_relationship_id",
  "canonical_kind",
  "epistemic_stage",
  "canonical_payload",
  "producer_agent_id",
  "producer_agent_version",
  "evidence_ids",
  "epistemic_confidence",
  "research_run_id",
  "supersedes_knowledge_id",
  "schema_version",
];

for (const column of forbiddenCanonicalColumns) {
  if (projectionMatch[1].split(",").includes(column)) {
    throw new Error(`canonical field leaked into legacy projection: ${column}`);
  }
}

if (source.includes('.from("knowledge_items").select("*")')) {
  throw new Error("legacy Knowledge still uses select(*)");
}

const legacyGuards = source.match(/\.is\("epistemic_stage", null\)/g) ?? [];
if (legacyGuards.length !== 3) {
  throw new Error(`expected 3 epistemic_stage legacy guards, found ${legacyGuards.length}`);
}

for (const marker of [
  '.is("producer_agent_id", null)',
  '.is("research_run_id", null)',
  '.is("context_fingerprint", null)',
  '.is("parent_event_id", null)',
]) {
  if (!source.includes(marker)) {
    throw new Error(`legacy Event history guard missing: ${marker}`);
  }
}

console.log("Observatory runtime legacy boundary PASS");
