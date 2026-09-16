import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

type RouteParams = Promise<{ id: string }>;

export async function DELETE(
  req: Request,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    await deleteSession(id);
    // Corrección de integridad (CONTEXT_BASE §26): se llamaba
    // ConversationArchived, pero deleteSession hace un DELETE físico, no un
    // archivado recuperable — "Archived" era una interpretación, no un
    // hecho (viola la regla 1 del canon). Renombrado a ConversationDeleted.
    await emitEvent({
      eventType: "ConversationDeleted",
      actor: "user",
      source: "user",
      entityId: id,
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
