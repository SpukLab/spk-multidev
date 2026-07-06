"use client";

import { useState } from "react";
import { providers, getModelsForProvider } from "@/lib/providerModels";
import { defaultRoles } from "@/lib/roles";

export interface PanelMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  originLabel?: string; // ej: "Auditor (Claude)" cuando vino del otro panel
}

interface PanelProps {
  panelId: "left" | "right";
  title: string;
  messages: PanelMessage[];
  provider: string;
  model: string;
  roleId: string;
  busy: boolean;
  onChangeProvider: (providerId: string) => void;
  onChangeModel: (modelId: string) => void;
  onChangeRole: (roleId: string) => void;
  onSend: (text: string) => void;
  onSendToOther: (content: string, template: string) => void;
  onOpenInIntake: (content: string) => void;
}

export function Panel({
  panelId,
  title,
  messages,
  provider,
  model,
  roleId,
  busy,
  onChangeProvider,
  onChangeModel,
  onChangeRole,
  onSend,
  onSendToOther,
  onOpenInIntake,
}: PanelProps) {
  const [input, setInput] = useState("");
  const [template, setTemplate] = useState("");
  const [templateOpenFor, setTemplateOpenFor] = useState<string | null>(null);

  const models = getModelsForProvider(provider);

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
          borderBottom: "1px solid var(--spk-border)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
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

        <select value={model} onChange={(e) => onChangeModel(e.target.value)} style={selectStyle}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <select value={roleId} onChange={(e) => onChangeRole(e.target.value)} style={selectStyle}>
          {defaultRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

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
                background: m.role === "user" ? "var(--spk-button-bg)" : "rgba(255,255,255,0.03)",
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
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button
                  onClick={() => setTemplateOpenFor(templateOpenFor === m.id ? null : m.id)}
                  style={smallButtonStyle}
                >
                  Enviar al otro panel →
                </button>
                <button onClick={() => onOpenInIntake(m.content)} style={smallButtonStyle}>
                  Abrir en Code Intake
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
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 6, padding: 10, borderTop: "1px solid var(--spk-border)" }}>
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
