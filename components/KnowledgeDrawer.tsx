"use client";

import { useEffect, useState } from "react";

type KnowledgeType =
  | "observation" | "insight" | "decision" | "hypothesis" | "experiment"
  | "pattern" | "adr_candidate" | "rejected_idea" | "open_question"
  | "implementation_note" | "temporary_note";

interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  title: string;
  content: string;
  status: "captured" | "promoted" | "rejected";
  confidence: "low" | "medium" | "high" | null;
  task_id: string | null;
  session_id: string | null;
  source_message_id: string | null;
  created_at: string;
}

interface HistoryEntry {
  event_type: string;
  timestamp: string;
}

const TYPE_LABEL: Record<KnowledgeType, string> = {
  observation: "Observación",
  insight: "Insight",
  decision: "Decisión",
  hypothesis: "Hipótesis",
  experiment: "Experimento",
  pattern: "Patrón",
  adr_candidate: "Candidato a ADR",
  rejected_idea: "Idea descartada",
  open_question: "Pregunta abierta",
  implementation_note: "Nota de implementación",
  temporary_note: "Nota temporal",
};

const STATUS_LABEL = { captured: "Capturado", promoted: "Promovido", rejected: "Rechazado" };
const STATUS_COLOR = { captured: "#888", promoted: "#4ade80", rejected: "#f87171" };

export function KnowledgeDrawer({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
}) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [newType, setNewType] = useState<KnowledgeType>("observation");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadItems() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ projectId });
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/knowledge?${params}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && projectId) loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId, filterType, filterStatus]);

  async function handleCreate() {
    if (!projectId || !newTitle.trim() || !newContent.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, type: newType, title: newTitle.trim(), content: newContent.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(`No se guardó: ${data.error}`);
      } else {
        setNewTitle("");
        setNewContent("");
        await loadItems();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpen(id: string) {
    setOpenId(id);
    try {
      const res = await fetch(`/api/knowledge/${id}`);
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch {
      setHistory([]);
    }
  }

  async function handleTransition(id: string, toStatus: "promoted" | "rejected") {
    setError(null);
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
      const data = await res.json();
      if (data.error) {
        setError(`No se aplicó: ${data.error}`);
      } else {
        await loadItems();
        await handleOpen(id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  if (!open) return null;

  const openItem = items.find((i) => i.id === openId);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{ width: "min(460px, 100%)", height: "100%", background: "#0d0d12", borderLeft: "1px solid #2a2a35", padding: 16, overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ color: "#a78bfa" }}>Knowledge</strong>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #333", color: "#fff", borderRadius: 6, padding: "2px 10px" }}>
            Cerrar
          </button>
        </div>

        {!projectId && <p style={{ color: "#888", fontSize: 13 }}>Cargá un proyecto primero.</p>}

        {projectId && !openItem && (
          <>
            <div style={{ marginBottom: 16, borderBottom: "1px solid #222", paddingBottom: 16 }}>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as KnowledgeType)}
                style={{ width: "100%", marginBottom: 6, padding: 8, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff" }}
              >
                {Object.entries(TYPE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <input
                placeholder="Título"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: "100%", marginBottom: 6, padding: 8, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff" }}
              />
              <textarea
                placeholder="Contenido"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                style={{ width: "100%", minHeight: 70, marginBottom: 6, padding: 8, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff" }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newContent.trim()}
                style={{ width: "100%", padding: 8, background: "#7c3aed", border: "none", borderRadius: 6, color: "#fff" }}
              >
                {creating ? "Guardando..." : "+ Capturar conocimiento"}
              </button>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ flex: 1, padding: 6, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#ccc", fontSize: 12 }}>
                <option value="">Todos los tipos</option>
                {Object.entries(TYPE_LABEL).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ flex: 1, padding: 6, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#ccc", fontSize: 12 }}>
                <option value="">Todos los estados</option>
                <option value="captured">Capturado</option>
                <option value="promoted">Promovido</option>
                <option value="rejected">Rechazado</option>
              </select>
            </div>
          </>
        )}

        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {loading && <p style={{ color: "#888", fontSize: 13 }}>Cargando...</p>}

        {openItem ? (
          <div>
            <button onClick={() => setOpenId(null)} style={{ background: "none", border: "none", color: "#a78bfa", marginBottom: 8 }}>
              ← Volver
            </button>
            <span style={{ fontSize: 11, color: "#a78bfa" }}>{TYPE_LABEL[openItem.type]}</span>
            <h3 style={{ color: "#fff", margin: "4px 0" }}>{openItem.title}</h3>
            <span style={{ color: STATUS_COLOR[openItem.status], fontSize: 12 }}>{STATUS_LABEL[openItem.status]}</span>
            {openItem.confidence && <span style={{ color: "#999", fontSize: 11, marginLeft: 8 }}>confianza: {openItem.confidence}</span>}

            <p style={{ color: "#ddd", fontSize: 14, marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{openItem.content}</p>

            <div style={{ fontSize: 11, color: "#777", marginTop: 12 }}>
              {openItem.task_id && <div>Vinculado a una Task</div>}
              {openItem.session_id && <div>Origen: conversación guardada</div>}
              {openItem.source_message_id && <div>Origen: mensaje específico de una IA</div>}
              {!openItem.session_id && !openItem.source_message_id && <div>Creado manualmente</div>}
            </div>

            {openItem.status === "captured" && (
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                <button onClick={() => handleTransition(openItem.id, "promoted")} style={{ padding: "4px 10px", borderRadius: 6, background: "#1a1a22", border: "1px solid #333", color: "#4ade80" }}>
                  Promover
                </button>
                <button onClick={() => handleTransition(openItem.id, "rejected")} style={{ padding: "4px 10px", borderRadius: 6, background: "#1a1a22", border: "1px solid #333", color: "#f87171" }}>
                  Rechazar
                </button>
              </div>
            )}

            <h4 style={{ color: "#888", fontSize: 12, marginTop: 16, marginBottom: 6 }}>Historial (eventos)</h4>
            <div style={{ fontSize: 11, color: "#999" }}>
              {history.map((h, i) => (
                <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #1a1a22" }}>
                  <code style={{ color: "#a78bfa" }}>{h.event_type}</code> — {new Date(h.timestamp).toLocaleString()}
                </div>
              ))}
            </div>
          </div>
        ) : (
          projectId && (
            <div>
              {items.length === 0 && !loading && <p style={{ color: "#888", fontSize: 13 }}>Sin conocimiento capturado todavía.</p>}
              {items.map((it) => (
                <div key={it.id} onClick={() => handleOpen(it.id)} style={{ padding: 10, marginBottom: 6, background: "#1a1a22", borderRadius: 8, cursor: "pointer" }}>
                  <span style={{ fontSize: 10, color: "#a78bfa" }}>{TYPE_LABEL[it.type]}</span>
                  <div style={{ color: "#fff", fontSize: 13 }}>{it.title}</div>
                  <span style={{ color: STATUS_COLOR[it.status], fontSize: 11 }}>{STATUS_LABEL[it.status]}</span>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
