import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters";
import { ChatMessage } from "@/lib/adapters/types";
import { getErrorMessage } from "@/lib/errors";
import { emitEvent, providerToSource } from "@/lib/events/emit";

// Regex liviano para detectar si una respuesta trae bloques FILE: aplicables
// — mismo patrón ya usado en components/Panel.tsx para el badge visual de
// Code Intake. Se reutiliza acá solo para el evento PatchGenerated, no para
// parsear de verdad (eso lo sigue haciendo lib/codeIntake/parser.ts).
const HAS_FILE_BLOCK = /^FILE:\s*.+$/m;

// Proxy hacia cada proveedor de IA. Las API keys viven solo en variables
// de entorno de Vercel — nunca llegan al cliente (CONTEXT_BASE.md sección 2).
export async function POST(req: NextRequest) {
  let provider = "";
  let model = "";
  let projectId: string | null = null;
  let entityId: string | null = null;

  try {
    const body = await req.json();
    const {
      provider: bodyProvider,
      model: bodyModel,
      messages,
      apiKey: clientApiKey,
      projectId: bodyProjectId,
      sessionId,
    } = body as {
      provider: string;
      model: string;
      messages: ChatMessage[];
      apiKey?: string;
      projectId?: string;
      sessionId?: string;
    };
    provider = bodyProvider;
    model = bodyModel;
    projectId = bodyProjectId ?? null;
    entityId = sessionId ?? null;

    if (!provider || !model || !messages) {
      return NextResponse.json(
        { error: "Faltan campos: provider, model, messages." },
        { status: 400 }
      );
    }

    // Prioridad: key personal del usuario (cargada en su navegador) > key del
    // servidor. Esto permite distribuir el hub sin atar a otros a las keys
    // del dueño original del deploy.
    const apiKey = clientApiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      return NextResponse.json(
        { error: `No hay API key configurada para el proveedor: ${provider}. Cargá la tuya en Configuración.` },
        { status: 500 }
      );
    }

    const source = providerToSource(provider);

    // MessageSent: se recibió una request de chat válida, con key resuelta.
    await emitEvent({
      eventType: "MessageSent",
      actor: "user",
      source: "user",
      projectId,
      entityId,
      payload: { provider, model },
    });

    const adapter = getAdapter(provider);

    await emitEvent({
      eventType: "ResponseStarted",
      actor: "user",
      source,
      projectId,
      entityId,
      payload: { provider, model },
    });

    let response;
    try {
      response = await adapter.sendMessage({ model, messages, apiKey });
    } catch (firstErr: unknown) {
      const msg = firstErr instanceof Error ? firstErr.message : "";
      // 503 / rate-limit del proveedor: suele ser transitorio bajo tráfico
      // compartido (ej. tier gratuito de NIM) — un reintento corto alcanza
      // en la mayoría de los casos, sin necesidad de que el usuario reintente a mano.
      if (msg.includes("503") || msg.toLowerCase().includes("resourceexhausted")) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        response = await adapter.sendMessage({ model, messages, apiKey });
      } else {
        await emitEvent({
          eventType: "ProviderUnavailable",
          actor: "user",
          source,
          projectId,
          entityId,
          payload: { provider, model, error: msg },
        });
        throw firstErr;
      }
    }

    await emitEvent({
      eventType: "ResponseCompleted",
      actor: "user",
      source,
      projectId,
      entityId,
      payload: { provider, model },
    });

    if (HAS_FILE_BLOCK.test(response.content ?? "")) {
      await emitEvent({
        eventType: "PatchGenerated",
        actor: "user",
        source,
        projectId,
        entityId,
        payload: { provider, model },
      });
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    const source = provider ? providerToSource(provider) : "System";
    await emitEvent({
      eventType: "ResponseFailed",
      actor: "user",
      source,
      projectId,
      entityId,
      payload: { provider, model, error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
