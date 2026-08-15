import { NextRequest, NextResponse } from "next/server";
import { captureKnowledge, listKnowledgeForProject, KnowledgeTransitionError, KnowledgeType, KnowledgeStatus } from "@/lib/db/knowledge";
import { getErrorMessage } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const type = req.nextUrl.searchParams.get("type") as KnowledgeType | null;
    const status = req.nextUrl.searchParams.get("status") as KnowledgeStatus | null;
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId." }, { status: 400 });
    }
    const items = await listKnowledgeForProject(projectId, {
      type: type ?? undefined,
      status: status ?? undefined,
    });
    return NextResponse.json({ items });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      projectId: string;
      taskId?: string | null;
      sessionId?: string | null;
      sourceMessageId?: string | null;
      type: KnowledgeType;
      title: string;
      content: string;
      confidence?: "low" | "medium" | "high";
    };

    if (!body.projectId || !body.type || !body.title || !body.content) {
      return NextResponse.json(
        { error: "Faltan projectId, type, title o content." },
        { status: 400 }
      );
    }

    const item = await captureKnowledge(body);
    return NextResponse.json({ item });
  } catch (err: unknown) {
    const status = err instanceof KnowledgeTransitionError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
