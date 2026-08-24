/**
 * Sprint 4, commit 2/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * buildContext() es una función PURA: no hace fetches, no concatena
 * texto de prompt, no sabe nada de cómo se va a ver el system message
 * final — eso es responsabilidad del PromptAssembler (commit 3, todavía
 * no existe). Acá solo se estructuran datos ya cargados por quien llama.
 *
 * En este commit `activeTask` y `knowledge` quedan deliberadamente vacíos
 * — el lugar está preparado, la lógica de selección real llega en
 * commits posteriores. `conversation`, `repositoryIndex`, `projectCanon`
 * y `role` copian exactamente lo que ya se usaba, sin ningún cambio de
 * comportamiento observable.
 */

export interface ContextBundle {
  readonly meta: Readonly<{
    // Corrección Commit 3: antes se usaba "" como sentinel cuando no hay
    // proyecto persistido — era deshonesto con el tipo real. Se corrige a
    // `string | null`. La pregunta de dominio más grande ("¿puede existir
    // un ContextBundle válido sin proyecto?") queda deliberadamente
    // abierta — no se resuelve acá, solo se deja de mentir sobre el tipo.
    projectId: string | null;
    sessionId: string | null;
    panelId: "left" | "right";
    provider: string;
    contextVersion: 1;
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
}

export function buildContext(params: BuildContextParams): ContextBundle {
  const bundle: ContextBundle = {
    meta: {
      projectId: params.projectId,
      sessionId: params.sessionId,
      panelId: params.panelId,
      provider: params.provider,
      contextVersion: 1,
      generatedAt: new Date().toISOString(),
    },
    role: params.roleDef ? { id: params.roleDef.id, systemPrompt: params.roleDef.systemPrompt } : null,
    // Sin implementar todavía — commit posterior.
    activeTask: null,
    // Sin implementar todavía — commit posterior.
    knowledge: [],
    projectCanon:
      params.contextText && params.contextSource
        ? { source: params.contextSource, content: params.contextText }
        : null,
    conversation: params.messages,
    repositoryIndex: params.knownFilePaths.length > 0 ? { paths: params.knownFilePaths } : null,
    codeIntakeInstruction: params.codeIntakeInstruction,
  };

  // Commit 3: el bundle es una "fotografía" del contexto — nadie debería
  // poder mutarlo de paso dentro de sendMessage(). Object.freeze es
  // shallow en JS; se congela también `meta` (el objeto anidado con más
  // chance de que alguien lo toque por error).
  Object.freeze(bundle.meta);
  return Object.freeze(bundle);
}
