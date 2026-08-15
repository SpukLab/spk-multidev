import { NextRequest, NextResponse } from "next/server";
import { deleteRepo } from "@/lib/github/client";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

// Borrado de repos completos — irreversible, sin papelera en GitHub.
// Exige que el cliente envíe confirmText igual al nombre exacto de los
// repos (uno por uno, separados por coma) — no alcanza con un solo click
// (CONTEXT_BASE.md sección 15).
export async function POST(req: NextRequest) {
  try {
    const { repos, confirmText, password, githubToken, projectId } = (await req.json()) as {
      repos: { owner: string; name: string }[];
      confirmText: string;
      password?: string;
      githubToken?: string;
      projectId?: string;
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

    const results: { repo: string; ok: boolean; error?: string; eventLogged?: boolean }[] = [];
    for (const r of repos) {
      try {
        await deleteRepo(r.owner, r.name, githubToken);
        // RepoDeleted es el único evento Tier A del canon (auditoría de
        // integridad, CONTEXT_BASE §26): después de borrar un repo, GitHub
        // no retiene NADA — ni historial, ni el nombre. Si este evento
        // específico no se puede registrar (ni tras reintentar), no seguimos
        // en silencio como con el resto del canon — se lo devolvemos al
        // cliente para que lo muestre como advertencia real.
        const eventLogged = await emitEvent({
          eventType: "RepoDeleted",
          actor: "user",
          source: "GitHub",
          projectId: projectId ?? null,
          entityId: `${r.owner}/${r.name}`,
          payload: { owner: r.owner, repo: r.name },
        });
        results.push({ repo: r.name, ok: true, eventLogged });
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
    const message = getErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
