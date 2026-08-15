import { NextRequest, NextResponse } from "next/server";
import { parseCodeIntake } from "@/lib/codeIntake/parser";
import { resolveInstructions } from "@/lib/codeIntake/resolve";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

export async function POST(req: NextRequest) {
  try {
    const { rawText, owner, repo, branch, githubToken, knownFilePaths, projectId } = (await req.json()) as {
      rawText: string;
      owner: string;
      repo: string;
      branch?: string;
      githubToken?: string;
      knownFilePaths?: string[];
      projectId?: string;
    };

    if (!rawText || !owner || !repo) {
      return NextResponse.json(
        { error: "Faltan campos: rawText, owner, repo." },
        { status: 400 }
      );
    }

    const instructions = parseCodeIntake(rawText);
    const resolved = await resolveInstructions(
      { owner, repo, branch },
      instructions,
      githubToken,
      knownFilePaths
    );

    // Un evento por archivo resuelto: PatchValidated si pasó el diff real
    // contra GitHub, PatchRejected si resolve.ts lo descartó (FIND que no
    // matchea, o el endurecimiento de ACTION: write contra colisión de
    // nombre — ver CONTEXT_BASE.md sección 22).
    for (const r of resolved) {
      await emitEvent({
        eventType: r.error ? "PatchRejected" : "PatchValidated",
        actor: "user",
        source: "System",
        projectId: projectId ?? null,
        entityId: `${owner}/${repo}`,
        payload: r.error
          ? { path: r.path, action: r.action, reason: r.error }
          : { path: r.path, action: r.action },
      });
    }

    return NextResponse.json({ resolved });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
