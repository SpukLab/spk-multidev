import { NextRequest, NextResponse } from "next/server";
import { getJobByConversationId, appendAgentJobEvent, updateJobStatus } from "@/lib/db/agentJobs";

/**
 * Recibe eventos que el Agent Server de OpenHands empuja a medida que
 * progresa una tarea (configurado en el `webhooks` array de su config,
 * ver CONTEXT_BASE.md sección 20). Esta ruta SOLO escribe en Supabase y
 * responde — nunca hace ningún trabajo lento. El browser se entera del
 * nuevo evento vía Supabase Realtime, no a través de esta respuesta.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.OPENHANDS_WEBHOOK_SECRET;
    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await req.json();
    // El shape exacto del payload depende de la versión del Agent Server —
    // ajustar estos campos contra lo que realmente llega (loguear body una
    // vez en desarrollo para confirmar). Se cubren los nombres más
    // probables con fallback.
    const conversationId: string | undefined =
      body.conversation_id ?? body.conversationId ?? body.id;
    const eventType: string = body.event_type ?? body.type ?? "unknown";
    const content: string | null =
      typeof body.content === "string"
        ? body.content
        : body.message?.content ?? null;
    const status: string | undefined = body.status ?? body.execution_status;

    if (!conversationId) {
      return NextResponse.json({ error: "Payload sin conversation_id reconocible." }, { status: 400 });
    }

    const job = await getJobByConversationId(conversationId);
    if (!job) {
      // Puede pasar si el webhook llega antes de que /start termine de
      // guardar el conversation_id — no es un error grave, solo se ignora.
      return NextResponse.json({ ok: true, note: "Job no encontrado todavía, evento ignorado." });
    }

    await appendAgentJobEvent(job.id, eventType, content, body);

    if (status === "finished") {
      await updateJobStatus(job.id, "completed", content ?? undefined);
    } else if (status === "error" || status === "stuck") {
      await updateJobStatus(job.id, "failed", content ?? undefined);
    } else if (job.status === "queued") {
      await updateJobStatus(job.id, "running");
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
