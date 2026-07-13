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
    `${OPENHANDS_LOCAL_URL}/api/v1/conversation/${conversationId}/events/search`
  );
  if (!res.ok) return [];
  const data = await res.json();
  // Confirmado contra una instancia real: { items: [...], next_page_id }.
  // TODO: si una conversación acumula MUCHOS eventos, sumar paginado real
  // con next_page_id en vez de traer todo cada vez.
  return data.items ?? [];
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
          // Estructura real confirmada: { id, key, kind, source, timestamp, value }.
          const eventType = ev.kind ?? "event";
          const content =
            (typeof ev.value?.content === "string" && ev.value.content) ||
            (typeof ev.value?.message === "string" && ev.value.message) ||
            null;

          // El estado de ejecución viaja embebido en el propio evento
          // ConversationStateUpdateEvent (campo execution_status), no hace
          // falta pegarle a otro endpoint aparte para saber si terminó.
          let status;
          if (ev.kind === "ConversationStateUpdateEvent" && ev.value?.execution_status) {
            const execStatus = ev.value.execution_status;
            if (/finish|complet/i.test(execStatus)) status = "finished";
            else if (/error|stuck|fail/i.test(execStatus)) status = "error";
          }

          await sendToWebhook(conversationId, eventType, content, status, ev);

          if (status === "finished" || status === "error") {
            finishedJobs.add(job.id);
          }
        }
        lastEventCount.set(conversationId, events.length);
        console.log(`[relay] job ${job.id.slice(0, 8)}: +${newEvents.length} eventos`);
        if (finishedJobs.has(job.id)) {
          console.log(`[relay] job ${job.id.slice(0, 8)}: terminado`);
        }
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
