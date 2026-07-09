import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await deleteSession(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
