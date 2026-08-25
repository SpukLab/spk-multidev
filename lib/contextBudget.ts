import { ContextBundle } from "./contextBuilder";

/**
 * Sprint 4, commit 6/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * Regla 1: nunca se corta una unidad atómica — un Knowledge entra
 * completo o no entra, un intercambio de conversación entra completo o
 * no entra, el canon del proyecto entra completo o no entra.
 *
 * Regla 2: prioridad fija por clase de contexto, sin heurísticas:
 *   Task activa → Knowledge promovido → Canon → Conversación →
 *   Knowledge captured → resto.
 * Task activa y Knowledge promovido NUNCA se tocan acá — igual que el
 * rol, el índice de archivos y CODE_INTAKE_INSTRUCTION (estructurales,
 * ya protegidos desde el ADR-011 original).
 *
 * Regla 3: se registra exactamente qué quedó afuera (`omittedByBudget`),
 * consumido por page.tsx para el payload de ContextBuilt.
 */

export interface BudgetOmission {
  id: string;
  type: "knowledge" | "conversation-pair" | "project-canon";
  title: string;
  reason: "budget";
}

export interface BudgetResult {
  bundle: ContextBundle;
  omittedByBudget: BudgetOmission[];
}

function approxSize(knowledge: ContextBundle["knowledge"], conversation: ContextBundle["conversation"], projectCanon: ContextBundle["projectCanon"], bundle: ContextBundle): number {
  let size = 0;
  if (bundle.role) size += bundle.role.systemPrompt.length;
  if (bundle.activeTask) {
    size += bundle.activeTask.title.length + (bundle.activeTask.objective?.length ?? 0) + (bundle.activeTask.acceptanceCriteria?.length ?? 0);
  }
  for (const k of knowledge) size += k.content.length + k.title.length;
  if (projectCanon) size += projectCanon.content.length;
  for (const m of conversation) size += m.content.length;
  if (bundle.repositoryIndex) size += bundle.repositoryIndex.paths.join("\n").length;
  size += bundle.codeIntakeInstruction.length;
  if (bundle.sequentialThinkingInstruction) size += bundle.sequentialThinkingInstruction.length;
  return size;
}

export function applyContextBudget(bundle: ContextBundle, budgetChars: number): BudgetResult {
  const omitted: BudgetOmission[] = [];
  let knowledge = [...bundle.knowledge];
  let conversation = [...bundle.conversation];
  let projectCanon = bundle.projectCanon;

  const activeTaskId = bundle.activeTask?.id ?? null;
  const size = () => approxSize(knowledge, conversation, projectCanon, bundle);

  // Paso 1 — Knowledge "captured" primero (menor prioridad que promoted,
  // que NUNCA se toca acá). Dentro de captured, se cortan primero las de
  // nivel proyecto (más lejos de lo que se está trabajando ahora) y
  // recién después las vinculadas a la Task activa.
  const capturedByPriority = knowledge
    .filter((k) => k.status === "captured")
    .sort((a, b) => {
      const aLinked = activeTaskId !== null && a.taskId === activeTaskId ? 1 : 0;
      const bLinked = activeTaskId !== null && b.taskId === activeTaskId ? 1 : 0;
      return aLinked - bLinked;
    });

  for (const k of capturedByPriority) {
    if (size() <= budgetChars) break;
    knowledge = knowledge.filter((x) => x.id !== k.id);
    omitted.push({ id: k.id, type: "knowledge", title: k.title, reason: "budget" });
  }

  // Paso 2 — Conversación: pares completos, los más viejos primero.
  while (size() > budgetChars && conversation.length >= 2) {
    const [oldestUser] = conversation;
    conversation = conversation.slice(2);
    omitted.push({
      id: `conversation-pair-${omitted.length}`,
      type: "conversation-pair",
      title: `Intercambio: "${oldestUser?.content.slice(0, 40) ?? ""}..."`,
      reason: "budget",
    });
  }

  // Paso 3 — Canon del proyecto: entra completo o no entra, nunca a la mitad.
  if (size() > budgetChars && projectCanon) {
    omitted.push({ id: "project-canon", type: "project-canon", title: projectCanon.source, reason: "budget" });
    projectCanon = null;
  }

  // Task activa, Knowledge promovido, rol, índice de archivos y
  // CODE_INTAKE_INSTRUCTION quedan exactamente como llegaron, sin
  // importar el resultado — nunca se tocan en este paso.
  const budgetedBundle: ContextBundle = Object.freeze({
    ...bundle,
    knowledge: Object.freeze(knowledge),
    conversation: Object.freeze(conversation),
    projectCanon,
  });

  return { bundle: budgetedBundle, omittedByBudget: omitted };
}
