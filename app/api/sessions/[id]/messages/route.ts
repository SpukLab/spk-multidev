import { NextRequest, NextResponse } from "next/server";
import { getMessages, appendMessage } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messages = await getMessages(params.id);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { panel, role, content } = (await req.json()) as {
      panel: "left" | "right";
      role: "system" | "user" | "assistant";
      content: string;
    };
    if (!panel || !role || content === undefined) {
      return NextResponse.json({ error: "Faltan panel, role o content." }, { status: 400 });
    }
    await appendMessage(params.id, panel, role, content);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
