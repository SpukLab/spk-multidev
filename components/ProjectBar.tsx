"use client";

import { useState } from "react";

interface RepoOption {
  owner: string;
  name: string;
  lastCommitDate: string | null;
}

interface ProjectBarProps {
  owner: string;
  repo: string;
  branch: string;
  onChangeOwner: (v: string) => void;
  onChangeRepo: (v: string) => void;
  onChangeBranch: (v: string) => void;
  onLoadProject: () => void;
  projectStatus: string | null;
  loading: boolean;
  contextText: string;
  contextSource: string | null;
  onChangeContext: (v: string) => void;
  contextExpanded: boolean;
  onToggleContextExpanded: () => void;
  sessionsCount: number;
  onOpenChats: () => void;
  onOpenTasks: () => void;
  onOpenKnowledge: () => void;
  onOpenContextInspector: () => void;
  activeTaskTitle?: string | null;
  githubToken?: string;
}

export function ProjectBar({
  owner,
  repo,
  branch,
  onChangeOwner,
  onChangeRepo,
  onChangeBranch,
  onLoadProject,
  projectStatus,
  loading,
  contextText,
  contextSource,
  onChangeContext,
  contextExpanded,
  onToggleContextExpanded,
  sessionsCount,
  onOpenChats,
  onOpenTasks,
  onOpenKnowledge,
  onOpenContextInspector,
  activeTaskTitle,
  githubToken,
}: ProjectBarProps) {
  const [repoPickerOpen, setRepoPickerOpen] = useState(false);
  const [repoOptions, setRepoOptions] = useState<RepoOption[] | null>(null);
  const [repoPickerLoading, setRepoPickerLoading] = useState(false);

  async function handleOpenRepoPicker() {
    setRepoPickerOpen(true);
    if (repoOptions) return; // ya cargado
    setRepoPickerLoading(true);
    try {
      const res = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubToken }),
      });
      const data = await res.json();
      setRepoOptions(data.repos ?? []);
    } catch {
      setRepoOptions([]);
    } finally {
      setRepoPickerLoading(false);
    }
  }
  return (
    <section
      style={{
        border: "1px solid var(--spk-border)",
        borderRadius: 14,
        background: "linear-gradient(155deg,#13111f,#1b1726)",
        padding: 12,
        marginBottom: 14,
        boxShadow: "0 0 24px var(--spk-glow)",
      }}
    >
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={owner}
          onChange={(e) => onChangeOwner(e.target.value)}
          placeholder="owner"
          style={inputStyle}
        />
        <input
          value={repo}
          onChange={(e) => onChangeRepo(e.target.value)}
          placeholder="repo"
          style={inputStyle}
        />
        <input
          value={branch}
          onChange={(e) => onChangeBranch(e.target.value)}
          placeholder="branch"
          style={{ ...inputStyle, width: 70 }}
        />
        <button onClick={onLoadProject} disabled={loading} style={buttonStyle}>
          {loading ? "Cargando..." : "Cargar proyecto"}
        </button>

        <button onClick={handleOpenRepoPicker} style={buttonStyle}>
          Buscar repos
        </button>

        <button onClick={onOpenChats} style={buttonStyle}>
          Chats ({sessionsCount})
        </button>
        <button onClick={onOpenTasks} style={buttonStyle}>
          Tareas
        </button>
        <button onClick={onOpenKnowledge} style={buttonStyle}>
          Knowledge
        </button>
        <button onClick={onOpenContextInspector} style={buttonStyle}>
          🔍 Contexto
        </button>
        {activeTaskTitle && (
          <span style={{ color: "#4ade80", fontSize: 12, alignSelf: "center", marginLeft: 4 }}>
            ★ {activeTaskTitle}
          </span>
        )}
      </div>

      {repoPickerOpen && (
        <div
          style={{
            marginTop: 8,
            maxHeight: 200,
            overflowY: "auto",
            border: "1px solid var(--spk-border)",
            borderRadius: 8,
            padding: 6,
          }}
        >
          {repoPickerLoading && (
            <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>Cargando repos...</p>
          )}
          {repoOptions?.map((r) => (
            <button
              key={`${r.owner}/${r.name}`}
              onClick={() => {
                onChangeOwner(r.owner);
                onChangeRepo(r.name);
                setRepoPickerOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "var(--spk-text)",
                fontSize: 11,
                padding: "4px 2px",
              }}
            >
              {r.owner}/{r.name}{" "}
              <span style={{ color: "var(--spk-text-dim)" }}>
                ({r.lastCommitDate ? new Date(r.lastCommitDate).toLocaleDateString("es-AR") : "sin commits"})
              </span>
            </button>
          ))}
          {repoOptions?.length === 0 && (
            <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>No se encontraron repos.</p>
          )}
        </div>
      )}

      {projectStatus && (
        <p style={{ fontSize: 11, color: "var(--spk-text-dim)", marginTop: 6 }}>{projectStatus}</p>
      )}

      {contextText && (
        <div style={{ marginTop: 8 }}>
          <button onClick={onToggleContextExpanded} style={{ ...buttonStyle, fontSize: 10 }}>
            {contextExpanded ? "▾" : "▸"} Contexto adjunto ({contextSource}, {contextText.length} caracteres)
          </button>
          {contextExpanded && (
            <textarea
              value={contextText}
              onChange={(e) => onChangeContext(e.target.value)}
              rows={8}
              style={{
                width: "100%",
                marginTop: 6,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid var(--spk-border)",
                borderRadius: 8,
                color: "var(--spk-text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: 8,
              }}
            />
          )}
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: 12,
  minWidth: 90,
};

const buttonStyle: React.CSSProperties = {
  background: "var(--spk-active-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-active-fg)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 11,
};
