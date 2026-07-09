import { NextRequest, NextResponse } from "next/server";
import { commitFiles } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch, paths, password, githubToken } = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
      paths: string[];
      password?: string;
      githubToken?: string;
    };

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

    return NextResponse.json({ commitSha });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
