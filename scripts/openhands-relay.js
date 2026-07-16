// Relay de OpenHands → SPK_MultiDev (CONTEXT_BASE.md sección 20 revisada).
//
// Corre en la misma PC que OpenHands (necesita llegar a localhost:3000).
// Cada POLL_INTERVAL_MS le pregunta a nuestro hub qué jobs están activos.
//
// Confirmado contra la instancia real: arrancar una conversación es un
// proceso en DOS pasos asíncronos:
//   1. POST /api/v1/app-conversations devuelve un AppConversationStartTask
//      (status WORKING → ... → READY), NO la conversación en sí.
//   2. Hay que pollear GET /api/v1/app-conversations/start-tasks?ids=<id>
//      hasta que status=READY, ahí aparece el app_conversation_id real.
// Recién con ese id real se puede pollear
// GET /api/v1/conversation/{id}/events/search para ver el progreso.
//
// Requiere Node 18+ (fetch nativo, sin dependencias que instalar).
// Correr con: node scripts/openhands-relay.js

const OPENHANDS_LOCAL_URL = process.env.OPENHANDS_LOCAL_URL || "http://localhost:3000";
const HUB_BASE_URL = process.env.HUB_BASE_URL || "https://spk-multidev.vercel.app";
const RELAY_SECRET = process.env.OPENHANDS_WEBHOOK_SECRET || "";
const POLL_INTERVAL_MS = 4000;

const lastEventCount = new Map(); // conversationId -> cantidad de eventos ya vistos
const finishedJobs = new Set(); // job.id ya cerrado (completado o fallido)
const resolvedConversationId = new Map(); // job.id -> conversationId real, cacheado localmente

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

async function getStartTaskStatus(startTaskId) {
  const res = await fetch(
    `${OPENHANDS_LOCAL_URL}/api/v1/app-conversations/start-tasks?ids=${startTaskId}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  // Confirmado: devuelve un array directo (no envuelto en items).
  const list = Array.isArray(data) ? data : data.items ?? [];
  return list[0] ?? null;
}

async function resolveConversationId(jobId, conversationId) {
  await fetch(`${HUB_BASE_URL}/api/openhands/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(RELAY_SECRET ? { Authorization: `Bearer ${RELAY_SECRET}` } : {}),
    },
    body: JSON.stringify({ jobId, conversationId }),
  });
}

async function reportStartTaskError(jobId, errorMsg) {
  await fetch(`${HUB_BASE_URL}/api/openhands/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(RELAY_SECRET ? { Authorization: `Bearer ${RELAY_SECRET}` } : {}),
    },
    body: JSON.stringify({ jobId, error: errorMsg }),
  });
}

async function getConversationEvents(conversationId) {
  const res = await fetch(
    `${OPENHANDS_LOCAL_URL}/api/v1/conversation/${conversationId}/events/search`
  );
  if (!res.ok) return [];
  const data = await res.json();
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
  let jobs;
  try {
    jobs = await getActiveJobs();
  } catch (err) {
    console.error("[relay] Error de red trayendo jobs activos (reintenta en la próxima vuelta):", err.message);
    return;
  }

  for (const job of jobs) {
    if (finishedJobs.has(job.id)) continue;

    try {
      // Paso 1: si todavía no tenemos un conversation_id real, resolver
      // el start_task primero.
      let conversationId = job.openhands_conversation_id || resolvedConversationId.get(job.id);

      if (!conversationId && job.openhands_start_task_id) {
        const task = await getStartTaskStatus(job.openhands_start_task_id);
        if (!task) continue; // todavía no aparece, reintentar próxima vuelta

        if (task.status === "READY" && task.app_conversation_id) {
          conversationId = task.app_conversation_id;
          resolvedConversationId.set(job.id, conversationId);
          await resolveConversationId(job.id, conversationId);
          console.log(`[relay] job ${job.id.slice(0, 8)}: resuelto → conversación ${conversationId.slice(0, 8)}...`);
        } else if (task.status === "ERROR") {
          await reportStartTaskError(job.id, task.detail ?? "Error desconocido arrancando la conversación.");
          finishedJobs.add(job.id);
          console.log(`[relay] job ${job.id.slice(0, 8)}: falló al arrancar (${task.detail ?? "sin detalle"})`);
          continue;
        } else {
          // WAITING_FOR_SANDBOX, PREPARING_REPOSITORY, etc. — seguir esperando.
          console.log(`[relay] job ${job.id.slice(0, 8)}: arrancando (${task.status})`);
          continue;
        }
      }

      if (!conversationId) continue;

      // Paso 2: pollear eventos de la conversación ya resuelta.
      const events = await getConversationEvents(conversationId);
      const seenCount = lastEventCount.get(conversationId) ?? 0;

      if (events.length > seenCount) {
        const newEvents = events.slice(seenCount);
        for (const ev of newEvents) {
          const eventType = ev.kind ?? "event";
          const content =
            (typeof ev.value?.content === "string" && ev.value.content) ||
            (typeof ev.value?.message === "string" && ev.value.message) ||
            null;

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

// Red de contención: un hipo de red (ECONNRESET, timeout, etc.) nunca debe
// tirar abajo el proceso — el relay tiene que seguir corriendo indefinidamente.
process.on("unhandledRejection", (err) => {
  console.error("[relay] Error no manejado (el relay sigue corriendo):", err?.message ?? err);
});
process.on("uncaughtException", (err) => {
  console.error("[relay] Excepción no capturada (el relay sigue corriendo):", err?.message ?? err);
});

setInterval(pollOnce, POLL_INTERVAL_MS);
pollOnce();
