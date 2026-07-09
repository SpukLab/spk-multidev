import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessionsWithPreview } from "@/lib/db/sessions";
import { getErrorMessage } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId." }, { status: 400 });
    }
    const sessions = await listSessionsWithPreview(projectId);
    return NextResponse.json({ sessions });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId } = (await req.json()) as { projectId: string };
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId." }, { status: 400 });
    }
    const session = await createSession(projectId);
    return NextResponse.json({ session });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
