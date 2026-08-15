import { NextRequest, NextResponse } from "next/server";
import { createAgentJob, setJobStartTaskId, markJobFailed } from "@/lib/db/agentJobs";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent } from "@/lib/events/emit";

/**
 * Dispara una tarea en OpenHands y devuelve de inmediato — nunca espera a
 * que la tarea termine (eso puede tardar minutos, incompatible con el
 * timeout de una función de Vercel). El progreso llega vía polling del
 * relay local (scripts/openhands-relay.js), no vía webhook nativo —
 * confirmado que esta versión de OpenHands no expone un tipo de processor
 * de webhook genérico (sección 20 revisada de CONTEXT_BASE.md).
 *
 * Endpoint y schema confirmados contra el Swagger real de la instancia
 * (POST /api/v1/app-conversations, "Start App Conversation").
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
    const openHandsLlmModel = process.env.OPENHANDS_LLM_MODEL; // ej: openai/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
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

    const ohRes = await fetch(`${openHandsBaseUrl}/api/v1/app-conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openHandsApiKey ? { Authorization: `Bearer ${openHandsApiKey}` } : {}),
      },
      body: JSON.stringify({
        initial_message: {
          role: "user",
          content: [{ type: "text", text: taskDescription, cache_prompt: false }],
          run: true,
        },
        selected_repository: `${owner}/${repo}`,
        selected_branch: branch ?? "main",
        git_provider: "github",
        ...(openHandsLlmModel ? { llm_model: openHandsLlmModel } : {}),
        title: taskDescription.slice(0, 60),
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
    // Este id es el de la AppConversationStartTask (tarea de arranque
    // asíncrona) — NO el de la conversación final. Confirmado contra la
    // instancia real: POST /api/v1/app-conversations devuelve un objeto
    // {id, status: "WORKING", app_conversation_id: null, ...} y hay que
    // pollear GET /api/v1/app-conversations/start-tasks?ids=<id> hasta
    // status READY para recién ahí tener el app_conversation_id real. Esa
    // resolución la hace el relay local (scripts/openhands-relay.js).
    const startTaskId: string | undefined = ohData.id;
    if (!startTaskId) {
      await markJobFailed(job.id, "OpenHands no devolvió un id de start task reconocible.");
      return NextResponse.json(
        { error: "OpenHands no devolvió id. Revisar la respuesta real en /docs." },
        { status: 502 }
      );
    }

    await setJobStartTaskId(job.id, startTaskId);

    await emitEvent({
      eventType: "ExecutionRequested",
      actor: "user",
      source: "OpenHands",
      projectId,
      entityId: job.id,
      payload: { owner, repo, branch: branch ?? "main", startTaskId },
    });

    return NextResponse.json({ jobId: job.id, startTaskId });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    if (job) await markJobFailed(job.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
