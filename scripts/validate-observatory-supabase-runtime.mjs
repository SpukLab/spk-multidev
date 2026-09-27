import { createClient } from "@supabase/supabase-js";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";
const projectId = process.env.OBS_PROJECT_ID;
const legacyId = process.env.OBS_LEGACY_KNOWLEDGE_ID;
const canonicalId = process.env.OBS_CANONICAL_KNOWLEDGE_ID;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: apiUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  OBS_PROJECT_ID: projectId,
  OBS_LEGACY_KNOWLEDGE_ID: legacyId,
  OBS_CANONICAL_KNOWLEDGE_ID: canonicalId,
})) {
  if (!value) throw new Error(`Missing required env: ${name}`);
}

async function jsonFetch(path) {
  const response = await fetch(`${appUrl}${path}`);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
}

const list = await jsonFetch(`/api/knowledge?projectId=${encodeURIComponent(projectId)}`);
if (!list.response.ok) {
  throw new Error(`legacy list API failed: HTTP ${list.response.status} ${JSON.stringify(list.body)}`);
}
if (!Array.isArray(list.body?.items) || list.body.items.length !== 1) {
  throw new Error(`legacy list API expected exactly 1 item, got ${JSON.stringify(list.body)}`);
}
if (list.body.items[0].id !== legacyId) {
  throw new Error(`legacy list API leaked or returned wrong item: ${JSON.stringify(list.body)}`);
}
for (const forbidden of [
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
]) {
  if (Object.hasOwn(list.body.items[0], forbidden)) {
    throw new Error(`legacy list API leaked canonical column: ${forbidden}`);
  }
}

const legacy = await jsonFetch(`/api/knowledge/${legacyId}`);
if (!legacy.response.ok) {
  throw new Error(`legacy detail API failed: HTTP ${legacy.response.status} ${JSON.stringify(legacy.body)}`);
}
if (legacy.body?.item?.id !== legacyId) {
  throw new Error("legacy detail API returned wrong item");
}
if (!Array.isArray(legacy.body?.history) || legacy.body.history.length !== 1) {
  throw new Error(`legacy event history expected exactly 1 event, got ${JSON.stringify(legacy.body?.history)}`);
}
if (legacy.body.history[0].event_type !== "LegacyProbe") {
  throw new Error(`canonical lineage event leaked into legacy history: ${JSON.stringify(legacy.body.history)}`);
}

const canonical = await jsonFetch(`/api/knowledge/${canonicalId}`);
if (canonical.response.status !== 404) {
  throw new Error(`canonical Knowledge should be hidden from legacy API; got HTTP ${canonical.response.status}`);
}

const supabase = createClient(apiUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

const realtimeId = crypto.randomUUID();
let timer;
const eventPromise = new Promise((resolve, reject) => {
  timer = setTimeout(() => reject(new Error("Realtime event timeout")), 15000);
  const channel = supabase
    .channel("observatory-runtime-e2e")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "agent_jobs" },
      (payload) => {
        if (payload.new?.id === realtimeId) resolve({ channel, payload });
      }
    )
    .subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      const { error } = await supabase.from("agent_jobs").insert({
        id: realtimeId,
        task_description: "observatory realtime probe",
        repo_owner: "SpukLab",
        repo_name: "spk-multidev",
        branch: "runtime-e2e",
      });
      if (error) reject(new Error(`Realtime probe insert failed: ${error.message}`));
    });
});

const { channel } = await eventPromise;
clearTimeout(timer);
await supabase.removeChannel(channel);

console.log("PASS legacy Next.js API hides canonical Knowledge");
console.log("PASS legacy event history hides canonical lineage");
console.log("PASS Supabase Realtime delivered agent_jobs INSERT");
