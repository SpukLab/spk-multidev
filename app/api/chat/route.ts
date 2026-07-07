import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters";
import { ChatMessage } from "@/lib/adapters/types";

// Proxy hacia cada proveedor de IA. Las API keys viven solo en variables
// de entorno de Vercel — nunca llegan al cliente (CONTEXT_BASE.md sección 2).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, model, messages, apiKey: clientApiKey } = body as {
      provider: string;
      model: string;
      messages: ChatMessage[];
      apiKey?: string;
    };

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

    const adapter = getAdapter(provider);

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
        throw firstErr;
      }
    }

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
