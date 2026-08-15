"use client";

import { useEffect, useState } from "react";

interface Task {
  id: string;
  title: string;
  objective: string | null;
  acceptance_criteria: string | null;
  status: "open" | "in_progress" | "completed" | "abandoned";
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  abandoned_at: string | null;
}

interface HistoryEntry {
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  open: "Abierta",
  in_progress: "En curso",
  completed: "Completada",
  abandoned: "Abandonada",
};

const STATUS_COLOR: Record<Task["status"], string> = {
  open: "#888",
  in_progress: "#5ec8f8",
  completed: "#4ade80",
  abandoned: "#94a3b8",
};

export function TasksDrawer({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string | null;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadTasks() {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setTasks(data.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && projectId) loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  async function handleCreate() {
    if (!projectId || !newTitle.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, title: newTitle.trim(), objective: newObjective.trim() || undefined }),
      });
      const data = await res.json();
      if (data.error) {
        // El evento Tier A no se pudo persistir — la Task NO se creó,
        // se lo mostramos como error real, no como si hubiera funcionado.
        setError(`No se creó la tarea: ${data.error}`);
      } else {
        setNewTitle("");
        setNewObjective("");
        await loadTasks();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenTask(taskId: string) {
    setOpenTaskId(taskId);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch {
      setHistory([]);
    }
  }

  async function handleTransition(taskId: string, toStatus: Task["status"]) {
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
      const data = await res.json();
      if (data.error) {
        // Transición rechazada — o inválida, o el evento no persistió.
        // En ambos casos el estado real NO cambió (garantía Tier A).
        setError(`La transición no se aplicó: ${data.error}`);
      } else {
        await loadTasks();
        await handleOpenTask(taskId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  if (!open) return null;

  const openTask = tasks.find((t) => t.id === openTaskId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          height: "100%",
          background: "#0d0d12",
          borderLeft: "1px solid #2a2a35",
          padding: 16,
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <strong style={{ color: "#a78bfa" }}>Tareas</strong>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #333", color: "#fff", borderRadius: 6, padding: "2px 10px" }}>
            Cerrar
          </button>
        </div>

        {!projectId && <p style={{ color: "#888", fontSize: 13 }}>Cargá un proyecto primero.</p>}

        {projectId && (
          <>
            <div style={{ marginBottom: 16, borderBottom: "1px solid #222", paddingBottom: 16 }}>
              <input
                placeholder="Título de la tarea"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: "100%", marginBottom: 6, padding: 8, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff" }}
              />
              <textarea
                placeholder="Objetivo (opcional)"
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                style={{ width: "100%", minHeight: 50, marginBottom: 6, padding: 8, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff" }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim()}
                style={{ width: "100%", padding: 8, background: "#7c3aed", border: "none", borderRadius: 6, color: "#fff" }}
              >
                {creating ? "Creando..." : "+ Nueva tarea"}
              </button>
            </div>

            {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 12 }}>{error}</p>}
            {loading && <p style={{ color: "#888", fontSize: 13 }}>Cargando...</p>}

            {openTask ? (
              <div>
                <button onClick={() => setOpenTaskId(null)} style={{ background: "none", border: "none", color: "#a78bfa", marginBottom: 8 }}>
                  ← Volver
                </button>
                <h3 style={{ color: "#fff", marginBottom: 4 }}>{openTask.title}</h3>
                <span style={{ color: STATUS_COLOR[openTask.status], fontSize: 12 }}>
                  {STATUS_LABEL[openTask.status]}
                </span>
                {openTask.objective && <p style={{ color: "#ccc", fontSize: 13, marginTop: 8 }}>{openTask.objective}</p>}
                {openTask.acceptance_criteria && (
                  <p style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
                    <strong>Criterio de aceptación:</strong> {openTask.acceptance_criteria}
                  </p>
                )}

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {openTask.status === "open" && (
                    <button onClick={() => handleTransition(openTask.id, "in_progress")} style={{ padding: "4px 10px", borderRadius: 6, background: "#1a1a22", border: "1px solid #333", color: "#fff" }}>
                      Empezar
                    </button>
                  )}
                  {openTask.status === "in_progress" && (
                    <>
                      <button onClick={() => handleTransition(openTask.id, "completed")} style={{ padding: "4px 10px", borderRadius: 6, background: "#1a1a22", border: "1px solid #333", color: "#fff" }}>
                        Completar
                      </button>
                      <button onClick={() => handleTransition(openTask.id, "open")} style={{ padding: "4px 10px", borderRadius: 6, background: "#1a1a22", border: "1px solid #333", color: "#fff" }}>
                        Pausar
                      </button>
                    </>
                  )}
                  {(openTask.status === "open" || openTask.status === "in_progress") && (
                    <button onClick={() => handleTransition(openTask.id, "abandoned")} style={{ padding: "4px 10px", borderRadius: 6, background: "#1a1a22", border: "1px solid #333", color: "#f87171" }}>
                      Abandonar
                    </button>
                  )}
                </div>

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
              <div>
                {tasks.length === 0 && !loading && <p style={{ color: "#888", fontSize: 13 }}>Sin tareas todavía.</p>}
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleOpenTask(t.id)}
                    style={{ padding: 10, marginBottom: 6, background: "#1a1a22", borderRadius: 8, cursor: "pointer" }}
                  >
                    <div style={{ color: "#fff", fontSize: 13 }}>{t.title}</div>
                    <span style={{ color: STATUS_COLOR[t.status], fontSize: 11 }}>{STATUS_LABEL[t.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
