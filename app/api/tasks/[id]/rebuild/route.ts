import { NextRequest, NextResponse } from "next/server";
import { rebuildTaskProjection } from "@/lib/db/tasks";
import { getErrorMessage } from "@/lib/errors";

/**
 * Reconstruye `tasks` para una Task puntual leyendo únicamente sus
 * eventos Tier A — demuestra que la proyección es prescindible, no una
 * fuente de verdad paralela (CONTEXT_BASE.md sección 24, regla 4).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const task = await rebuildTaskProjection(params.id);
    if (!task) {
      return NextResponse.json({ error: "No hay eventos TaskCreated para esa Task." }, { status: 404 });
    }
    return NextResponse.json({ task });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
