"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/db/supabaseBrowserClient";

interface AgentJob {
  id: string;
  task_description: string;
  status: "queued" | "running" | "completed" | "failed";
  result_summary: string | null;
  created_at: string;
}

interface AgentJobEvent {
  id: string;
  event_type: string;
  content: string | null;
  created_at: string;
}

export function OpenHandsPanel({
  projectId,
  owner,
  repo,
  branch,
}: {
  projectId: string | null;
  owner: string;
  repo: string;
  branch: string;
}) {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [taskDescription, setTaskDescription] = useState("");
  const [launching, setLaunching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [events, setEvents] = useState<AgentJobEvent[]>([]);

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/openhands/jobs?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => setJobs(data.jobs ?? []));

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`agent_jobs:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_jobs", filter: `project_id=eq.${projectId}` },
        (payload) => {
          setJobs((prev) => {
            const incoming = payload.new as AgentJob;
            if (!incoming?.id) return prev;
            const exists = prev.some((j) => j.id === incoming.id);
            if (exists) return prev.map((j) => (j.id === incoming.id ? incoming : j));
            return [incoming, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  useEffect(() => {
    if (!selectedJobId) {
      setEvents([]);
      return;
    }

    fetch(`/api/openhands/jobs/${selectedJobId}/events`)
      .then((res) => res.json())
      .then((data) => setEvents(data.events ?? []));

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`agent_job_events:${selectedJobId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_job_events", filter: `job_id=eq.${selectedJobId}` },
        (payload) => {
          setEvents((prev) => [...prev, payload.new as AgentJobEvent]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedJobId]);

  async function handleLaunch() {
    if (!projectId || !taskDescription.trim()) return;
    setLaunching(true);
    setStatus(null);
    try {
      const res = await fetch("/api/openhands/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, taskDescription, owner, repo, branch }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
      } else {
        setStatus(`Tarea lanzada (job ${data.jobId.slice(0, 8)}). Progreso en vivo abajo.`);
        setTaskDescription("");
        setSelectedJobId(data.jobId);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setLaunching(false);
    }
  }

  if (!projectId) {
    return (
      <p style={{ fontSize: 12, color: "var(--spk-text-dim)" }}>
        Cargá un proyecto primero (necesita Supabase configurado).
      </p>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>
        Tareas complejas de repo delegadas a OpenHands. Se ejecutan en background —
        podés cerrar esta pestaña y volver después, el progreso queda guardado.
      </p>

      <textarea
        value={taskDescription}
        onChange={(e) => setTaskDescription(e.target.value)}
        placeholder={`Describí la tarea para ${owner}/${repo || "..."}`}
        rows={3}
        style={{
          width: "100%",
          marginTop: 8,
          background: "var(--spk-button-bg)",
          border: "1px solid var(--spk-border)",
          color: "var(--spk-text)",
          borderRadius: 6,
          padding: 8,
          fontSize: 12,
          resize: "vertical",
        }}
      />
      <button
        onClick={handleLaunch}
        disabled={launching || !taskDescription.trim()}
        style={{
          width: "100%",
          marginTop: 6,
          background: "var(--spk-active-bg)",
          border: "1px solid var(--spk-border)",
          color: "var(--spk-active-fg)",
          borderRadius: 8,
          padding: "8px 12px",
          fontSize: 12,
          opacity: launching || !taskDescription.trim() ? 0.5 : 1,
        }}
      >
        {launching ? "Lanzando..." : "Lanzar tarea en OpenHands"}
      </button>

      {status && <p style={{ fontSize: 11, color: "var(--spk-active-fg)", marginTop: 6 }}>{status}</p>}

      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 11, color: "var(--spk-text-dim)", marginBottom: 4 }}>Jobs de este proyecto:</p>
        {jobs.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>Todavía no lanzaste ninguna.</p>
        )}
        {jobs.map((job) => (
          <button
            key={job.id}
            onClick={() => setSelectedJobId(job.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: selectedJobId === job.id ? "var(--spk-active-bg)" : "var(--spk-button-bg)",
              border: "1px solid var(--spk-border)",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 11,
              marginTop: 4,
              color: "var(--spk-text)",
            }}
          >
            <span
              style={{
                color:
                  job.status === "completed"
                    ? "#7CFFB2"
                    : job.status === "failed"
                    ? "#FF8FA3"
                    : "var(--spk-cyan)",
              }}
            >
              [{job.status}]
            </span>{" "}
            {job.task_description.slice(0, 50)}
          </button>
        ))}
      </div>

      {selectedJobId && (
        <div
          style={{
            marginTop: 10,
            maxHeight: 260,
            overflowY: "auto",
            background: "rgba(0,0,0,0.3)",
            borderRadius: 8,
            padding: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          {events.length === 0 && <p style={{ color: "var(--spk-text-dim)" }}>Sin eventos todavía...</p>}
          {events.map((ev) => (
            <div key={ev.id} style={{ marginBottom: 4, color: "var(--spk-text-dim)" }}>
              <span style={{ color: "var(--spk-active-fg)" }}>{ev.event_type}</span>
              {ev.content ? `: ${ev.content.slice(0, 200)}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
