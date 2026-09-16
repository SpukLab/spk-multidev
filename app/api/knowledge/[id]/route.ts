import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeItem, transitionKnowledge, getKnowledgeEventHistory, KnowledgeTransitionError } from "@/lib/db/knowledge";
import { getErrorMessage } from "@/lib/errors";

type RouteParams = Promise<{ id: string }>;

export async function GET(req: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { id } = await params;
    const item = await getKnowledgeItem(id);
    if (!item) {
      return NextResponse.json({ error: "Knowledge item no encontrado." }, { status: 404 });
    }
    const history = await getKnowledgeEventHistory(id);
    return NextResponse.json({ item, history });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: RouteParams }) {
  try {
    const { id } = await params;
    const { status } = (await req.json()) as { status: "promoted" | "rejected" };
    if (!status) {
      return NextResponse.json({ error: "Falta status." }, { status: 400 });
    }
    const item = await transitionKnowledge(id, status);
    return NextResponse.json({ item });
  } catch (err: unknown) {
    const httpStatus = err instanceof KnowledgeTransitionError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status: httpStatus });
  }
}
