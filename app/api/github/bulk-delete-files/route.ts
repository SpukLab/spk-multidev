import { NextRequest, NextResponse } from "next/server";
import { commitFiles } from "@/lib/github/client";

export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch, paths } = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
      paths: string[];
    };
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
      `Limpieza masiva: borrado de ${paths.length} archivo(s) desde SPK_MultiDev`
    );

    return NextResponse.json({ commitSha });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
