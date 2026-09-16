import { NextRequest, NextResponse } from "next/server";
import { getMessages, appendMessage } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";

type RouteParams = Promise<{ id: string }>;

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const messages = await getMessages(id);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { id } = await params;
    const { panel, role, content } = (await req.json()) as {
      panel: "left" | "right";
      role: "system" | "user" | "assistant";
      content: string;
    };
    if (!panel || !role || content === undefined) {
      return NextResponse.json({ error: "Faltan panel, role o content." }, { status: 400 });
    }
    const inserted = await appendMessage(id, panel, role, content);
    return NextResponse.json({ ok: true, messageId: inserted.id });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
