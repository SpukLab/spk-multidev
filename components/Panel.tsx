"use client";

import { useEffect, useState } from "react";
import { providers, getModelsForProvider } from "@/lib/providerModels";
import { StoredApiKeys } from "@/lib/clientStorage";

export interface RoleOption {
  id: string;
  label: string;
  systemPrompt: string;
}

export interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originLabel?: string;
  /** id real en Supabase (messages.id) — se completa después de persistir,
   * usado como source_message_id al capturar Knowledge (Sprint 3). */
  dbId?: string;
}

interface ModelOption {
  id: string;
  label?: string;
}

interface PanelProps {
  panelId: "left" | "right";
  title: string;
  messages: PanelMessage[];
  provider: string;
  model: string;
  roleId: string;
  busy: boolean;
  collapsed: boolean;
  roles: RoleOption[];
  apiKeys: StoredApiKeys;
  sequentialThinking: boolean;
  onToggleSequentialThinking: () => void;
  onToggleCollapse: () => void;
  onChangeProvider: (providerId: string) => void;
  onChangeModel: (modelId: string) => void;
  onChangeRole: (roleId: string) => void;
  onSend: (text: string) => void;
  onSendToOther: (content: string, template: string) => void;
  onOpenInIntake: (content: string) => void;
  onCaptureKnowledge?: (params: { content: string; sourceMessageId?: string; type: string; title: string }) => void;
}

export function Panel({
  title,
  messages,
  provider,
  model,
  roleId,
  busy,
  collapsed,
  roles,
  apiKeys,
  sequentialThinking,
  onToggleSequentialThinking,
  onToggleCollapse,
  onChangeProvider,
  onChangeModel,
  onChangeRole,
  onSend,
  onSendToOther,
  onOpenInIntake,
  onCaptureKnowledge,
}: PanelProps) {
  const [input, setInput] = useState("");
  const [template, setTemplate] = useState("");
  const [templateOpenFor, setTemplateOpenFor] = useState<string | null>(null);
  const [knowledgeCaptureFor, setKnowledgeCaptureFor] = useState<string | null>(null);
  const [captureType, setCaptureType] = useState("observation");
  const [captureTitle, setCaptureTitle] = useState("");

  const [modelOptions, setModelOptions] = useState<ModelOption[]>(getModelsForProvider(provider));
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelFilter, setModelFilter] = useState("");
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);

  // Trae el catálogo real de modelos de la cuenta (ej: 121 modelos de NIM)
  // en vez de la lista hardcodeada de fallback.
  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);
    setCatalogWarning(null);

    fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: apiKeys[provider as keyof StoredApiKeys] }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setModelOptions(data.models ?? getModelsForProvider(provider));
        if (data.warning) setCatalogWarning(data.warning);
        // Si el modelo actual no está en el catálogo nuevo, auto-seleccionar
        // el que matchee el keyword preferido del proveedor (ej: "nemotron",
        // "gpt-4o"), o si no hay match, el primero de la lista.
        const list: ModelOption[] = data.models ?? [];
        if (list.length > 0 && !list.some((m) => m.id === model)) {
          const preferredKeyword = providers.find((p) => p.id === provider)?.preferredKeyword;
          const preferred = preferredKeyword
            ? list.find((m) => m.id.toLowerCase().includes(preferredKeyword.toLowerCase()))
            : undefined;
          onChangeModel((preferred ?? list[0]).id);
        }
      })
      .catch(() => {
        if (!cancelled) setModelOptions(getModelsForProvider(provider));
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const filteredModels =
    modelFilter.trim().length > 0
      ? modelOptions.filter((m) =>
          (m.label ?? m.id).toLowerCase().includes(modelFilter.toLowerCase())
        )
      : modelOptions;

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(155deg,#13111f,#1b1726)",
        border: "1px solid var(--spk-border)",
        borderRadius: 14,
        boxShadow: "0 0 24px var(--spk-glow)",
        overflow: "hidden",
      }}
    >
      {/* Barra superior: proveedor / modelo / rol */}
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 12px",
          borderBottom: collapsed ? "none" : "1px solid var(--spk-border)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          onClick={onToggleCollapse}
          style={{ ...smallButtonStyle, padding: "3px 7px" }}
          aria-label={collapsed ? "Desplegar panel" : "Colapsar panel"}
        >
          {collapsed ? "▸" : "▾"}
        </button>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontStyle: "italic",
            fontSize: 11,
            color: "var(--spk-text-dim)",
            marginRight: 4,
          }}
        >
          {title}
        </span>

        <select
          value={provider}
          onChange={(e) => onChangeProvider(e.target.value)}
          style={selectStyle}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        {modelOptions.length > 12 && (
          <input
            value={modelFilter}
            onChange={(e) => setModelFilter(e.target.value)}
            placeholder={`Filtrar (${modelOptions.length})`}
            style={{ ...selectStyle, width: 110 }}
          />
        )}

        <select
          value={model}
          onChange={(e) => onChangeModel(e.target.value)}
          style={selectStyle}
          disabled={modelsLoading}
        >
          {modelsLoading && <option>Cargando...</option>}
          {!modelsLoading &&
            filteredModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label ?? m.id}
              </option>
            ))}
        </select>

        <select value={roleId} onChange={(e) => onChangeRole(e.target.value)} style={selectStyle}>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--spk-text-dim)" }}>
          <input
            type="checkbox"
            checked={sequentialThinking}
            onChange={onToggleSequentialThinking}
          />
          Pensamiento secuencial
        </label>
      </div>

      {collapsed && catalogWarning && (
        <p style={{ fontSize: 10, color: "var(--spk-text-dim)", padding: "0 12px 8px" }}>
          Catálogo: usando fallback ({catalogWarning})
        </p>
      )}

      {!collapsed && (
        <>
          {catalogWarning && (
            <p style={{ fontSize: 10, color: "var(--spk-text-dim)", padding: "6px 12px 0" }}>
              No se pudo traer el catálogo real, usando fallback: {catalogWarning}
            </p>
          )}

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", minHeight: 220 }}>
            {messages.length === 0 && (
              <p style={{ color: "var(--spk-text-dim)", fontSize: 12 }}>
                Sin mensajes todavía en este panel.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 14 }}>
                {m.originLabel && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontStyle: "italic",
                      fontSize: 11,
                      color: "var(--spk-active-fg)",
                      marginBottom: 3,
                    }}
                  >
                    ← {m.originLabel}
                  </div>
                )}
                <div
                  style={{
                    background:
                      m.role === "user" ? "var(--spk-button-bg)" : "rgba(255,255,255,0.03)",
                    border: "1px solid var(--spk-border)",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: 13,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {m.content}
                </div>
                {m.role === "assistant" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      onClick={() => setTemplateOpenFor(templateOpenFor === m.id ? null : m.id)}
                      style={smallButtonStyle}
                    >
                      Enviar al otro panel →
                    </button>
                    {(() => {
                      // Chequeo liviano (sin correr el parser completo) para
                      // saber si este mensaje trae bloques FILE: aplicables
                      // vía Code Intake — independiente de qué proveedor lo
                      // haya generado (sección "Multi-Agent Execution MVP").
                      const hasApplicableCode = /^FILE:\s*.+$/m.test(m.content);
                      return (
                        <button
                          onClick={() => onOpenInIntake(m.content)}
                          style={
                            hasApplicableCode
                              ? { ...smallButtonStyle, background: "var(--spk-active-bg)", fontWeight: 600 }
                              : smallButtonStyle
                          }
                        >
                          {hasApplicableCode ? "📦 Código listo — abrir en Code Intake" : "Abrir en Code Intake"}
                        </button>
                      );
                    })()}
                    {onCaptureKnowledge && (
                      <button
                        onClick={() => {
                          setKnowledgeCaptureFor(knowledgeCaptureFor === m.id ? null : m.id);
                          setCaptureTitle(m.content.slice(0, 60));
                        }}
                        style={smallButtonStyle}
                      >
                        💡 Capturar como Knowledge
                      </button>
                    )}
                  </div>
                )}
                {knowledgeCaptureFor === m.id && onCaptureKnowledge && (
                  <div style={{ marginTop: 6, padding: 8, background: "rgba(167,139,250,0.08)", borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <select
                      value={captureType}
                      onChange={(e) => setCaptureType(e.target.value)}
                      style={{ padding: 6, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 12 }}
                    >
                      <option value="observation">Observación</option>
                      <option value="insight">Insight</option>
                      <option value="decision">Decisión</option>
                      <option value="hypothesis">Hipótesis</option>
                      <option value="experiment">Experimento</option>
                      <option value="pattern">Patrón</option>
                      <option value="adr_candidate">Candidato a ADR</option>
                      <option value="rejected_idea">Idea descartada</option>
                      <option value="open_question">Pregunta abierta</option>
                      <option value="implementation_note">Nota de implementación</option>
                      <option value="temporary_note">Nota temporal</option>
                    </select>
                    <input
                      value={captureTitle}
                      onChange={(e) => setCaptureTitle(e.target.value)}
                      placeholder="Título (opcional)"
                      style={{ padding: 6, background: "#1a1a22", border: "1px solid #333", borderRadius: 6, color: "#fff", fontSize: 12 }}
                    />
                    <button
                      onClick={() => {
                        onCaptureKnowledge({
                          content: m.content,
                          sourceMessageId: m.dbId,
                          type: captureType,
                          title: captureTitle || m.content.slice(0, 60),
                        });
                        setKnowledgeCaptureFor(null);
                      }}
                      style={{ padding: 6, background: "#7c3aed", border: "none", borderRadius: 6, color: "#fff", fontSize: 12 }}
                    >
                      Guardar
                    </button>
                  </div>
                )}
                {templateOpenFor === m.id && (
                  <div style={{ marginTop: 6 }}>
                    <input
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      placeholder="Template opcional, ej: Revisá esto y decime si tiene bugs: [mensaje]"
                      style={{ ...selectStyle, width: "100%" }}
                    />
                    <button
                      onClick={() => {
                        onSendToOther(m.content, template);
                        setTemplateOpenFor(null);
                        setTemplate("");
                      }}
                      style={{ ...smallButtonStyle, marginTop: 4 }}
                    >
                      Confirmar envío
                    </button>
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontStyle: "italic",
                  fontSize: 11,
                  color: "var(--spk-active-fg)",
                }}
              >
                Pensando...
              </p>
            )}
          </div>

          {/* Input */}
          <div
            style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--spk-border)" }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí un mensaje..."
              rows={2}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--spk-border)",
                borderRadius: 8,
                color: "var(--spk-text)",
                padding: 8,
                resize: "none",
              }}
            />
            <button
              disabled={busy || !input.trim()}
              onClick={() => {
                onSend(input);
                setInput("");
              }}
              style={{
                ...smallButtonStyle,
                opacity: busy || !input.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "..." : "Enviar"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

const selectStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text)",
  borderRadius: 6,
  padding: "4px 6px",
  fontSize: 11,
};

const smallButtonStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-active-fg)",
  borderRadius: 6,
  padding: "5px 8px",
  fontSize: 11,
};
