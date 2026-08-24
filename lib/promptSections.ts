import { ContextBundle, PromptSection } from "./contextBuilder";

/**
 * Sprint 4, commit 4/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * Acá vive todo el conocimiento de dominio del prompt: qué dice el
 * índice de archivos, cómo se presenta una Task activa, qué formato
 * tiene un bloque de Knowledge. `PromptAssembler` nunca importa nada de
 * acá directo — solo recibe las `PromptSection[]` ya armadas dentro del
 * `ContextBundle` y las ordena por prioridad. Así, agregar un dominio
 * nuevo (OpenHands, Observatory, Tool Memory, el Loop) es agregar una
 * función acá, no tocar el assembler.
 *
 * Convención de prioridad: menor número = más cerca del principio del
 * prompt. Números dejados con espacio entre sí a propósito, para poder
 * insertar secciones nuevas sin renumerar todo.
 */

type BundleInputs = Pick<
  ContextBundle,
  "role" | "activeTask" | "knowledge" | "projectCanon" | "repositoryIndex" | "codeIntakeInstruction"
> & {
  sequentialThinkingInstruction: string | null;
};

function roleSection(role: BundleInputs["role"]): PromptSection | null {
  if (!role?.systemPrompt) return null;
  return { id: "role", priority: 10, content: role.systemPrompt };
}

function activeTaskSection(activeTask: BundleInputs["activeTask"]): PromptSection | null {
  if (!activeTask) return null;
  const lines = [
    `Task activa: ${activeTask.title} (estado: ${activeTask.status})`,
    activeTask.objective ? `Objetivo: ${activeTask.objective}` : null,
    activeTask.acceptanceCriteria ? `Criterio de aceptación: ${activeTask.acceptanceCriteria}` : null,
  ].filter(Boolean);
  return { id: "active-task", priority: 20, content: lines.join("\n") };
}

function knowledgeSection(knowledge: BundleInputs["knowledge"]): PromptSection | null {
  if (knowledge.length === 0) return null;
  const lines = knowledge.map((k) => {
    const provisional = k.tier.startsWith("captured") ? " (provisorio, no promovido)" : "";
    return `- [${k.type}] ${k.title}${provisional}\n  ${k.content}`;
  });
  return { id: "knowledge", priority: 30, content: ["=== KNOWLEDGE RELEVANTE ===", ...lines].join("\n") };
}

function sequentialThinkingSection(instruction: string | null): PromptSection | null {
  if (!instruction) return null;
  return { id: "sequential-thinking", priority: 35, content: instruction };
}

function projectCanonSection(projectCanon: BundleInputs["projectCanon"]): PromptSection | null {
  if (!projectCanon) return null;
  return {
    id: "project-canon",
    priority: 40,
    content: `Contexto del proyecto (${projectCanon.source}):\n${projectCanon.content}`,
  };
}

function repositoryIndexSection(repositoryIndex: BundleInputs["repositoryIndex"]): PromptSection | null {
  if (!repositoryIndex) return null;
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
      `Archivos (${repositoryIndex.paths.length}):`,
      ...repositoryIndex.paths,
      "=== FIN DEL ÍNDICE ===",
    ].join("\n"),
  };
}

function codeIntakeSection(instruction: string): PromptSection | null {
  if (!instruction) return null;
  // Prioridad 60, justo después del índice (50) — pegado a propósito, es
  // la instrucción que consume los paths FILE: (ver auditoría de
  // LLM-perspective prompt assembly, ya documentada en el proyecto).
  return { id: "code-intake-instruction", priority: 60, content: instruction };
}

export function buildPromptSections(inputs: BundleInputs): PromptSection[] {
  return [
    roleSection(inputs.role),
    activeTaskSection(inputs.activeTask),
    knowledgeSection(inputs.knowledge),
    sequentialThinkingSection(inputs.sequentialThinkingInstruction),
    projectCanonSection(inputs.projectCanon),
    repositoryIndexSection(inputs.repositoryIndex),
    codeIntakeSection(inputs.codeIntakeInstruction),
  ].filter((s): s is PromptSection => s !== null);
}
