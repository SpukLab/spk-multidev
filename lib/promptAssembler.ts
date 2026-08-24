/**
 * Sprint 4, commit 4/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * assemblePrompt() es un SERIALIZADOR puro: no conoce `ContextBundle`,
 * no importa nada de promptSections.ts, no sabe qué es una Task, un
 * Knowledge, ni Code Intake — solo recibe secciones ya armadas
 * (`PromptSection[]`), la conversación, y el mensaje nuevo, y produce
 * el prompt final. Domain-agnóstico de verdad: ni siquiera depende del
 * tipo `ContextBundle`, para que cualquier consumidor futuro (un
 * Inspector visual, un exportador JSON) pueda generar su propia
 * proyección sin que este archivo lo sepa ni le importe.
 */

export interface PromptSection {
  readonly id: string;
  readonly priority: number;
  readonly content: string;
}

export interface AssembledPrompt {
  systemContent: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface AssemblePromptParams {
  sections: ReadonlyArray<PromptSection>;
  conversation: ReadonlyArray<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}

export function assemblePrompt(params: AssemblePromptParams): AssembledPrompt {
  const orderedSections = [...params.sections].sort((a, b) => a.priority - b.priority);
  const systemContent = orderedSections.map((s) => s.content).join("\n\n");

  const messages: AssembledPrompt["messages"] = [
    ...(systemContent ? [{ role: "system" as const, content: systemContent }] : []),
    ...params.conversation.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: params.userMessage },
  ];

  return { systemContent, messages };
}
