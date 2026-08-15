import { NextRequest, NextResponse } from "next/server";
import { commitFiles } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

export async function POST(req: NextRequest) {
  let owner = "";
  let repo = "";

  try {
    const body = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
      paths: string[];
      password?: string;
      githubToken?: string;
    };
    owner = body.owner;
    repo = body.repo;
    const { branch, paths, password, githubToken } = body;

    const expectedPassword = process.env.HUB_ACCESS_PASSWORD;
    if (expectedPassword && password !== expectedPassword) {
      return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
    }

    if (!owner || !repo || !paths || paths.length === 0) {
      return NextResponse.json(
        { error: "Faltan owner, repo o paths." },
        { status: 400 }
      );
    }

    const files = paths.map((path) => ({ path, content: null }));
    const commitSha = await commitFiles(
      { owner, repo, branch },
      files,
      `Limpieza masiva: borrado de ${paths.length} archivo(s) desde SPK_MultiDev`,
      githubToken
    );

    // Distinto de un commit de Code Intake: esto es un borrado deliberado
    // de Limpieza Masiva, no un patch — se emite FilesDeleted además de
    // CommitCreated/PushSucceeded (ambos hechos son ciertos sobre el mismo
    // commit atómico).
    await emitEvent({
      eventType: "FilesDeleted",
      actor: "user",
      source: "GitHub",
      entityId: commitSha,
      payload: { owner, repo, paths },
    });
    await emitEvent({
      eventType: "CommitCreated",
      actor: "user",
      source: "GitHub",
      entityId: commitSha,
      payload: { owner, repo, filesDeleted: paths.length },
    });
    await emitEvent({
      eventType: "PushSucceeded",
      actor: "user",
      source: "GitHub",
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
      entityId: owner && repo ? `${owner}/${repo}` : null,
      payload: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
