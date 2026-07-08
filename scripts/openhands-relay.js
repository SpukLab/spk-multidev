// Relay de OpenHands → SPK_MultiDev (CONTEXT_BASE.md sección 20 revisada).
//
// Corre en la misma PC que OpenHands (necesita llegar a localhost:3000).
// Cada POLL_INTERVAL_MS le pregunta a nuestro hub qué jobs están activos,
// pollea los eventos nuevos de cada conversación en OpenHands, y los
// reenvía al webhook de Vercel — así la UI de SPK_MultiDev se actualiza
// en vivo vía Supabase Realtime sin que Vercel tenga que esperar nada.
//
// Requiere Node 18+ (fetch nativo, sin dependencias que instalar).
// Correr con: node scripts/openhands-relay.js

const OPENHANDS_LOCAL_URL = process.env.OPENHANDS_LOCAL_URL || "http://localhost:3000";
const HUB_BASE_URL = process.env.HUB_BASE_URL || "https://spk-multidev.vercel.app";
const RELAY_SECRET = process.env.OPENHANDS_WEBHOOK_SECRET || "";
const POLL_INTERVAL_MS = 4000;

// Recuerda cuántos eventos ya vimos por conversación, para solo reenviar
// los nuevos en cada vuelta.
const lastEventCount = new Map();
// Recuerda si ya marcamos un job como terminado, para no repetir el aviso.
const finishedJobs = new Set();

async function getActiveJobs() {
  const res = await fetch(`${HUB_BASE_URL}/api/openhands/active-jobs`, {
    headers: RELAY_SECRET ? { Authorization: `Bearer ${RELAY_SECRET}` } : {},
  });
  if (!res.ok) {
    console.error(`[relay] Error trayendo jobs activos: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.jobs ?? [];
}

async function getConversationEvents(conversationId) {
  const res = await fetch(
    `${OPENHANDS_LOCAL_URL}/api/v1/conversation/${conversationId}/events`
  );
  if (!res.ok) return [];
  const data = await res.json();
  // El shape exacto (array directo vs {events: [...]}) puede variar —
  // se cubren ambos casos.
  return Array.isArray(data) ? data : data.events ?? [];
}

async function getConversationStatus(conversationId) {
  const res = await fetch(
    `${OPENHANDS_LOCAL_URL}/api/v1/app-conversations?ids=${conversationId}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.results ?? data.conversations ?? [];
  const convo = list[0];
  if (!convo) return null;
  // Nombre exacto del campo de estado no confirmado — se prueban los más
  // probables. Si no matchea ninguno, ajustar acá tras loguear `convo`.
  return convo.status ?? convo.agent_state ?? convo.runtime_status ?? null;
}

async function sendToWebhook(conversationId, eventType, content, status, raw) {
  await fetch(`${HUB_BASE_URL}/api/openhands/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(RELAY_SECRET ? { Authorization: `Bearer ${RELAY_SECRET}` } : {}),
    },
    body: JSON.stringify({ conversation_id: conversationId, event_type: eventType, content, status, raw }),
  });
}

async function pollOnce() {
  const jobs = await getActiveJobs();

  for (const job of jobs) {
    const conversationId = job.openhands_conversation_id;
    if (!conversationId || finishedJobs.has(job.id)) continue;

    try {
      const events = await getConversationEvents(conversationId);
      const seenCount = lastEventCount.get(conversationId) ?? 0;

      if (events.length > seenCount) {
        const newEvents = events.slice(seenCount);
        for (const ev of newEvents) {
          const eventType = ev.action ?? ev.observation ?? ev.type ?? "event";
          const content =
            (typeof ev.content === "string" && ev.content) ||
            ev.args?.content ||
            ev.message ||
            null;
          await sendToWebhook(conversationId, eventType, content, undefined, ev);
        }
        lastEventCount.set(conversationId, events.length);
        console.log(`[relay] job ${job.id.slice(0, 8)}: +${newEvents.length} eventos`);
      }

      const status = await getConversationStatus(conversationId);
      if (status && /finish|stop|complet/i.test(status)) {
        await sendToWebhook(conversationId, "status", null, "finished");
        finishedJobs.add(job.id);
        console.log(`[relay] job ${job.id.slice(0, 8)}: completado`);
      } else if (status && /error|stuck|fail/i.test(status)) {
        await sendToWebhook(conversationId, "status", null, "error");
        finishedJobs.add(job.id);
        console.log(`[relay] job ${job.id.slice(0, 8)}: falló`);
      }
    } catch (err) {
      console.error(`[relay] Error en job ${job.id}:`, err.message);
    }
  }
}

console.log(`[relay] Arrancando. OpenHands: ${OPENHANDS_LOCAL_URL} | Hub: ${HUB_BASE_URL}`);
if (!RELAY_SECRET) {
  console.warn("[relay] OPENHANDS_WEBHOOK_SECRET no seteado — las llamadas van sin autenticar.");
}

setInterval(pollOnce, POLL_INTERVAL_MS);
pollOnce();
