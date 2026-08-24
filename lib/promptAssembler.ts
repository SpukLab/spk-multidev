import { ContextBundle } from "./contextBuilder";

/**
 * Sprint 4, commit 4/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * assemblePrompt() es ahora 100% agnóstico de dominio: no importa
 * CODE_INTAKE_INSTRUCTION, no sabe qué es una Task ni un Knowledge —
 * solo recibe `bundle.sections` (ya armadas en promptSections.ts) y las
 * ordena por prioridad. El día que aparezca OpenHands, Observatory, o
 * cualquier dominio nuevo, se agrega una función en promptSections.ts —
 * este archivo no se toca.
 */

export interface AssembledPrompt {
  systemContent: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface AssemblePromptOptions {
  userMessage: string;
}

export function assemblePrompt(bundle: ContextBundle, options: AssemblePromptOptions): AssembledPrompt {
  const orderedSections = [...bundle.sections].sort((a, b) => a.priority - b.priority);
  const systemContent = orderedSections.map((s) => s.content).join("\n\n");

  const messages: AssembledPrompt["messages"] = [
    ...(systemContent ? [{ role: "system" as const, content: systemContent }] : []),
    ...bundle.conversation.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: options.userMessage },
  ];

  return { systemContent, messages };
}
