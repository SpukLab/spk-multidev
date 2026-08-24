import { NextRequest, NextResponse } from "next/server";
import { getActiveTask, setActiveTask, ActiveTaskTransitionError } from "@/lib/db/activeTaskContext";
import { getErrorMessage } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId." }, { status: 400 });
    }
    const activeTask = await getActiveTask(projectId);
    return NextResponse.json({ activeTask });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, taskId } = (await req.json()) as { projectId: string; taskId: string | null };
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId." }, { status: 400 });
    }
    await setActiveTask(projectId, taskId ?? null);
    const activeTask = await getActiveTask(projectId);
    return NextResponse.json({ activeTask });
  } catch (err: unknown) {
    const status = err instanceof ActiveTaskTransitionError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
