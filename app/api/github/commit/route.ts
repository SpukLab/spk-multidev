import { NextRequest, NextResponse } from "next/server";
import { commitFiles, RepoRef } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";

// Recibe instrucciones ya resueltas (con content final calculado en el
// cliente tras el flujo fetch -> diff -> confirmar de la sección 7) y las
// aplica como un solo commit atómico.
export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch, files, message, githubToken } = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
      files: { path: string; content: string | null }[];
      message: string;
      githubToken?: string;
    };

    if (!owner || !repo || !files || !message) {
      return NextResponse.json(
        { error: "Faltan campos: owner, repo, files, message." },
        { status: 400 }
      );
    }

    const ref: RepoRef = { owner, repo, branch };
    const commitSha = await commitFiles(ref, files, message, githubToken);

    return NextResponse.json({ commitSha });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
