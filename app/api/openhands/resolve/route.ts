import { NextRequest, NextResponse } from "next/server";
import { resolveJobConversationId, markJobFailed } from "@/lib/db/agentJobs";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

/**
 * Llamada por scripts/openhands-relay.js cuando un AppConversationStartTask
 * pasa a status READY (o ERROR) — recién ahí sabemos el app_conversation_id
 * real para empezar a pollear sus eventos.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.OPENHANDS_WEBHOOK_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const { jobId, conversationId, error: startError } = (await req.json()) as {
      jobId: string;
      conversationId?: string;
      error?: string;
    };

    if (!jobId) {
      return NextResponse.json({ error: "Falta jobId." }, { status: 400 });
    }

    if (startError) {
      await markJobFailed(jobId, startError);
      // La conversación nunca llegó a existir (el start_task falló antes
      // de READY) — sigue siendo un ExecutionFailed real, solo que más
      // temprano en el ciclo de vida que el que detecta el webhook.
      await emitEvent({
        eventType: "ExecutionFailed",
        actor: "system",
        source: "OpenHands",
        entityId: jobId,
        payload: { reason: startError, stage: "start_task" },
      });
      return NextResponse.json({ ok: true });
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Falta conversationId o error." }, { status: 400 });
    }

    await resolveJobConversationId(jobId, conversationId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
