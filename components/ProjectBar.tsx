"use client";

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
}: ProjectBarProps) {
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

        <button onClick={onOpenChats} style={buttonStyle}>
          Chats ({sessionsCount})
        </button>
      </div>

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
