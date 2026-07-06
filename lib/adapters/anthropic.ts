import { ProviderAdapter, SendMessageParams, NormalizedResponse, ChatMessage } from "./types";

const ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1/messages";

export const anthropicAdapter: ProviderAdapter = {
  id: "anthropic",
  async sendMessage({ model, messages, apiKey }: SendMessageParams): Promise<NormalizedResponse> {
    // Anthropic separa el system prompt del resto de los mensajes.
    const systemMsg = messages.find((m: ChatMessage) => m.role === "system");
    const chatMsgs = messages.filter((m: ChatMessage) => m.role !== "system");

    const res = await fetch(ANTHROPIC_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemMsg ? systemMsg.content : undefined,
        messages: chatMsgs.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const content = (data?.content ?? [])
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("\n");

    return {
      provider: "anthropic",
      model,
      content,
      raw: data,
    };
  },
};
