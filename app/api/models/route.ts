import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapters";
import { getModelsForProvider } from "@/lib/providerModels";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  let provider = "";
  try {
    const body = (await req.json()) as { provider: string; apiKey?: string };
    provider = body.provider;
    if (!provider) {
      return NextResponse.json({ error: "Falta provider." }, { status: 400 });
    }

    const apiKey = body.apiKey || process.env[`${provider.toUpperCase()}_API_KEY`];
    if (!apiKey) {
      // Sin key configurada: devolvemos el catálogo de fallback hardcodeado
      // en vez de fallar, para que la UI siga siendo usable.
      return NextResponse.json({ models: getModelsForProvider(provider), fallback: true });
    }

    const adapter = getAdapter(provider);
    if (!adapter.listModels) {
      return NextResponse.json({ models: getModelsForProvider(provider), fallback: true });
    }

    const models = await adapter.listModels(apiKey);
    if (models.length === 0) {
      return NextResponse.json({ models: getModelsForProvider(provider), fallback: true });
    }

    return NextResponse.json({ models, fallback: false });
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    // Ante cualquier error de catálogo, no rompemos la UI: devolvemos fallback.
    return NextResponse.json(
      { models: getModelsForProvider(provider), fallback: true, warning: message },
      { status: 200 }
    );
  }
}
