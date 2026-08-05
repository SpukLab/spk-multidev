"use client";

import { useState } from "react";
import { DiffView } from "./DiffView";

interface ResolvedFile {
  path: string;
  action: "write" | "delete" | "rename" | "patch";
  fromPath?: string;
  oldContent: string | null;
  newContent: string | null;
  error?: string;
}

interface CodeIntakeDrawerProps {
  rawText: string;
  owner: string;
  repo: string;
  branch: string;
  onChangeOwner: (v: string) => void;
  onChangeRepo: (v: string) => void;
  onChangeBranch: (v: string) => void;
  githubToken?: string;
  knownFilePaths?: string[];
}

export function CodeIntakeDrawer({
  rawText,
  owner,
  repo,
  branch,
  onChangeOwner,
  onChangeRepo,
  onChangeBranch,
  githubToken,
  knownFilePaths,
}: CodeIntakeDrawerProps) {
  const [resolved, setResolved] = useState<ResolvedFile[] | null>(null);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleResolve() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/codeintake/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, owner, repo, branch, githubToken, knownFilePaths }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
      } else {
        setResolved(data.resolved);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!resolved) return;
    const validFiles = resolved.filter((f) => !f.error);
    if (validFiles.length === 0) {
      setStatus("No hay archivos válidos para commitear (revisá los errores marcados).");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/github/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          message: commitMessage || "Code Intake: cambios aplicados desde SPK_MultiDev",
          files: validFiles.map((f) => ({ path: f.path, content: f.newContent })),
          githubToken,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus(`Error al commitear: ${data.error}`);
      } else {
        setStatus(`Commit exitoso: ${data.commitSha.slice(0, 7)} — push a "${branch}" disparado.`);
        setResolved(null);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--spk-border)",
        borderRadius: 14,
        background: "linear-gradient(155deg,#13111f,#1b1726)",
        padding: 12,
        boxShadow: "0 0 24px var(--spk-glow)",
      }}
    >
      <h3
        style={{
          fontFamily: "var(--font-mono)",
          fontStyle: "italic",
          fontSize: 12,
          color: "var(--spk-active-fg)",
          margin: "0 0 8px 0",
        }}
      >
        Code Intake
      </h3>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          value={owner}
          onChange={(e) => onChangeOwner(e.target.value)}
          placeholder="owner (ej: SpukLab)"
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
          placeholder="branch (main)"
          style={inputStyle}
        />
      </div>

      {!rawText && (
        <p style={{ color: "var(--spk-text-dim)", fontSize: 12 }}>
          Elegí "Abrir en Code Intake" en algún mensaje de un panel para parsearlo acá.
        </p>
      )}

      {rawText && (
        <>
          <button onClick={handleResolve} disabled={loading} style={primaryButtonStyle}>
            {loading ? "Resolviendo contra GitHub..." : "Parsear y traer contenido real"}
          </button>

          {resolved && (
            <div style={{ marginTop: 10 }}>
              {resolved.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid var(--spk-border)",
                    borderRadius: 8,
                    padding: 8,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                    onClick={() => setExpandedPath(expandedPath === f.path ? null : f.path)}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{f.path}</span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: f.error ? "rgba(255,143,163,0.15)" : "var(--spk-active-bg)",
                        color: f.error ? "#FF8FA3" : "var(--spk-active-fg)",
                      }}
                    >
                      {f.error ? "RECHAZADO" : f.action.toUpperCase()}
                    </span>
                  </div>
                  {f.error && (
                    <p style={{ color: "#FF8FA3", fontSize: 11, marginTop: 4 }}>{f.error}</p>
                  )}
                  {expandedPath === f.path && !f.error && (
                    <div style={{ marginTop: 6 }}>
                      <DiffView oldText={f.oldContent ?? ""} newText={f.newContent ?? ""} />
                    </div>
                  )}
                </div>
              ))}

              <input
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Mensaje de commit"
                style={{ ...inputStyle, width: "100%", marginTop: 8 }}
              />
              <button
                onClick={handleCommit}
                disabled={loading}
                style={{ ...primaryButtonStyle, marginTop: 6 }}
              >
                {loading ? "Commiteando..." : "Commit & Push"}
              </button>
            </div>
          )}
        </>
      )}

      {status && <p style={{ fontSize: 12, marginTop: 8, color: "var(--spk-active-fg)" }}>{status}</p>}
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
  flex: 1,
  minWidth: 90,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "var(--spk-active-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-active-fg)",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  width: "100%",
};
