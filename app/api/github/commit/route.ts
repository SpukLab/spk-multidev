import { NextRequest, NextResponse } from "next/server";
import { commitFiles, RepoRef } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

// Recibe instrucciones ya resueltas (con content final calculado en el
// cliente tras el flujo fetch -> diff -> confirmar de la sección 7) y las
// aplica como un solo commit atómico.
export async function POST(req: NextRequest) {
  let owner = "";
  let repo = "";
  let projectId: string | null = null;

  try {
    const body = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
      files: { path: string; content: string | null }[];
      message: string;
      githubToken?: string;
      projectId?: string;
    };
    owner = body.owner;
    repo = body.repo;
    projectId = body.projectId ?? null;
    const { branch, files, message, githubToken } = body;

    if (!owner || !repo || !files || !message) {
      return NextResponse.json(
        { error: "Faltan campos: owner, repo, files, message." },
        { status: 400 }
      );
    }

    const ref: RepoRef = { owner, repo, branch };
    const commitSha = await commitFiles(ref, files, message, githubToken);

    // Un solo commit atómico = tres hechos simultáneos: se aplicó el patch,
    // se creó el commit, y el push tuvo éxito (Git Data API hace las tres
    // cosas en una sola operación server-side, no hay pasos intermedios
    // separables — ver CONTEXT_BASE.md sección 7).
    await emitEvent({
      eventType: "PatchApplied",
      actor: "user",
      source: "GitHub",
      projectId,
      entityId: commitSha,
      payload: { owner, repo, filesCount: files.length },
    });
    await emitEvent({
      eventType: "CommitCreated",
      actor: "user",
      source: "GitHub",
      projectId,
      entityId: commitSha,
      payload: { owner, repo, message },
    });
    await emitEvent({
      eventType: "PushSucceeded",
      actor: "user",
      source: "GitHub",
      projectId,
      entityId: commitSha,
      payload: { owner, repo },
    });

    return NextResponse.json({ commitSha });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    await emitEvent({
      eventType: "PushFailed",
      actor: "user",
      source: "GitHub",
      projectId,
      entityId: owner && repo ? `${owner}/${repo}` : null,
      payload: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
