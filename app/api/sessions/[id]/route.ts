import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteSession(params.id);
    // Interpretación explícita: hoy borrar una sesión es una eliminación
    // física (no un soft-archive), pero conceptualmente, desde la
    // perspectiva del Hub, es el usuario dando por cerrada esa conversación
    // — se mapea a ConversationArchived del canon (documentado en
    // CONTEXT_BASE.md sección 24).
    await emitEvent({
      eventType: "ConversationArchived",
      actor: "user",
      source: "user",
      entityId: params.id,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
