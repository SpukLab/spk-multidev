"use client";

import { useState } from "react";
import { Panel, PanelMessage } from "@/components/Panel";
import { LoopConnector } from "@/components/LoopConnector";
import { CodeIntakeDrawer } from "@/components/CodeIntakeDrawer";
import { ProjectBar } from "@/components/ProjectBar";
import { defaultRoles, CODE_INTAKE_INSTRUCTION } from "@/lib/roles";
import { getModelsForProvider } from "@/lib/providerModels";

interface PanelState {
  provider: string;
  model: string;
  roleId: string;
  messages: PanelMessage[];
  busy: boolean;
  collapsed: boolean;
}

interface SessionSummary {
  id: string;
  updated_at: string;
}

interface StoredMessage {
  id: string;
  panel: "left" | "right";
  role: "system" | "user" | "assistant";
  content: string;
}

function initialPanelState(provider: string, model: string): PanelState {
  return { provider, model, roleId: "none", messages: [], busy: false, collapsed: false };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg-${idCounter}`;
}

export default function HomePage() {
  const [left, setLeft] = useState<PanelState>(
    initialPanelState("nvidia", "nvidia/llama-3.3-nemotron-super-49b-v1")
  );
  const [right, setRight] = useState<PanelState>(initialPanelState("openai", "gpt-4o"));

  const [intakeRawText, setIntakeRawText] = useState("");
  const [owner, setOwner] = useState("SpukLab");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [viewMode, setViewMode] = useState<"both" | "left" | "right">("both");

  // Proyecto / contexto / sesiones (sección 11 y 13 de CONTEXT_BASE.md)
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [contextText, setContextText] = useState("");
  const [contextSource, setContextSource] = useState<string | null>(null);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  async function handleLoadProject() {
    if (!owner || !repo) {
      setProjectStatus("Completá owner y repo primero.");
      return;
    }
    setProjectLoading(true);
    setProjectStatus(null);
    try {
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch }),
      });
      const projData = await projRes.json();
      if (projData.error) {
        setProjectStatus(`Proyecto no persistido (Supabase no configurado?): ${projData.error}`);
        setProjectId(null);
      } else {
        setProjectId(projData.project.id);

        const sessRes = await fetch(`/api/sessions?projectId=${projData.project.id}`);
        const sessData = await sessRes.json();
        setSessions(sessData.sessions ?? []);
      }

      const ctxRes = await fetch("/api/github/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch }),
      });
      const ctxData = await ctxRes.json();
      setContextText(ctxData.content ?? "");
      setContextSource(ctxData.source ?? null);

      setProjectStatus(
        ctxData.source
          ? `Contexto cargado desde ${ctxData.source} (${(ctxData.content ?? "").length} caracteres).`
          : "No se encontró CONTEXT_BASE.md ni README.md en el repo."
      );
    } catch (err) {
      setProjectStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setProjectLoading(false);
    }
  }

  async function handleNewSession() {
    if (!projectId) {
      setProjectStatus("Cargá un proyecto primero (necesita Supabase configurado).");
      return;
    }
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    if (data.error) {
      setProjectStatus(`Error creando chat: ${data.error}`);
      return;
    }
    setCurrentSessionId(data.session.id);
    setSessions((prev) => [data.session, ...prev]);
    setLeft((s) => ({ ...s, messages: [] }));
    setRight((s) => ({ ...s, messages: [] }));
  }

  async function handleSelectSession(sessionId: string) {
    setCurrentSessionId(sessionId);
    const res = await fetch(`/api/sessions/${sessionId}/messages`);
    const data = await res.json();
    const msgs: StoredMessage[] = data.messages ?? [];

    const toPanelMsgs = (panel: "left" | "right"): PanelMessage[] =>
      msgs
        .filter((m) => m.panel === panel && m.role !== "system")
        .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }));

    setLeft((s) => ({ ...s, messages: toPanelMsgs("left") }));
    setRight((s) => ({ ...s, messages: toPanelMsgs("right") }));
  }

  async function persistMessage(panel: "left" | "right", role: "user" | "assistant", content: string) {
    if (!currentSessionId) return;
    try {
      await fetch(`/api/sessions/${currentSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panel, role, content }),
      });
    } catch {
      // Falla silenciosa: no bloquea el chat si la persistencia falla puntualmente.
    }
  }

  async function sendMessage(panel: "left" | "right", text: string) {
    const state = panel === "left" ? left : right;
    const setState = panel === "left" ? setLeft : setRight;

    const userMsg: PanelMessage = { id: nextId(), role: "user", content: text };
    setState({ ...state, messages: [...state.messages, userMsg], busy: true });
    persistMessage(panel, "user", text);

    const roleDef = defaultRoles.find((r) => r.id === state.roleId);
    const systemContent = [
      roleDef?.systemPrompt,
      contextText ? `Contexto del proyecto (${contextSource}):\n${contextText}` : null,
      CODE_INTAKE_INSTRUCTION,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: state.provider,
          model: state.model,
          messages: [
            ...(systemContent ? [{ role: "system", content: systemContent }] : []),
            ...state.messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
        }),
      });
      const data = await res.json();

      const assistantContent = data.error ? `Error: ${data.error}` : data.content;
      const assistantMsg: PanelMessage = {
        id: nextId(),
        role: "assistant",
        content: assistantContent,
        originLabel:
          roleDef && roleDef.id !== "none" ? `${roleDef.label} (${state.provider})` : undefined,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMsg],
        busy: false,
      }));

      if (!data.error) {
        persistMessage(panel, "assistant", assistantContent);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: nextId(),
            role: "assistant",
            content: `Error de red: ${err instanceof Error ? err.message : "desconocido"}`,
          },
        ],
        busy: false,
      }));
    }
  }

  function sendToOther(fromPanel: "left" | "right", content: string, template: string) {
    const toPanel = fromPanel === "left" ? "right" : "left";
    const finalText = template.trim() ? template.replace("[mensaje]", content) : content;
    sendMessage(toPanel, finalText);
  }

  return (
    <main style={{ padding: "16px", maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>
          <span style={{ color: "#fff", fontWeight: 800 }}>SPUK</span>
          <span style={{ color: "var(--spk-cyan)", fontWeight: 300 }}>MultiDev</span>
        </h1>
        <p
          style={{
            margin: "4px 0 0 0",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            fontStyle: "italic",
            color: "var(--spk-text-dim)",
          }}
        >
          Dual-panel · roles · Code Intake · push directo a GitHub
        </p>
      </header>

      <ProjectBar
        owner={owner}
        repo={repo}
        branch={branch}
        onChangeOwner={setOwner}
        onChangeRepo={setRepo}
        onChangeBranch={setBranch}
        onLoadProject={handleLoadProject}
        projectStatus={projectStatus}
        loading={projectLoading}
        contextText={contextText}
        contextSource={contextSource}
        onChangeContext={setContextText}
        contextExpanded={contextExpanded}
        onToggleContextExpanded={() => setContextExpanded((v) => !v)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {(["both", "left", "right"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              background: viewMode === mode ? "var(--spk-active-bg)" : "var(--spk-button-bg)",
              color: viewMode === mode ? "var(--spk-active-fg)" : "var(--spk-text-dim)",
              border: "1px solid var(--spk-border)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 11,
            }}
          >
            {mode === "both" ? "Ambos paneles" : mode === "left" ? "Solo Panel A" : "Solo Panel B"}
          </button>
        ))}
      </div>

      <div className="workspace" style={{ marginBottom: 14 }}>
        {viewMode !== "right" && (
          <Panel
            panelId="left"
            title="Panel A"
            messages={left.messages}
            provider={left.provider}
            model={left.model}
            roleId={left.roleId}
            busy={left.busy}
            collapsed={left.collapsed}
            onToggleCollapse={() => setLeft((s) => ({ ...s, collapsed: !s.collapsed }))}
            onChangeProvider={(p) =>
              setLeft((s) => ({ ...s, provider: p, model: getModelsForProvider(p)[0]?.id ?? "" }))
            }
            onChangeModel={(m) => setLeft((s) => ({ ...s, model: m }))}
            onChangeRole={(r) => setLeft((s) => ({ ...s, roleId: r }))}
            onSend={(text) => sendMessage("left", text)}
            onSendToOther={(content, template) => sendToOther("left", content, template)}
            onOpenInIntake={(content) => setIntakeRawText(content)}
          />
        )}

        {viewMode === "both" && <LoopConnector />}

        {viewMode !== "left" && (
          <Panel
            panelId="right"
            title="Panel B"
            messages={right.messages}
            provider={right.provider}
            model={right.model}
            roleId={right.roleId}
            busy={right.busy}
            collapsed={right.collapsed}
            onToggleCollapse={() => setRight((s) => ({ ...s, collapsed: !s.collapsed }))}
            onChangeProvider={(p) =>
              setRight((s) => ({ ...s, provider: p, model: getModelsForProvider(p)[0]?.id ?? "" }))
            }
            onChangeModel={(m) => setRight((s) => ({ ...s, model: m }))}
            onChangeRole={(r) => setRight((s) => ({ ...s, roleId: r }))}
            onSend={(text) => sendMessage("right", text)}
            onSendToOther={(content, template) => sendToOther("right", content, template)}
            onOpenInIntake={(content) => setIntakeRawText(content)}
          />
        )}
      </div>

      <CodeIntakeDrawer
        rawText={intakeRawText}
        owner={owner}
        repo={repo}
        branch={branch}
        onChangeOwner={setOwner}
        onChangeRepo={setRepo}
        onChangeBranch={setBranch}
      />
    </main>
  );
}
