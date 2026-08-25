import { buildContext, BuildContextParams, ContextBundle } from "./contextBuilder";

/**
 * Sprint 4 (post-commit 4) — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * ContextProvider es el ÚNICO punto de entrada para obtener un
 * ContextBundle completo, con Task activa y Knowledge ya resueltos.
 * Antes esta responsabilidad vivía inline en `sendMessage()`
 * (app/page.tsx) — se mueve acá para que cualquier consumidor futuro
 * (OpenHands, el Loop, un Auditor, generación automática de ADR) pueda
 * pedir el mismo contexto sin reimplementar los dos fetches ni duplicar
 * lógica dentro de page.tsx, que ya viene concentrando demasiado.
 *
 * Sigue sin romper la regla de `buildContext()`: los fetches viven acá
 * (en la capa de orquestación), nunca dentro del Builder en sí.
 */

export interface ProvideContextParams {
  projectId: string | null;
  sessionId: string | null;
  panelId: "left" | "right";
  provider: string;
  roleDef: { id: string; systemPrompt: string } | undefined | null;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  contextText: string;
  contextSource: string | null;
  knownFilePaths: string[];
  codeIntakeInstruction: string;
  sequentialThinkingInstruction: string | null;
}

export async function provideContext(params: ProvideContextParams): Promise<ContextBundle> {
  let activeTask: BuildContextParams["activeTask"] = null;
  let knowledgeItems: BuildContextParams["knowledgeItems"] = [];

  if (params.projectId) {
    try {
      const [activeTaskRes, knowledgeRes] = await Promise.all([
        fetch(`/api/active-task?projectId=${params.projectId}`),
        fetch(`/api/knowledge?projectId=${params.projectId}`),
      ]);
      const activeTaskJson = await activeTaskRes.json();
      const knowledgeJson = await knowledgeRes.json();
      activeTask = activeTaskJson.activeTask ?? null;
      knowledgeItems = knowledgeJson.items ?? [];
    } catch {
      // Si falla, se sigue sin Task activa/Knowledge en este contexto —
      // no bloquea al consumidor, el resto del bundle sigue siendo válido.
    }
  }

  return buildContext({
    projectId: params.projectId,
    sessionId: params.sessionId,
    panelId: params.panelId,
    provider: params.provider,
    roleDef: params.roleDef,
    messages: params.messages,
    contextText: params.contextText,
    contextSource: params.contextSource,
    knownFilePaths: params.knownFilePaths,
    codeIntakeInstruction: params.codeIntakeInstruction,
    sequentialThinkingInstruction: params.sequentialThinkingInstruction,
    activeTask,
    knowledgeItems,
  });
}
