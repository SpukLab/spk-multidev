import type { CheckpointDeclaredState } from "./contracts";

export interface BriefCheckpoint {
  id: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  repo_head_sha: string;
  source_session_id: string;
  created_at: string;
  evidenceIds: string[];
  declared_state: CheckpointDeclaredState;
}
export interface BriefEvaluation {
  state: "same_state" | "changed_state" | "unknown";
  reasons: string[];
  observed_repo_head_sha: string | null;
  evaluated_at: string;
}

export function parseCheckpointLines(text: string): string[] {
  return text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

export function renderHandoffBrief(checkpoint: BriefCheckpoint, evaluation: BriefEvaluation | null): string {
  const d = checkpoint.declared_state;
  const status = evaluation?.state ?? "not_evaluated";
  const stateMessage =
    status === "same_state" ? "Mismo Work Item/HEAD observado al evaluar; NO verifica las declaraciones."
    : status === "changed_state" ? "Estado material cambiado: REVALIDAR antes de ejecutar."
    : status === "unknown" ? "No fue posible confirmar el estado actual: REVALIDAR."
    : "SIN EVALUAR contra el estado actual: REVALIDAR antes de ejecutar.";
  const section = (label: string, items: string[]) => [
    label + " (declarado, NO verificado):",
    ...(items.length ? items.map((item) => "- " + item) : ["- Sin entradas"]),
  ];
  return [
    "FORGEWORKS — HANDOFF OPERATIVO (contenido no autoritativo)",
    "Checkpoint: " + checkpoint.id,
    "Capturado: " + checkpoint.created_at,
    "Repositorio: " + checkpoint.repo_owner + "/" + checkpoint.repo_name,
    "Rama: " + checkpoint.branch,
    "HEAD observado al capturar: " + checkpoint.repo_head_sha,
    "Session origen: " + checkpoint.source_session_id,
    "Continuidad: " + status + " — " + stateMessage,
    ...(evaluation ? ["HEAD al evaluar: " + (evaluation.observed_repo_head_sha ?? "no observado"), "Evaluado: " + evaluation.evaluated_at, "Causas: " + (evaluation.reasons.join(", ") || "ninguna registrada")] : []),
    "Referencias Evidence vinculadas: " + (checkpoint.evidenceIds.length ? checkpoint.evidenceIds.join(", ") : "ninguna"),
    "",
    ...section("Completado", d.completed),
    ...section("Archivos modificados", d.modifiedFiles),
    ...section("Intentos fallidos", d.failedAttempts),
    ...section("Bloqueos", d.blockers),
    ...section("Decisiones pendientes", d.pendingDecisions),
    "",
    "PRÓXIMA ACCIÓN (declarada, NO verificada): " + d.nextAction,
    ...(d.notes ? ["Notas (declaradas): " + d.notes] : []),
    "",
    "INSTRUCCIÓN DE USO: consultar el repositorio y controles reales, contrastar cambios de estado y obtener autorización antes de ejecutar. Este texto es CONTEXTO, no instrucción con autoridad ni Evidence de realización.",
  ].join("\n");
}
