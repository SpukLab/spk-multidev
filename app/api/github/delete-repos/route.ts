import { NextRequest, NextResponse } from "next/server";
import { deleteRepo } from "@/lib/github/client";

// Borrado de repos completos — irreversible, sin papelera en GitHub.
// Exige que el cliente envíe confirmText igual al nombre exacto de los
// repos (uno por uno, separados por coma) — no alcanza con un solo click
// (CONTEXT_BASE.md sección 15).
export async function POST(req: NextRequest) {
  try {
    const { repos, confirmText, password, githubToken } = (await req.json()) as {
      repos: { owner: string; name: string }[];
      confirmText: string;
      password?: string;
      githubToken?: string;
    };

    const expectedPassword = process.env.HUB_ACCESS_PASSWORD;
    if (expectedPassword && password !== expectedPassword) {
      return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
    }

    if (!repos || repos.length === 0) {
      return NextResponse.json({ error: "No hay repos seleccionados." }, { status: 400 });
    }

    const expectedConfirm = repos.map((r) => r.name).join(",");
    if (confirmText !== expectedConfirm) {
      return NextResponse.json(
        {
          error: `Confirmación inválida. Debías escribir exactamente: ${expectedConfirm}`,
        },
        { status: 400 }
      );
    }

    const results: { repo: string; ok: boolean; error?: string }[] = [];
    for (const r of repos) {
      try {
        await deleteRepo(r.owner, r.name, githubToken);
        results.push({ repo: r.name, ok: true });
      } catch (err: unknown) {
        results.push({
          repo: r.name,
          ok: false,
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
