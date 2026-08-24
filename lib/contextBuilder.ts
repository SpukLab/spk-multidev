import { buildPromptSections } from "./promptSections";

/**
 * Sprint 4, commit 4/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * buildContext() sigue siendo una función PURA: no hace fetches, no sabe
 * de orden final de prompt (eso es `assemblePrompt`, en promptAssembler.ts,
 * que ahora es 100% agnóstico de dominio). El formateo específico de cada
 * bloque (qué dice el índice de archivos, cómo se presenta una Task, etc.)
 * vive en `promptSections.ts` — ni acá ni en el assembler.
 *
 * `CONTEXT_SCHEMA_VERSION` es la ÚNICA fuente de la versión de contexto —
 * ContextBuilder, PromptAssembler y el evento ContextBuilt la referencian
 * a esta misma constante, nunca escriben "1" a mano en tres lugares
 * distintos.
 */
export const CONTEXT_SCHEMA_VERSION = 1;

export interface PromptSection {
  readonly id: string;
  readonly priority: number;
  readonly content: string;
}

export interface ContextBundle {
  readonly meta: Readonly<{
    // projectId: string | null real (no "" sentinel) — la pregunta de
    // dominio ("¿puede existir un ContextBundle sin proyecto?") sigue
    // deliberadamente abierta, sin resolver acá.
    projectId: string | null;
    sessionId: string | null;
    panelId: "left" | "right";
    provider: string;
    contextVersion: typeof CONTEXT_SCHEMA_VERSION;
    generatedAt: string;
  }>;

  readonly role: Readonly<{
    id: string;
    systemPrompt: string;
  }> | null;

  readonly activeTask: Readonly<{
    id: string;
    title: string;
    objective: string | null;
    acceptanceCriteria: string | null;
    status: string;
  }> | null;

  readonly knowledge: ReadonlyArray<
    Readonly<{
      id: string;
      type: string;
      title: string;
      content: string;
      tier: "promoted-task" | "promoted-project" | "captured-task" | "captured-project";
    }>
  >;

  readonly projectCanon: Readonly<{
    source: string;
    content: string;
  }> | null;

  readonly conversation: ReadonlyArray<
    Readonly<{
      role: "user" | "assistant";
      content: string;
    }>
  >;

  readonly repositoryIndex: Readonly<{
    paths: ReadonlyArray<string>;
  }> | null;

  readonly codeIntakeInstruction: string;

  /**
   * Bloques de texto ya formateados, con prioridad de orden — la pieza
   * que hace que PromptAssembler no necesite conocer conceptos de dominio
   * (Code Intake, Task, Knowledge, etc). Cada sección se genera en
   * promptSections.ts, no acá ni en el assembler.
   */
  readonly sections: ReadonlyArray<PromptSection>;
}

export interface BuildContextParams {
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

export function buildContext(params: BuildContextParams): ContextBundle {
  const role = params.roleDef ? { id: params.roleDef.id, systemPrompt: params.roleDef.systemPrompt } : null;
  const activeTask = null; // Sin implementar todavía — commit posterior.
  const knowledge: ContextBundle["knowledge"] = []; // Sin implementar todavía — commit posterior.
  const projectCanon =
    params.contextText && params.contextSource
      ? { source: params.contextSource, content: params.contextText }
      : null;
  const repositoryIndex = params.knownFilePaths.length > 0 ? { paths: params.knownFilePaths } : null;

  const sections = buildPromptSections({
    role,
    activeTask,
    knowledge,
    sequentialThinkingInstruction: params.sequentialThinkingInstruction,
    projectCanon,
    repositoryIndex,
    codeIntakeInstruction: params.codeIntakeInstruction,
  });

  const bundle: ContextBundle = {
    meta: {
      projectId: params.projectId,
      sessionId: params.sessionId,
      panelId: params.panelId,
      provider: params.provider,
      contextVersion: CONTEXT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
    },
    role,
    activeTask,
    knowledge,
    projectCanon,
    conversation: params.messages,
    repositoryIndex,
    codeIntakeInstruction: params.codeIntakeInstruction,
    sections,
  };

  // El bundle es una "fotografía" del contexto — nadie debería poder
  // mutarlo de paso dentro de sendMessage(). Object.freeze es shallow en
  // JS; se congela también `meta` y `sections` (los más propensos a que
  // alguien los toque por error).
  Object.freeze(bundle.meta);
  Object.freeze(bundle.sections);
  return Object.freeze(bundle);
}
