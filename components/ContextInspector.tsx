"use client";

import { useEffect, useState } from "react";

interface ContextBuiltPayload {
  contextVersion: number;
  provider: string;
  panelId: string;
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  includedKnowledge: Array<{ id: string; title: string }>;
  omittedKnowledge: Array<{ id: string; title: string }>;
  conversationPairs: number;
  repositoryPaths: number;
  projectCanonIncluded: boolean;
  totalCharacters: number;
}

/**
 * Sprint 4, commit 5/6 — ADR-011.
 *
 * "¿Qué dijo el modelo?" ya lo respondía el chat. Esto responde "¿por
 * qué respondió eso?" — lee el último ContextBuilt real (Event Log, ya
 * ratificado), sin ningún subsistema nuevo, sin guardar el prompt.
 */
export function ContextInspector({
  open,
  onClose,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string | null;
}) {
  const [panelId, setPanelId] = useState<"left" | "right">("left");
  const [payload, setPayload] = useState<ContextBuiltPayload | null>(null);
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/context-inspector?sessionId=${sessionId}&panelId=${panelId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setPayload(data.contextBuilt?.payload ?? null);
          setTimestamp(data.contextBuilt?.timestamp ?? null);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido"))
      .finally(() => setLoading(false));
  }, [open, sessionId, panelId]);

  if (!open) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(380px, 100%)", height: "100%", background: "#0d0d12", borderLeft: "1px solid #2a2a35", padding: 16, overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ color: "#a78bfa" }}>Contexto</strong>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #333", color: "#fff", borderRadius: 6, padding: "2px 10px" }}>
            Cerrar
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <button
            onClick={() => setPanelId("left")}
            style={{ padding: "3px 10px", borderRadius: 6, background: panelId === "left" ? "#a78bfa" : "#1a1a22", border: "1px solid #333", color: panelId === "left" ? "#000" : "#ccc", fontSize: 12 }}
          >
            Panel A
          </button>
          <button
            onClick={() => setPanelId("right")}
            style={{ padding: "3px 10px", borderRadius: 6, background: panelId === "right" ? "#a78bfa" : "#1a1a22", border: "1px solid #333", color: panelId === "right" ? "#000" : "#ccc", fontSize: 12 }}
          >
            Panel B
          </button>
        </div>

        {!sessionId && <p style={{ color: "#888", fontSize: 13 }}>No hay sesión activa todavía — mandá un mensaje primero.</p>}
        {loading && <p style={{ color: "#888", fontSize: 13 }}>Cargando...</p>}
        {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
        {sessionId && !loading && !payload && !error && (
          <p style={{ color: "#888", fontSize: 13 }}>Todavía no se armó contexto en este panel.</p>
        )}

        {payload && (
          <div style={{ fontSize: 13, color: "#ddd", lineHeight: 1.7 }}>
            <div style={{ color: "#666", fontSize: 11, marginBottom: 10 }}>
              v{payload.contextVersion} · {payload.provider} · {timestamp ? new Date(timestamp).toLocaleString() : ""}
            </div>

            <div style={{ fontWeight: 600, color: "#a78bfa", marginTop: 8 }}>Task</div>
            {payload.activeTaskTitle ? <div>✓ {payload.activeTaskTitle}</div> : <div style={{ color: "#666" }}>ninguna activa</div>}

            <div style={{ fontWeight: 600, color: "#a78bfa", marginTop: 8 }}>Knowledge</div>
            {payload.includedKnowledge.length === 0 && payload.omittedKnowledge.length === 0 && (
              <div style={{ color: "#666" }}>ninguna</div>
            )}
            {payload.includedKnowledge.map((k) => (
              <div key={k.id} style={{ color: "#4ade80" }}>✓ {k.title}</div>
            ))}
            {payload.omittedKnowledge.map((k) => (
              <div key={k.id} style={{ color: "#666" }}>○ {k.title} (omitida)</div>
            ))}

            <div style={{ fontWeight: 600, color: "#a78bfa", marginTop: 8 }}>Conversación</div>
            <div>{payload.conversationPairs} pares</div>

            <div style={{ fontWeight: 600, color: "#a78bfa", marginTop: 8 }}>Repositorio</div>
            <div>{payload.repositoryPaths} archivos</div>

            <div style={{ fontWeight: 600, color: "#a78bfa", marginTop: 8 }}>Canon</div>
            <div>{payload.projectCanonIncluded ? "incluido" : "no incluido"}</div>

            <div style={{ fontWeight: 600, color: "#a78bfa", marginTop: 8 }}>Total</div>
            <div>{(payload.totalCharacters / 1000).toFixed(1)} kB</div>
          </div>
        )}
      </div>
    </div>
  );
}
