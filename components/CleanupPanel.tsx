"use client";

import { useState } from "react";

interface RepoSummary {
  owner: string;
  name: string;
  lastCommitDate: string | null;
  private: boolean;
}

export function CleanupPanel({
  owner,
  repo,
  branch,
}: {
  owner: string;
  repo: string;
  branch: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"files" | "repos">("files");

  // Nivel 1: archivos
  const [files, setFiles] = useState<string[] | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesStatus, setFilesStatus] = useState<string | null>(null);

  // Nivel 2: repos completos
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [reposLoading, setReposLoading] = useState(false);
  const [reposStatus, setReposStatus] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function loadFiles() {
    if (!owner || !repo) {
      setFilesStatus("Completá owner y repo en la barra de proyecto primero.");
      return;
    }
    setFilesLoading(true);
    setFilesStatus(null);
    try {
      const res = await fetch("/api/github/tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch }),
      });
      const data = await res.json();
      if (data.error) {
        setFilesStatus(`Error: ${data.error}`);
      } else {
        setFiles(data.files);
        setSelectedFiles(new Set());
      }
    } catch (err) {
      setFilesStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setFilesLoading(false);
    }
  }

  async function handleDeleteFiles() {
    if (selectedFiles.size === 0) return;
    setFilesLoading(true);
    setFilesStatus(null);
    try {
      const res = await fetch("/api/github/bulk-delete-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, paths: Array.from(selectedFiles) }),
      });
      const data = await res.json();
      if (data.error) {
        setFilesStatus(`Error: ${data.error}`);
      } else {
        setFilesStatus(`Commit exitoso (${data.commitSha.slice(0, 7)}): ${selectedFiles.size} archivo(s) eliminado(s).`);
        setFiles((prev) => prev?.filter((f) => !selectedFiles.has(f)) ?? null);
        setSelectedFiles(new Set());
      }
    } catch (err) {
      setFilesStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setFilesLoading(false);
    }
  }

  async function loadRepos() {
    setReposLoading(true);
    setReposStatus(null);
    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();
      if (data.error) {
        setReposStatus(`Error: ${data.error}`);
      } else {
        setRepos(data.repos);
        setSelectedRepos(new Set());
        setConfirmText("");
      }
    } catch (err) {
      setReposStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setReposLoading(false);
    }
  }

  const selectedRepoNames = Array.from(selectedRepos);
  const expectedConfirm = selectedRepoNames.join(",");

  async function handleDeleteRepos() {
    if (selectedRepos.size === 0 || !repos) return;
    if (confirmText !== expectedConfirm) {
      setReposStatus("El texto de confirmación no coincide.");
      return;
    }
    setReposLoading(true);
    setReposStatus(null);
    try {
      const reposToDelete = repos
        .filter((r) => selectedRepos.has(r.name))
        .map((r) => ({ owner: r.owner, name: r.name }));

      const res = await fetch("/api/github/delete-repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repos: reposToDelete, confirmText }),
      });
      const data = await res.json();
      if (data.error) {
        setReposStatus(`Error: ${data.error}`);
      } else {
        const ok = data.results.filter((r: { ok: boolean }) => r.ok).length;
        const failed = data.results.filter((r: { ok: boolean }) => !r.ok);
        setReposStatus(
          `${ok} repo(s) borrado(s).` +
            (failed.length > 0
              ? ` Fallaron: ${failed.map((f: { repo: string; error?: string }) => `${f.repo} (${f.error})`).join(", ")}`
              : "")
        );
        setRepos((prev) => prev?.filter((r) => !selectedRepos.has(r.name)) ?? null);
        setSelectedRepos(new Set());
        setConfirmText("");
      }
    } catch (err) {
      setReposStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setReposLoading(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid var(--spk-border)",
        borderRadius: 14,
        background: "linear-gradient(155deg,#13111f,#1b1726)",
        padding: 12,
        marginTop: 14,
        boxShadow: "0 0 24px var(--spk-glow)",
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--spk-active-fg)",
          fontFamily: "var(--font-mono)",
          fontStyle: "italic",
          fontSize: 12,
          padding: 0,
        }}
      >
        {expanded ? "▾" : "▸"} Limpieza masiva
      </button>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button
              onClick={() => setTab("files")}
              style={{ ...tabButtonStyle, ...(tab === "files" ? tabButtonActiveStyle : {}) }}
            >
              Archivos del repo activo
            </button>
            <button
              onClick={() => setTab("repos")}
              style={{ ...tabButtonStyle, ...(tab === "repos" ? tabButtonActiveStyle : {}) }}
            >
              Repos completos
            </button>
          </div>

          {tab === "files" && (
            <div>
              <button onClick={loadFiles} disabled={filesLoading} style={primaryButtonStyle}>
                {filesLoading ? "Cargando..." : `Listar archivos de ${owner}/${repo || "..."}`}
              </button>

              {files && (
                <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                  {files.map((f) => (
                    <label
                      key={f}
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        padding: "3px 0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(f)}
                        onChange={(e) => {
                          const next = new Set(selectedFiles);
                          if (e.target.checked) next.add(f);
                          else next.delete(f);
                          setSelectedFiles(next);
                        }}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              )}

              {selectedFiles.size > 0 && (
                <button
                  onClick={handleDeleteFiles}
                  disabled={filesLoading}
                  style={{ ...dangerButtonStyle, marginTop: 8 }}
                >
                  Borrar {selectedFiles.size} archivo(s) seleccionado(s) (1 commit)
                </button>
              )}

              {filesStatus && (
                <p style={{ fontSize: 11, color: "var(--spk-text-dim)", marginTop: 6 }}>{filesStatus}</p>
              )}
            </div>
          )}

          {tab === "repos" && (
            <div>
              <p style={{ fontSize: 11, color: "#FF8FA3", marginBottom: 6 }}>
                Irreversible: GitHub no tiene papelera para repos borrados.
              </p>
              <button onClick={loadRepos} disabled={reposLoading} style={primaryButtonStyle}>
                {reposLoading ? "Cargando..." : "Listar repos de la cuenta"}
              </button>

              {repos && (
                <div style={{ marginTop: 8, maxHeight: 260, overflowY: "auto" }}>
                  {repos.map((r) => (
                    <label
                      key={r.name}
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        fontSize: 11,
                        fontFamily: "var(--font-mono)",
                        padding: "3px 0",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepos.has(r.name)}
                        onChange={(e) => {
                          const next = new Set(selectedRepos);
                          if (e.target.checked) next.add(r.name);
                          else next.delete(r.name);
                          setSelectedRepos(next);
                          setConfirmText("");
                        }}
                      />
                      {r.name}{" "}
                      <span style={{ color: "var(--spk-text-dim)" }}>
                        ({r.lastCommitDate ? new Date(r.lastCommitDate).toLocaleDateString("es-AR") : "sin commits"})
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {selectedRepos.size > 0 && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>
                    Para confirmar, escribí exactamente: <code>{expectedConfirm}</code>
                  </p>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--spk-button-bg)",
                      border: "1px solid var(--spk-border)",
                      color: "var(--spk-text)",
                      borderRadius: 6,
                      padding: "5px 8px",
                      fontSize: 12,
                      fontFamily: "var(--font-mono)",
                    }}
                  />
                  <button
                    onClick={handleDeleteRepos}
                    disabled={reposLoading || confirmText !== expectedConfirm}
                    style={{
                      ...dangerButtonStyle,
                      marginTop: 6,
                      opacity: confirmText !== expectedConfirm ? 0.4 : 1,
                    }}
                  >
                    Borrar {selectedRepos.size} repo(s) permanentemente
                  </button>
                </div>
              )}

              {reposStatus && (
                <p style={{ fontSize: 11, color: "var(--spk-text-dim)", marginTop: 6 }}>{reposStatus}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

const tabButtonStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text-dim)",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
};

const tabButtonActiveStyle: React.CSSProperties = {
  background: "var(--spk-active-bg)",
  color: "var(--spk-active-fg)",
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

const dangerButtonStyle: React.CSSProperties = {
  background: "rgba(255,143,163,0.12)",
  border: "1px solid rgba(255,143,163,0.4)",
  color: "#FF8FA3",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 12,
  width: "100%",
};
