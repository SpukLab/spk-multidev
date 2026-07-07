export interface ProviderConfig {
  id: string;
  label: string;
  models: { id: string; label: string }[];
  preferredKeyword?: string; // usado para auto-elegir el modelo por defecto del catálogo real
}

// Catálogo editable — agregar un modelo nuevo es sumar una línea acá,
// no tocar el resto del hub (CONTEXT_BASE.md sección 3).
export const providers: ProviderConfig[] = [
  {
    id: "anthropic",
    label: "Claude",
    preferredKeyword: "sonnet",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    preferredKeyword: "nano-omni",
    models: [
      { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "Nemotron Nano 3 Omni" },
      { id: "deepseek-ai/deepseek-r1", label: "DeepSeek R1" },
      { id: "meta/llama-3.1-405b-instruct", label: "Llama 3.1 405B" },
    ],
  },
  {
    id: "openai",
    label: "ChatGPT",
    preferredKeyword: "gpt-4o",
    models: [
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
];

export function getModelsForProvider(providerId: string) {
  return providers.find((p) => p.id === providerId)?.models ?? [];
}
