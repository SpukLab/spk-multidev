import { ProviderAdapter, SendMessageParams, NormalizedResponse, ModelInfo } from "./types";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

export const openaiAdapter: ProviderAdapter = {
  id: "openai",
  async sendMessage({ model, messages, apiKey }: SendMessageParams): Promise<NormalizedResponse> {
    const res = await fetch(OPENAI_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return {
      provider: "openai",
      model,
      content,
      raw: data,
    };
  },

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`No se pudo traer el catálogo de OpenAI (${res.status}).`);
    }
    const data = await res.json();
    const list = (data?.data ?? []) as { id: string }[];
    return list
      .map((m) => ({ id: m.id, label: m.id }))
      .filter((m) => m.id.includes("gpt") || m.id.includes("o1") || m.id.includes("o3"))
      .sort((a, b) => a.id.localeCompare(b.id));
  },
};
