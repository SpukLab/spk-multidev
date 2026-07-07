import { NextRequest, NextResponse } from "next/server";
import { createAgentJob, setJobConversationId, markJobFailed } from "@/lib/db/agentJobs";

/**
 * Dispara una tarea en el Agent Server de OpenHands y devuelve de inmediato.
 * NUNCA espera a que la tarea termine — eso puede tardar minutos, y una
 * función de Vercel no puede sostener esa espera (timeout). El progreso
 * llega después vía webhook (/api/openhands/webhook), sección 20 de
 * CONTEXT_BASE.md.
 *
 * IMPORTANTE: el payload exacto de POST /conversations puede variar según
 * la versión del Agent Server que tengas corriendo. Verificá el contrato
 * real contra el /docs (Swagger) de tu propio Agent Server y ajustá acá si
 * hace falta — esto usa los nombres de campo documentados públicamente
 * (initial_user_msg, repository) como punto de partida razonable.
 */
export async function POST(req: NextRequest) {
  let job;
  try {
    const { projectId, taskDescription, owner, repo, branch } = (await req.json()) as {
      projectId: string;
      taskDescription: string;
      owner: string;
      repo: string;
      branch?: string;
    };

    if (!projectId || !taskDescription || !owner || !repo) {
      return NextResponse.json(
        { error: "Faltan campos: projectId, taskDescription, owner, repo." },
        { status: 400 }
      );
    }

    const openHandsBaseUrl = process.env.OPENHANDS_BASE_URL;
    const openHandsApiKey = process.env.OPENHANDS_API_KEY;
    if (!openHandsBaseUrl) {
      return NextResponse.json(
        { error: "OPENHANDS_BASE_URL no configurado en el servidor." },
        { status: 500 }
      );
    }

    job = await createAgentJob({
      projectId,
      taskDescription,
      repoOwner: owner,
      repoName: repo,
      branch: branch ?? "main",
    });

    // Dispara la conversación en el Agent Server. Esta llamada debe volver
    // rápido (el Agent Server arranca el trabajo en background y devuelve
    // un id) — nunca hay que esperar acá a que la tarea termine.
    const ohRes = await fetch(`${openHandsBaseUrl}/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openHandsApiKey ? { Authorization: `Bearer ${openHandsApiKey}` } : {}),
      },
      body: JSON.stringify({
        initial_user_msg: taskDescription,
        repository: `${owner}/${repo}`,
      }),
    });

    if (!ohRes.ok) {
      const errText = await ohRes.text();
      await markJobFailed(job.id, `Error al iniciar en OpenHands (${ohRes.status}): ${errText}`);
      return NextResponse.json(
        { error: `OpenHands respondió ${ohRes.status}: ${errText}` },
        { status: 502 }
      );
    }

    const ohData = await ohRes.json();
    const conversationId = ohData.conversation_id ?? ohData.id;
    if (!conversationId) {
      await markJobFailed(job.id, "OpenHands no devolvió un conversation_id reconocible.");
      return NextResponse.json(
        { error: "OpenHands no devolvió conversation_id. Revisar el payload real en /docs del Agent Server." },
        { status: 502 }
      );
    }

    await setJobConversationId(job.id, conversationId);

    return NextResponse.json({ jobId: job.id, conversationId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    if (job) await markJobFailed(job.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
