import { ProviderAdapter, SendMessageParams, NormalizedResponse } from "./types";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";

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
};
