"use client";

export interface TaskCheckpointSummary {
  id: string;
  source_session_id: string;
  repo_owner: string;
  repo_name: string;
  branch: string;
  repo_head_sha: string;
  work_item_updated_at: string;
  created_at: string;
  evidenceIds: string[];
  declared_state: {
    completed: string[];
    modifiedFiles: string[];
    failedAttempts: string[];
    blockers: string[];
    pendingDecisions: string[];
    nextAction: string;
    notes: string | null;
  };
}

export interface TaskCheckpointEvaluation {
  handoff: {
    id: string;
    state: "same_state" | "changed_state" | "unknown";
    reasons: string[];
    observed_repo_head_sha: string | null;
    evaluated_at: string;
  };
  stateMatchConfirmed: boolean;
  requiresStateRevalidation: boolean;
}

const STATE_VIEW: Record<
  TaskCheckpointEvaluation["handoff"]["state"],
  { label: string; color: string; detail: string }
> = {
  same_state: {
    label: "Estado compatible",
    color: "#4ade80",
    detail: "Work Item y HEAD observado coinciden con el checkpoint.",
  },
  changed_state: {
    label: "Estado cambió",
    color: "#fbbf24",
    detail: "Hay drift material. Revalidá antes de continuar.",
  },
  unknown: {
    label: "Estado no verificable",
    color: "#fca5a5",
    detail: "No fue posible comprobar todas las fuentes necesarias.",
  },
};

const REASON_LABEL: Record<string, string> = {
  work_item_changed: "Cambió el Work Item",
  repository_changed: "Cambió el repository configurado",
  repo_head_changed: "Cambió el HEAD de la branch",
  repo_head_unavailable: "No se pudo observar el HEAD",
};

function shortSha(sha: string): string {
  return sha.slice(0, 8);
}

function CountBadge({ label, count }: { label: string; count: number }) {
  if (count === 0) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        gap: 4,
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: 999,
        border: "1px solid #333",
        color: "#aaa",
        fontSize: 10,
      }}
    >
      {label}: {count}
    </span>
  );
}

export function TaskContinuityPanel({
  checkpoints,
  loading,
  currentSessionId,
  evaluation,
  evaluating,
  onEvaluate,
}: {
  checkpoints: TaskCheckpointSummary[];
  loading: boolean;
  currentSessionId: string | null;
  evaluation: TaskCheckpointEvaluation | null;
  evaluating: boolean;
  onEvaluate: (checkpointId: string) => void;
}) {
  const latest = checkpoints[0] ?? null;
  const stateView = evaluation ? STATE_VIEW[evaluation.handoff.state] : null;

  return (
    <section
      style={{
        marginTop: 16,
        padding: 10,
        border: "1px solid #2a2a35",
        borderRadius: 8,
        background: "#121219",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <h4 style={{ margin: 0, color: "#c4b5fd", fontSize: 12 }}>
          Continuidad
        </h4>
        <span style={{ color: "#666", fontSize: 10 }}>
          {checkpoints.length} checkpoint{checkpoints.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading && (
        <p style={{ margin: "8px 0 0", color: "#888", fontSize: 11 }}>
          Cargando checkpoints...
        </p>
      )}

      {!loading && !latest && (
        <p style={{ margin: "8px 0 0", color: "#777", fontSize: 11 }}>
          Todavía no hay checkpoints para este Work Item.
        </p>
      )}

      {latest && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ color: "#fff", fontSize: 11 }}>
              Último checkpoint
            </span>
            <span style={{ color: "#777", fontSize: 10 }}>
              {new Date(latest.created_at).toLocaleString()}
            </span>
          </div>

          <div style={{ marginTop: 6, color: "#999", fontSize: 10, lineHeight: 1.5 }}>
            <div>
              <strong>Repo:</strong> {latest.repo_owner}/{latest.repo_name}
            </div>
            <div>
              <strong>Branch:</strong> {latest.branch}
            </div>
            <div>
              <strong>HEAD:</strong> <code>{shortSha(latest.repo_head_sha)}</code>
            </div>
            <div>
              <strong>Session origen:</strong> <code>{latest.source_session_id.slice(0, 8)}</code>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ color: "#aaa", fontSize: 10, marginBottom: 3 }}>
              Próxima acción
            </div>
            <div style={{ color: "#e5e7eb", fontSize: 11 }}>
              {latest.declared_state.nextAction}
            </div>
          </div>

          {latest.declared_state.blockers.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: "#fca5a5", fontSize: 10, marginBottom: 3 }}>
                Blockers
              </div>
              {latest.declared_state.blockers.map((blocker) => (
                <div key={blocker} style={{ color: "#fca5a5", fontSize: 11 }}>
                  • {blocker}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            <CountBadge label="hecho" count={latest.declared_state.completed.length} />
            <CountBadge label="archivos" count={latest.declared_state.modifiedFiles.length} />
            <CountBadge label="fallos" count={latest.declared_state.failedAttempts.length} />
            <CountBadge label="decisiones" count={latest.declared_state.pendingDecisions.length} />
            <CountBadge label="evidence" count={latest.evidenceIds.length} />
          </div>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #24242d" }}>
            <button
              onClick={() => onEvaluate(latest.id)}
              disabled={!currentSessionId || evaluating}
              style={{
                width: "100%",
                padding: "7px 9px",
                borderRadius: 7,
                border: "1px solid #3a3a48",
                background: currentSessionId ? "#1a1a22" : "#15151b",
                color: currentSessionId ? "#c4b5fd" : "#666",
                fontSize: 11,
                cursor: currentSessionId ? "pointer" : "not-allowed",
              }}
            >
              {evaluating ? "Evaluando continuidad..." : "Comprobar estado con este chat"}
            </button>

            {!currentSessionId && (
              <p style={{ margin: "6px 0 0", color: "#666", fontSize: 10 }}>
                Abrí o creá un chat para evaluar este checkpoint.
              </p>
            )}

            {stateView && evaluation && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  border: `1px solid ${stateView.color}55`,
                  borderRadius: 7,
                  background: "#0f0f15",
                }}
              >
                <div style={{ color: stateView.color, fontSize: 11, fontWeight: 600 }}>
                  {stateView.label}
                </div>
                <div style={{ color: "#aaa", fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>
                  {stateView.detail}
                </div>

                {evaluation.handoff.reasons.length > 0 && (
                  <div style={{ marginTop: 5 }}>
                    {evaluation.handoff.reasons.map((reason) => (
                      <div key={reason} style={{ color: "#999", fontSize: 10 }}>
                        • {REASON_LABEL[reason] ?? reason}
                      </div>
                    ))}
                  </div>
                )}

                {evaluation.handoff.observed_repo_head_sha && (
                  <div style={{ color: "#777", fontSize: 10, marginTop: 5 }}>
                    HEAD observado:{" "}
                    <code>{shortSha(evaluation.handoff.observed_repo_head_sha)}</code>
                  </div>
                )}

                <div style={{ color: "#666", fontSize: 9, marginTop: 5 }}>
                  Evaluado {new Date(evaluation.handoff.evaluated_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <p style={{ margin: "8px 0 0", color: "#666", fontSize: 10, lineHeight: 1.4 }}>
            El checkpoint preserva contexto operativo. Sus declaraciones narrativas no son Evidence por sí mismas.
          </p>
        </div>
      )}
    </section>
  );
}
