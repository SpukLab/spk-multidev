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
}: {
  checkpoints: TaskCheckpointSummary[];
  loading: boolean;
}) {
  const latest = checkpoints[0] ?? null;

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

          <p style={{ margin: "8px 0 0", color: "#666", fontSize: 10, lineHeight: 1.4 }}>
            El checkpoint preserva contexto operativo. Sus declaraciones narrativas no son Evidence por sí mismas.
          </p>
        </div>
      )}
    </section>
  );
}
