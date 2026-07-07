"use client";

import { useState } from "react";

interface SessionWithPreview {
  id: string;
  updated_at: string;
  preview: string | null;
}

interface ChatsDrawerProps {
  open: boolean;
  onClose: () => void;
  sessions: SessionWithPreview[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
}

function groupLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && date.getDate() === now.getDate()) return "Hoy";
  if (diffDays <= 1) return "Ayer";
  if (diffDays <= 30) return "Este mes";
  return "Más viejo";
}

export function ChatsDrawer({
  open,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
}: ChatsDrawerProps) {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const filtered = search.trim()
    ? sessions.filter((s) => (s.preview ?? "").toLowerCase().includes(search.toLowerCase()))
    : sessions;

  const groups: Record<string, SessionWithPreview[]> = {};
  for (const s of filtered) {
    const label = groupLabel(s.updated_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(s);
  }
  const groupOrder = ["Hoy", "Ayer", "Este mes", "Más viejo"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-start",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(360px, 92vw)",
          height: "100%",
          background: "linear-gradient(155deg,#13111f,#1b1726)",
          borderRight: "1px solid var(--spk-border)",
          padding: 14,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3
            style={{
              fontFamily: "var(--font-mono)",
              fontStyle: "italic",
              fontSize: 13,
              color: "var(--spk-active-fg)",
              margin: 0,
            }}
          >
            Chats
          </h3>
          <button onClick={onClose} style={iconButtonStyle}>
            ✕
          </button>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          style={{ ...inputStyle, width: "100%", marginTop: 10 }}
        />

        <button
          onClick={onNewSession}
          style={{ ...primaryButtonStyle, width: "100%", marginTop: 8 }}
        >
          + Nuevo chat
        </button>

        {groupOrder.map(
          (label) =>
            groups[label] && (
              <div key={label} style={{ marginTop: 14 }}>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--spk-text-dim)",
                    textAlign: "center",
                    borderBottom: "1px solid var(--spk-border)",
                    paddingBottom: 4,
                  }}
                >
                  {label}
                </p>
                {groups[label].map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <button
                      onClick={() => {
                        onSelectSession(s.id);
                        onClose();
                      }}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        background:
                          currentSessionId === s.id ? "var(--spk-active-bg)" : "var(--spk-button-bg)",
                        color: currentSessionId === s.id ? "var(--spk-active-fg)" : "var(--spk-text)",
                        border: "1px solid var(--spk-border)",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 12,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.preview ? s.preview.slice(0, 40) : "Chat sin mensajes"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("¿Borrar este chat? No se puede deshacer.")) {
                          onDeleteSession(s.id);
                        }
                      }}
                      style={iconButtonStyle}
                      aria-label="Borrar chat"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )
        )}

        {filtered.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--spk-text-dim)", marginTop: 20 }}>
            No hay chats {search ? "que coincidan." : "guardados todavía para este proyecto."}
          </p>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text)",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  background: "var(--spk-active-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-active-fg)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 12,
};

const iconButtonStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text-dim)",
  borderRadius: 6,
  padding: "6px 8px",
  fontSize: 12,
};
