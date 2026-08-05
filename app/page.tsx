"use client";

import { useEffect, useState } from "react";
import { Panel, PanelMessage } from "@/components/Panel";
import { LoopConnector } from "@/components/LoopConnector";
import { CodeIntakeDrawer } from "@/components/CodeIntakeDrawer";
import { ChatsDrawer } from "@/components/ChatsDrawer";
import { SettingsDrawer } from "@/components/SettingsDrawer";
import { ProjectBar } from "@/components/ProjectBar";
import { defaultRoles, CODE_INTAKE_INSTRUCTION, SEQUENTIAL_THINKING_INSTRUCTION } from "@/lib/roles";
import { getModelsForProvider } from "@/lib/providerModels";
import { StoredApiKeys, CustomRole, loadApiKeys, saveApiKeys, loadCustomRoles, saveCustomRoles } from "@/lib/clientStorage";

interface PanelState {
  provider: string;
  model: string;
  roleId: string;
  messages: PanelMessage[];
  busy: boolean;
  collapsed: boolean;
  sequentialThinking: boolean;
}

interface SessionSummary {
  id: string;
  updated_at: string;
  preview: string | null;
}

interface StoredMessage {
  id: string;
  panel: "left" | "right";
  role: "system" | "user" | "assistant";
  content: string;
}

function initialPanelState(provider: string, model: string, roleId: string = "none"): PanelState {
  return {
    provider,
    model,
    roleId,
    messages: [],
    busy: false,
    collapsed: false,
    sequentialThinking: false,
  };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg-${idCounter}`;
}

export default function HomePage() {
  const [left, setLeft] = useState<PanelState>(
    initialPanelState("nvidia", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
  );
  const [right, setRight] = useState<PanelState>(
    initialPanelState("nvidia", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "implementador")
  );

  const [intakeRawText, setIntakeRawText] = useState("");
  const [owner, setOwner] = useState("SpukLab");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [viewMode, setViewMode] = useState<"both" | "left" | "right">("both");

  // En pantallas angostas, arrancar mostrando una sola pestaña en vez de
  // ambos paneles apilados (evita scroll largo en mobile).
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 860) {
      setViewMode("left");
    }
  }, []);

  // Proyecto / contexto / sesiones (sección 11 y 13 de CONTEXT_BASE.md)
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [contextText, setContextText] = useState("");
  const [contextSource, setContextSource] = useState<string | null>(null);
  const [contextExpanded, setContextExpanded] = useState(false);
  // Árbol real de archivos del repo — reutiliza listRepoTree (ya existente,
  // usado hasta ahora solo por Limpieza Masiva). Se conecta acá al flujo de
  // "Cargar proyecto" para que el modelo reciba paths reales, no solo el
  // texto de CONTEXT_BASE.md (ver Auditoría de flujo Contexto→Modelo→Code Intake).
  const [knownFilePaths, setKnownFilePaths] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [chatsDrawerOpen, setChatsDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState<StoredApiKeys>({});
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  useEffect(() => {
    setApiKeys(loadApiKeys());
    setCustomRoles(loadCustomRoles());
  }, []);

  const allRoles = [...defaultRoles, ...customRoles];

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
      let projectStatusMsg = "";
      if (projData.error) {
        projectStatusMsg = `Proyecto no persistido en Supabase: ${projData.error}`;
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
        body: JSON.stringify({ owner, repo, branch, githubToken: apiKeys.github }),
      });
      const ctxData = await ctxRes.json();

      // Reusa /api/github/tree (ya existente, hasta ahora solo llamado desde
      // Limpieza Masiva) para que el modelo también reciba los paths reales
      // del repo, no solo el texto de CONTEXT_BASE.md/README.
      let filePaths: string[] = [];
      try {
        const treeRes = await fetch("/api/github/tree", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, repo, branch, githubToken: apiKeys.github }),
        });
        const treeData = await treeRes.json();
        filePaths = treeData.files ?? [];
      } catch {
        // Si falla el árbol, seguimos igual solo con el texto de contexto —
        // no bloquea "Cargar proyecto" por esto.
      }
      setKnownFilePaths(filePaths);

      const fileListBlock =
        filePaths.length > 0
          ? `\n\nArchivos reales en el repo (${filePaths.length}):\n${filePaths.join("\n")}`
          : "";
      setContextText((ctxData.content ?? "") + fileListBlock);
      setContextSource(ctxData.source ?? null);

      const contextStatusMsg = ctxData.source
        ? `Contexto cargado desde ${ctxData.source} (${(ctxData.content ?? "").length} caracteres) + ${filePaths.length} paths reales del repo.`
        : "No se encontró CONTEXT_BASE.md ni README.md en el repo.";

      // Nunca ocultar un error real de Supabase detrás del status del
      // contexto — se muestran ambos, separados.
      setProjectStatus([projectStatusMsg, contextStatusMsg].filter(Boolean).join(" | "));
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

  // Umbral aproximado por proveedor — heurística conservadora en caracteres,
  // no tokenización exacta (el catálogo de modelos es dinámico y no siempre
  // expone la ventana de contexto real). Anthropic/OpenAI suelen tener
  // ventanas grandes; los modelos NIM varían mucho, así que el umbral es
  // más chico para evitar truncamientos silenciosos (CONTEXT_BASE.md §11,
  // pieza que había quedado speceada y sin implementar).
  const CONTEXT_SIZE_WARNING_THRESHOLD: Record<string, number> = {
    nvidia: 60000,
    anthropic: 300000,
    openai: 200000,
  };

  async function sendMessage(panel: "left" | "right", text: string) {
    const state = panel === "left" ? left : right;
    const setState = panel === "left" ? setLeft : setRight;

    const roleDef = allRoles.find((r) => r.id === state.roleId);
    const systemContent = [
      roleDef?.systemPrompt,
      state.sequentialThinking ? SEQUENTIAL_THINKING_INSTRUCTION : null,
      contextText ? `Contexto del proyecto (${contextSource}):\n${contextText}` : null,
      CODE_INTAKE_INSTRUCTION,
    ]
      .filter(Boolean)
      .join("\n\n");

    const historyChars = state.messages.reduce((acc, m) => acc + m.content.length, 0);
    const totalChars = systemContent.length + historyChars + text.length;
    const threshold = CONTEXT_SIZE_WARNING_THRESHOLD[state.provider] ?? 150000;

    if (totalChars > threshold) {
      const proceed = window.confirm(
        `El contexto de este mensaje es grande (~${Math.round(totalChars / 1000)}k caracteres) ` +
          `y ${state.provider} puede truncarlo sin avisar si supera su ventana real. ¿Enviar igual?`
      );
      if (!proceed) return;
    }

    const userMsg: PanelMessage = { id: nextId(), role: "user", content: text };
    setState({ ...state, messages: [...state.messages, userMsg], busy: true });
    persistMessage(panel, "user", text);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: state.provider,
          model: state.model,
          apiKey: apiKeys[state.provider as keyof StoredApiKeys],
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

  async function handleDeleteSession(sessionId: string) {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setLeft((s) => ({ ...s, messages: [] }));
        setRight((s) => ({ ...s, messages: [] }));
      }
    } catch {
      setProjectStatus("Error al borrar el chat.");
    }
  }

  function sendToOther(fromPanel: "left" | "right", content: string, template: string) {
    const toPanel = fromPanel === "left" ? "right" : "left";
    const finalText = template.trim() ? template.replace("[mensaje]", content) : content;
    sendMessage(toPanel, finalText);
  }

  return (
    <main style={{ padding: "16px", maxWidth: 1400, margin: "0 auto" }}>
      <header
        style={{
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
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
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            background: "var(--spk-button-bg)",
            border: "1px solid var(--spk-border)",
            color: "var(--spk-active-fg)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 11,
          }}
        >
          ⚙ Configuración
        </button>
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
        sessionsCount={sessions.length}
        onOpenChats={() => setChatsDrawerOpen(true)}
        githubToken={apiKeys.github}
      />

      <ChatsDrawer
        open={chatsDrawerOpen}
        onClose={() => setChatsDrawerOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
      />

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveApiKeys={(keys) => {
          setApiKeys(keys);
          saveApiKeys(keys);
        }}
        customRoles={customRoles}
        onSaveCustomRoles={(roles) => {
          setCustomRoles(roles);
          saveCustomRoles(roles);
        }}
        owner={owner}
        repo={repo}
        branch={branch}
        projectId={projectId}
      />

      <div className="tab-bar">
        {(["left", "right", "both"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={viewMode === mode ? "active" : ""}
          >
            {mode === "left" ? "Chat A" : mode === "right" ? "Chat B" : "Ambos"}
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
            roles={allRoles}
            apiKeys={apiKeys}
            sequentialThinking={left.sequentialThinking}
            onToggleSequentialThinking={() =>
              setLeft((s) => ({ ...s, sequentialThinking: !s.sequentialThinking }))
            }
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
            roles={allRoles}
            apiKeys={apiKeys}
            sequentialThinking={right.sequentialThinking}
            onToggleSequentialThinking={() =>
              setRight((s) => ({ ...s, sequentialThinking: !s.sequentialThinking }))
            }
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
        githubToken={apiKeys.github}
        knownFilePaths={knownFilePaths}
      />

    </main>
  );
}
