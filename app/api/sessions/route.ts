import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessionsWithPreview } from "@/lib/db/sessions";
import { getActiveTask } from "@/lib/db/activeTaskContext";
import { linkSessionToWorkItem } from "@/lib/db/operationalIntegrity";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

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
    await emitEvent({
      eventType: "ConversationCreated",
      actor: "user",
      source: "user",
      projectId,
      entityId: session.id,
    });

    // ADR-010 / ADR-012:
    // Work Item != Session. Si existe una Task activa, una Session nueva se
    // vincula explícitamente a ese Work Item para preservar continuidad sin
    // convertir el chat en la fuente de verdad del trabajo.
    const activeTask = await getActiveTask(projectId);
    let integrity:
      | { workItemId: string | null; workItemLink: "linked" | "not_applicable" }
      | { workItemId: string; workItemLink: "failed"; error: string };

    if (!activeTask) {
      integrity = { workItemId: null, workItemLink: "not_applicable" };
    } else {
      try {
        await linkSessionToWorkItem({
          projectId,
          workItemId: activeTask.id,
          sessionId: session.id,
          linkedBy: "system",
        });
        integrity = { workItemId: activeTask.id, workItemLink: "linked" };
      } catch (linkErr: unknown) {
        // La Session ya existe: no fingimos atomicidad retroactiva. Devolvemos
        // el hecho parcial explícitamente en vez de ocultarlo como success total.
        integrity = {
          workItemId: activeTask.id,
          workItemLink: "failed",
          error: getErrorMessage(linkErr),
        };
      }
    }

    return NextResponse.json({ session, integrity });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
