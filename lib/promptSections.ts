import { ContextBundle } from "./contextBuilder";
import { PromptSection } from "./promptAssembler";

/**
 * Sprint 4, commit 4/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * `buildPromptSections(bundle)` es una PROYECCIÓN del ContextBundle, no
 * parte de él — mismo patrón que Event Log → Task/Knowledge/Active Task
 * ya aplicado tres veces en este proyecto. El bundle nunca sabe que esta
 * función existe; esta función es la única que sabe qué es Code Intake,
 * cómo se presenta una Task, o cómo se formatea Knowledge.
 *
 * Convención de prioridad: menor número = más cerca del principio del
 * prompt. Números dejados con espacio entre sí a propósito, para poder
 * insertar secciones nuevas sin renumerar todo.
 */

function roleSection(bundle: ContextBundle): PromptSection | null {
  if (!bundle.role?.systemPrompt) return null;
  return { id: "role", priority: 10, content: bundle.role.systemPrompt };
}

function activeTaskSection(bundle: ContextBundle): PromptSection | null {
  const t = bundle.activeTask;
  if (!t) return null;
  const lines = [
    `Task activa: ${t.title} (estado: ${t.status})`,
    t.objective ? `Objetivo: ${t.objective}` : null,
    t.acceptanceCriteria ? `Criterio de aceptación: ${t.acceptanceCriteria}` : null,
  ].filter(Boolean);
  return { id: "active-task", priority: 20, content: lines.join("\n") };
}

export type KnowledgeTier = "promoted-task" | "promoted-project" | "captured-task" | "captured-project";

/**
 * La escalera de 4 niveles acordada (CONTEXT_BASE.md sección 30/ADR-011):
 * promoted+Task activa > promoted del proyecto > captured+Task activa >
 * captured del proyecto. Un item vinculado a una Task que NO es la activa
 * queda excluido por completo (mismo motivo por el que Active Task es
 * única: evitar mezclar contextos de trabajo).
 *
 * Esta es la ÚNICA función que decide "qué conviene mostrar" — vive acá,
 * no en contextBuilder.ts, tal como está ratificado. Se exporta porque
 * el payload de telemetría de ContextBuilt (armado en page.tsx) necesita
 * exactamente esta misma clasificación para reportar qué se incluyó y
 * qué se omitió, sin duplicar la lógica en dos lugares.
 */
export function classifyKnowledgeForPrompt(
  bundle: ContextBundle
): Array<{ id: string; title: string; type: string; content: string; tier: KnowledgeTier }> {
  const activeTaskId = bundle.activeTask?.id ?? null;
  const result: Array<{ id: string; title: string; type: string; content: string; tier: KnowledgeTier }> = [];

  for (const k of bundle.knowledge) {
    const isTaskLinked = activeTaskId !== null && k.taskId === activeTaskId;
    const isProjectLevel = k.taskId === null;
    if (!isTaskLinked && !isProjectLevel) continue; // vinculado a otra Task, no la activa — excluido

    const tier: KnowledgeTier =
      k.status === "promoted"
        ? isTaskLinked
          ? "promoted-task"
          : "promoted-project"
        : isTaskLinked
          ? "captured-task"
          : "captured-project";

    result.push({ id: k.id, title: k.title, type: k.type, content: k.content, tier });
  }

  // Orden de prioridad real dentro del bloque de Knowledge — no solo
  // agrupado, efectivamente ordenado de más a menos autoritativo.
  const tierOrder: Record<KnowledgeTier, number> = {
    "promoted-task": 0,
    "promoted-project": 1,
    "captured-task": 2,
    "captured-project": 3,
  };
  result.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
  return result;
}

function knowledgeSection(bundle: ContextBundle): PromptSection | null {
  const classified = classifyKnowledgeForPrompt(bundle);
  if (classified.length === 0) return null;
  const lines = classified.map((k) => {
    const provisional = k.tier.startsWith("captured") ? " (provisorio, no promovido)" : "";
    return `- [${k.type}] ${k.title}${provisional}\n  ${k.content}`;
  });
  return { id: "knowledge", priority: 30, content: ["=== KNOWLEDGE RELEVANTE ===", ...lines].join("\n") };
}

function sequentialThinkingSection(bundle: ContextBundle): PromptSection | null {
  if (!bundle.sequentialThinkingInstruction) return null;
  return { id: "sequential-thinking", priority: 35, content: bundle.sequentialThinkingInstruction };
}

function projectCanonSection(bundle: ContextBundle): PromptSection | null {
  if (!bundle.projectCanon) return null;
  return {
    id: "project-canon",
    priority: 40,
    content: `Contexto del proyecto (${bundle.projectCanon.source}):\n${bundle.projectCanon.content}`,
  };
}

function repositoryIndexSection(bundle: ContextBundle): PromptSection | null {
  const idx = bundle.repositoryIndex;
  if (!idx) return null;
  return {
    id: "repository-index",
    priority: 50,
    content: [
      "=== ÍNDICE DE ARCHIVOS DEL REPOSITORIO (AUTORITATIVO) ===",
      "Esta es la lista completa y autoritativa de archivos que existen en este",
      "repositorio ahora mismo. No es descriptiva ni parcial — es la fuente de",
      "verdad sobre qué archivos existen.",
      "",
      "Reglas obligatorias:",
      "- Todo path que uses en un bloque FILE: debe pertenecer a este índice,",
      "  salvo que estés creando un archivo genuinamente nuevo (ACTION: write",
      "  de una ruta que no aparece en la lista, a propósito).",
      "- Nunca inventes ni asumas rutas de archivos que no estén en este índice.",
      "- No vuelvas a pedir el árbol de archivos del repositorio — ya lo tenés",
      "  completo acá abajo.",
      "- Si no existe ningún archivo adecuado para la tarea pedida, decilo",
      "  explícitamente en vez de inventar una ruta.",
      "",
      `Archivos (${idx.paths.length}):`,
      ...idx.paths,
      "=== FIN DEL ÍNDICE ===",
    ].join("\n"),
  };
}

function codeIntakeSection(bundle: ContextBundle): PromptSection | null {
  if (!bundle.codeIntakeInstruction) return null;
  // Prioridad 60, justo después del índice (50) — pegado a propósito, es
  // la instrucción que consume los paths FILE: (ver auditoría de
  // LLM-perspective prompt assembly, ya documentada en el proyecto).
  return { id: "code-intake-instruction", priority: 60, content: bundle.codeIntakeInstruction };
}

export function buildPromptSections(bundle: ContextBundle): PromptSection[] {
  return [
    roleSection(bundle),
    activeTaskSection(bundle),
    knowledgeSection(bundle),
    sequentialThinkingSection(bundle),
    projectCanonSection(bundle),
    repositoryIndexSection(bundle),
    codeIntakeSection(bundle),
  ].filter((s): s is PromptSection => s !== null);
}
