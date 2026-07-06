import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters";
import { ChatMessage } from "@/lib/adapters/types";

// Proxy hacia cada proveedor de IA. Las API keys viven solo en variables
// de entorno de Vercel — nunca llegan al cliente (CONTEXT_BASE.md sección 2).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, model, messages } = body as {
      provider: string;
      model: string;
      messages: ChatMessage[];
    };

    if (!provider || !model || !messages) {
      return NextResponse.json(
        { error: "Faltan campos: provider, model, messages." },
        { status: 400 }
      );
    }

    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      return NextResponse.json(
        { error: `No hay API key configurada para el proveedor: ${provider}` },
        { status: 500 }
      );
    }

    const adapter = getAdapter(provider);
    const response = await adapter.sendMessage({ model, messages, apiKey });

    return NextResponse.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
