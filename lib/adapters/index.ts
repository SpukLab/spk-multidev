import { ProviderAdapter } from "./types";
import { nvidiaAdapter } from "./nvidia";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";

// Agregar un proveedor nuevo = escribir un adapter + registrarlo acá.
// No requiere tocar la UI ni las API routes.
export const adapters: Record<string, ProviderAdapter> = {
  nvidia: nvidiaAdapter,
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
};

export function getAdapter(providerId: string): ProviderAdapter {
  const adapter = adapters[providerId];
  if (!adapter) {
    throw new Error(`Proveedor desconocido: ${providerId}`);
  }
  return adapter;
}
