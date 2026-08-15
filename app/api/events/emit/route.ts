import { NextRequest, NextResponse } from "next/server";
import { emitEvent, EventActor, EventSource } from "@/lib/events/emit";
import { getErrorMessage } from "@/lib/errors";

/**
 * Único punto de entrada para eventos que se originan client-side y no
 * tienen ningún otro round-trip al servidor donde colgarse (ContextBuilt,
 * ContextRejected, ModelSelected). Todo lo demás del canon se instrumenta
 * directo dentro de las rutas server-side que ya existen — esta ruta es
 * deliberadamente la única pieza nueva de infraestructura del Sprint 1.
 */
export async function POST(req: NextRequest) {
  try {
    const { eventType, actor, source, projectId, entityId, payload } = (await req.json()) as {
      eventType: string;
      actor: EventActor;
      source: EventSource;
      projectId?: string | null;
      entityId?: string | null;
      payload?: Record<string, unknown>;
    };

    if (!eventType || !actor || !source) {
      return NextResponse.json({ error: "Faltan eventType, actor o source." }, { status: 400 });
    }

    await emitEvent({ eventType, actor, source, projectId, entityId, payload });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
