import { NextRequest, NextResponse } from "next/server";
import { fetchFileContent } from "@/lib/github/client";

// Trae el CONTEXT_BASE.md del repo activo (o README.md como fallback) para
// adjuntarlo automáticamente como contexto a cualquier IA consultada desde
// los paneles — sección 13 de CONTEXT_BASE.md ("contexto de proyecto
// adjunto automático").
export async function POST(req: NextRequest) {
  try {
    const { owner, repo, branch } = (await req.json()) as {
      owner: string;
      repo: string;
      branch?: string;
    };
    if (!owner || !repo) {
      return NextResponse.json({ error: "Faltan owner y repo." }, { status: 400 });
    }

    const ref = { owner, repo, branch };
    let content = await fetchFileContent(ref, "CONTEXT_BASE.md");
    let source = "CONTEXT_BASE.md";

    if (content === null) {
      content = await fetchFileContent(ref, "README.md");
      source = "README.md";
    }

    if (content === null) {
      return NextResponse.json({ content: "", source: null });
    }

    return NextResponse.json({ content, source });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
