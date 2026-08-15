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
    // Corrección de integridad (CONTEXT_BASE §26): se llamaba
    // ConversationArchived, pero deleteSession hace un DELETE físico, no un
    // archivado recuperable — "Archived" era una interpretación, no un
    // hecho (viola la regla 1 del canon). Renombrado a ConversationDeleted.
    await emitEvent({
      eventType: "ConversationDeleted",
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
