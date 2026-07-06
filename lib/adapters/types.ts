// Interfaz común que todo adapter de proveedor de IA debe implementar.
// Ver CONTEXT_BASE.md sección 3 para el diseño de esta capa.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SendMessageParams {
  model: string;
  messages: ChatMessage[];
  apiKey: string;
}

export interface NormalizedResponse {
  provider: string;
  model: string;
  content: string;
  raw?: unknown;
}

export interface ProviderAdapter {
  id: string; // ej: "nvidia", "anthropic", "openai"
  sendMessage(params: SendMessageParams): Promise<NormalizedResponse>;
}
