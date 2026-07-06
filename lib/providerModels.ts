export interface ProviderConfig {
  id: string;
  label: string;
  models: { id: string; label: string }[];
}

// Catálogo editable — agregar un modelo nuevo es sumar una línea acá,
// no tocar el resto del hub (CONTEXT_BASE.md sección 3).
export const providers: ProviderConfig[] = [
  {
    id: "anthropic",
    label: "Claude",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    models: [
      { id: "nvidia/llama-3.3-nemotron-super-49b-v1", label: "Nemotron Super 49B" },
      { id: "deepseek-ai/deepseek-r1", label: "DeepSeek R1" },
      { id: "meta/llama-3.1-405b-instruct", label: "Llama 3.1 405B" },
    ],
  },
  {
    id: "openai",
    label: "ChatGPT",
    models: [
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
];

export function getModelsForProvider(providerId: string) {
  return providers.find((p) => p.id === providerId)?.models ?? [];
}
