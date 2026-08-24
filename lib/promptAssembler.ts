import { ContextBundle } from "./contextBuilder";

/**
 * Sprint 4, commit 3/6 — ADR-011 (CONTEXT_BASE.md sección 30).
 *
 * assemblePrompt() es la ÚNICA pieza del hub que sabe cómo se ve un
 * prompt final. `buildContext()` no sabe de texto; `sendMessage()` no
 * sabe de texto — ambos le entregan datos a esta función, que devuelve
 * exactamente lo que un adapter necesita para llamar al proveedor.
 *
 * Orden justificado en el ADR-011: rol → Task activa → Knowledge →
 * canon del proyecto → conversación reciente → índice de archivos →
 * CODE_INTAKE_INSTRUCTION (pegado al índice) → mensaje del usuario.
 * En este commit `activeTask`/`knowledge` siguen vacíos en el bundle,
 * así que esos dos bloques del orden todavía no producen texto — el
 * lugar queda reservado para cuando se implementen (commits siguientes).
 */

export interface AssembledPrompt {
  systemContent: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface AssemblePromptOptions {
  sequentialThinkingInstruction: string | null;
  userMessage: string;
}

function buildFileIndexBlock(bundle: ContextBundle): string | null {
  if (!bundle.repositoryIndex) return null;
  return [
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
    `Archivos (${bundle.repositoryIndex.paths.length}):`,
    ...bundle.repositoryIndex.paths,
    "=== FIN DEL ÍNDICE ===",
  ].join("\n");
}

function buildActiveTaskBlock(bundle: ContextBundle): string | null {
  // Sin implementar todavía — el bundle siempre trae `activeTask: null`
  // en este commit. El bloque queda listo para cuando exista.
  if (!bundle.activeTask) return null;
  const t = bundle.activeTask;
  return [
    `Task activa: ${t.title} (estado: ${t.status})`,
    t.objective ? `Objetivo: ${t.objective}` : null,
    t.acceptanceCriteria ? `Criterio de aceptación: ${t.acceptanceCriteria}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildKnowledgeBlock(bundle: ContextBundle): string | null {
  // Sin implementar todavía — el bundle siempre trae `knowledge: []` en
  // este commit. El bloque queda listo para cuando exista selección real.
  if (bundle.knowledge.length === 0) return null;
  const lines = bundle.knowledge.map((k) => {
    const provisional = k.tier.startsWith("captured") ? " (provisorio, no promovido)" : "";
    return `- [${k.type}] ${k.title}${provisional}\n  ${k.content}`;
  });
  return ["=== KNOWLEDGE RELEVANTE ===", ...lines].join("\n");
}

export function assemblePrompt(bundle: ContextBundle, options: AssemblePromptOptions): AssembledPrompt {
  const systemContent = [
    bundle.role?.systemPrompt,
    buildActiveTaskBlock(bundle),
    buildKnowledgeBlock(bundle),
    options.sequentialThinkingInstruction,
    bundle.projectCanon ? `Contexto del proyecto (${bundle.projectCanon.source}):\n${bundle.projectCanon.content}` : null,
    buildFileIndexBlock(bundle),
    bundle.codeIntakeInstruction,
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: AssembledPrompt["messages"] = [
    ...(systemContent ? [{ role: "system" as const, content: systemContent }] : []),
    ...bundle.conversation.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: options.userMessage },
  ];

  return { systemContent, messages };
}
