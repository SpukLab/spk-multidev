import { ProviderAdapter, SendMessageParams, NormalizedResponse, ModelInfo } from "./types";

// NVIDIA NIM expone una API compatible con el formato de OpenAI
// (chat completions). Catálogo: Nemotron, DeepSeek, y otros modelos
// disponibles bajo la misma key.
const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";

export const nvidiaAdapter: ProviderAdapter = {
  id: "nvidia",
  async sendMessage({ model, messages, apiKey }: SendMessageParams): Promise<NormalizedResponse> {
    const res = await fetch(`${NIM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`NVIDIA NIM error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return {
      provider: "nvidia",
      model,
      content,
      raw: data,
    };
  },

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    const res = await fetch(`${NIM_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`No se pudo traer el catálogo de NVIDIA NIM (${res.status}).`);
    }
    const data = await res.json();
    const list = (data?.data ?? []) as { id: string }[];
    return list.map((m) => ({ id: m.id, label: m.id })).sort((a, b) => a.id.localeCompare(b.id));
  },
};
