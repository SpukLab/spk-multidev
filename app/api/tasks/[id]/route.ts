import { NextRequest, NextResponse } from "next/server";
import { getTask, transitionTask, getTaskEventHistory, TaskTransitionError, TaskStatus } from "@/lib/db/tasks";
import { getErrorMessage } from "@/lib/errors";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const task = await getTask(params.id);
    if (!task) {
      return NextResponse.json({ error: "Task no encontrada." }, { status: 404 });
    }
    const history = await getTaskEventHistory(params.id);
    return NextResponse.json({ task, history });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = (await req.json()) as { status: TaskStatus };
    if (!status) {
      return NextResponse.json({ error: "Falta status." }, { status: 400 });
    }
    const task = await transitionTask(params.id, status);
    return NextResponse.json({ task });
  } catch (err: unknown) {
    // Tanto una transición inválida (estado terminal, salto no permitido)
    // como un fallo de persistencia del evento Tier A llegan acá — en
    // ambos casos la proyección NO cambió, y el error se lo devolvemos
    // real al cliente, nunca un 200 silencioso.
    const status = err instanceof TaskTransitionError ? 409 : 500;
    return NextResponse.json({ error: getErrorMessage(err) }, { status });
  }
}
