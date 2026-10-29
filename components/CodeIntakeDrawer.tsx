"use client";

import { useEffect, useState } from "react";
import type { CompletionStatus, IntakeOrigin } from "@/lib/codeIntake/proof";
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
  modelProof?: string | null;
  sourceCompletion?: CompletionStatus;
  sourceOrigin: IntakeOrigin;
  onManualImport: (text: string) => void;
  owner: string;
  repo: string;
  branch: string;
  onChangeOwner: (v: string) => void;
  onChangeRepo: (v: string) => void;
  onChangeBranch: (v: string) => void;
  githubToken?: string;
  knownFilePaths?: string[];
  projectId?: string | null;
}

export function CodeIntakeDrawer({
  rawText,
  modelProof,
  sourceCompletion = "unknown",
  sourceOrigin,
  onManualImport,
  owner,
  repo,
  branch,
  onChangeOwner,
  onChangeRepo,
  onChangeBranch,
  githubToken,
  knownFilePaths,
  projectId,
}: CodeIntakeDrawerProps) {
  const [resolved, setResolved] = useState<ResolvedFile[] | null>(null);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [acknowledgeUnknown, setAcknowledgeUnknown] = useState(false);
  const [manualDraft, setManualDraft] = useState("");
  const [resolutionProof, setResolutionProof] = useState<string | null>(null);
  const [expectedHeadSha, setExpectedHeadSha] = useState<string | null>(null);
  const [resolvedBranch, setResolvedBranch] = useState<string | null>(null);

  // Los resultados solo corresponden a ese contenido y ese repositorio/branch.
  useEffect(() => {
    setResolved(null);
    setResolutionProof(null);
    setExpectedHeadSha(null);
    setResolvedBranch(null);
    setAcknowledgeUnknown(false);
    setStatus(null);
  }, [rawText, modelProof, owner, repo, branch]);

  async function handleResolve() {
    if (sourceOrigin === "generated" && !modelProof) {
      setStatus("No existe una prueba de finalización para este mensaje. Usá la importación manual para archivos revisados por vos.");
      return;
    }
    if (sourceCompletion === "truncated") {
      setStatus("Respuesta truncada: pedí continuación. No se puede aplicar.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/codeintake/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, owner, repo, branch, githubToken, knownFilePaths, projectId, modelProof, acknowledgeUnknown, origin: sourceOrigin }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
      } else {
        setResolved(data.resolved);
        setResolutionProof(data.resolutionProof ?? null);
        setExpectedHeadSha(data.expectedHeadSha ?? null);
        setResolvedBranch(data.resolvedBranch ?? null);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!resolved || !resolutionProof || !expectedHeadSha || !resolvedBranch) {
      setStatus("Primero resolvé el diff contra GitHub.");
      return;
    }
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
          branch: resolvedBranch,
          expectedHeadSha,
          resolutionProof,
          message: commitMessage || "Code Intake: cambios aplicados desde SPK_MultiDev",
          files: validFiles.map((f) => ({ path: f.path, content: f.newContent })),
          githubToken,
          projectId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus(`Error al commitear: ${data.error}`);
      } else {
        setStatus(`Commit exitoso: ${data.commitSha.slice(0, 7)} — push a "${resolvedBranch}" disparado.`);
        setResolved(null);
        setResolutionProof(null);
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

      <details style={{ marginTop: 10, marginBottom: 10, color: "var(--spk-text-dim)", fontSize: 11 }}>
        <summary>Importar código revisado manualmente</summary>
        <textarea
          value={manualDraft}
          onChange={(e) => setManualDraft(e.target.value)}
          placeholder="Pegá los bloques FILE: de un archivo que hayas revisado."
          rows={5}
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginTop: 8 }}
        />
        <button type="button" style={primaryButtonStyle} disabled={!manualDraft.trim()} onClick={() => onManualImport(manualDraft)}>
          Usar este texto como importación manual
        </button>
        <p>El reconocimiento humano no demuestra completitud ni convierte un fragmento truncado en código seguro.</p>
      </details>

      {!rawText && (
        <p style={{ color: "var(--spk-text-dim)", fontSize: 12 }}>
          Elegí "Abrir en Code Intake" en algún mensaje de un panel para parsearlo acá.
        </p>
      )}

      {rawText && (
        <>
          <p style={{ color: sourceCompletion === "truncated" ? "#fca5a5" : "#aaa", fontSize: 11, lineHeight: 1.5 }}>
            {sourceOrigin === "manual"
              ? "Importación manual: el archivo es responsabilidad del operador. Revisá contenido, origen y alcance antes de confirmar."
              : !modelProof
                ? "Mensaje generado sin evidencia autenticada de finalización (incluye mensajes históricos). Bloqueado: no se presume íntegro."
                : sourceCompletion === "truncated"
                  ? "La IA terminó por límite de tokens: Code Intake bloqueado."
                  : sourceCompletion === "complete"
                    ? "Fin normal declarado por API y firmado en servidor. No demuestra corrección funcional del código."
                    : "La API no confirmó la finalización del modelo. Revisión humana obligatoria."}
          </p>
          {(sourceOrigin === "manual" || (modelProof && sourceCompletion === "unknown")) && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 11, marginBottom: 9 }}>
              <input type="checkbox" checked={acknowledgeUnknown} onChange={(e) => setAcknowledgeUnknown(e.target.checked)} />
              Confirmo que revisé manualmente el contenido y su posible falta de completitud.
            </label>
          )}
          <button onClick={handleResolve}
            disabled={loading || sourceCompletion === "truncated" || (sourceOrigin === "generated" && !modelProof) || ((sourceOrigin === "manual" || sourceCompletion === "unknown") && !acknowledgeUnknown)}
            style={primaryButtonStyle}>
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
                disabled={loading || !resolutionProof || !expectedHeadSha}
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
