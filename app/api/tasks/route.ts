import { NextRequest, NextResponse } from "next/server";
import { createTask, listTasksForProject, TaskTransitionError } from "@/lib/db/tasks";
import { getErrorMessage } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Falta projectId." }, { status: 400 });
    }
    const tasks = await listTasksForProject(projectId);
    return NextResponse.json({ tasks });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, title, objective, acceptanceCriteria } = (await req.json()) as {
      projectId: string;
      title: string;
      objective?: string;
      acceptanceCriteria?: string;
    };

    if (!projectId || !title) {
      return NextResponse.json({ error: "Faltan projectId o title." }, { status: 400 });
    }

    const task = await createTask({ projectId, title, objective, acceptanceCriteria });
    return NextResponse.json({ task });
  } catch (err: unknown) {
    // TaskTransitionError significa: el evento Tier A no se pudo persistir
    // de forma durable — la tarea NO se creó, se lo devolvemos como error
    // real, no como éxito silencioso.
    const status = err instanceof TaskTransitionError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
