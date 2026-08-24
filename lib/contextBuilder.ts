/**
 * Sprint 4, commit 4/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * buildContext() es una función PURA que devuelve solo DATOS — modelo de
 * dominio, nada de representación de prompt. `sections` NO vive acá: es
 * una proyección derivada, generada bajo demanda por
 * `buildPromptSections(bundle)` en promptSections.ts — mismo patrón ya
 * aplicado tres veces en este proyecto (Event Log → Task, Event Log →
 * Knowledge, Event Log → Active Task). El ContextBundle es el "Event Log"
 * de esta analogía; `PromptSection[]` es una de sus proyecciones posibles,
 * no la única — mañana puede haber también un InspectorSection[] u otra
 * vista, sin que el bundle sepa nada de ninguna de las dos.
 *
 * `CONTEXT_SCHEMA_VERSION` es la ÚNICA fuente de la versión de contexto —
 * ContextBuilder y el evento ContextBuilt la referencian a esta misma
 * constante, nunca escriben "1" a mano en varios lugares.
 */
export const CONTEXT_SCHEMA_VERSION = 1;

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
      // Hechos crudos, no una decisión de prioridad — clasificar esto en
      // tiers (promoted-task, captured-project, etc.) es responsabilidad
      // de buildPromptSections(), nunca de buildContext(). El Builder
      // responde "qué existe", no "qué conviene mostrar".
      status: "captured" | "promoted";
      taskId: string | null;
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

  // Dato de dominio (una preferencia del usuario para este intercambio),
  // no una sección de prompt ya formateada — el formateo lo hace
  // promptSections.ts a partir de este campo.
  readonly sequentialThinkingInstruction: string | null;
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
  // Ya cargados por quien llama (mismo criterio que el resto de los
  // params) — buildContext sigue sin hacer fetches. Se excluye acá
  // "rejected": es una regla de dominio dura (sección 29 del
  // CONTEXT_BASE — "rejected nunca se presenta como conocimiento
  // válido"), no una preferencia de prioridad, así que corresponde al
  // Builder, no a la proyección.
  activeTask: {
    id: string;
    title: string;
    objective: string | null;
    acceptance_criteria: string | null;
    status: string;
  } | null;
  knowledgeItems: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    status: "captured" | "promoted" | "rejected";
    task_id: string | null;
  }>;
}

export function buildContext(params: BuildContextParams): ContextBundle {
  const bundle: ContextBundle = {
    meta: {
      projectId: params.projectId,
      sessionId: params.sessionId,
      panelId: params.panelId,
      provider: params.provider,
      contextVersion: CONTEXT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
    },
    role: params.roleDef ? { id: params.roleDef.id, systemPrompt: params.roleDef.systemPrompt } : null,
    activeTask: params.activeTask
      ? {
          id: params.activeTask.id,
          title: params.activeTask.title,
          objective: params.activeTask.objective,
          acceptanceCriteria: params.activeTask.acceptance_criteria,
          status: params.activeTask.status,
        }
      : null,
    // "rejected" se excluye acá — regla de dominio dura, no una prioridad.
    // El resto (captured/promoted, con o sin Task) queda todo incluido;
    // clasificar en tiers y decidir qué mostrar es trabajo de
    // buildPromptSections(), no de acá.
    knowledge: params.knowledgeItems
      .filter((k) => k.status !== "rejected")
      .map((k) => ({
        id: k.id,
        type: k.type,
        title: k.title,
        content: k.content,
        status: k.status as "captured" | "promoted",
        taskId: k.task_id,
      })),
    projectCanon:
      params.contextText && params.contextSource
        ? { source: params.contextSource, content: params.contextText }
        : null,
    conversation: params.messages,
    repositoryIndex: params.knownFilePaths.length > 0 ? { paths: params.knownFilePaths } : null,
    codeIntakeInstruction: params.codeIntakeInstruction,
    sequentialThinkingInstruction: params.sequentialThinkingInstruction,
  };

  // El bundle es una "fotografía" del contexto — nadie debería poder
  // mutarlo de paso dentro de sendMessage(). Object.freeze es shallow en
  // JS; se congela también `meta` (la más propensa a que alguien la
  // toque por error).
  Object.freeze(bundle.meta);
  return Object.freeze(bundle);
}
