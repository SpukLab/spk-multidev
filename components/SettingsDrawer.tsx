"use client";

import { useState } from "react";
import { StoredApiKeys, CustomRole } from "@/lib/clientStorage";
import { CleanupPanel } from "./CleanupPanel";
import { OpenHandsPanel } from "./OpenHandsPanel";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  apiKeys: StoredApiKeys;
  onSaveApiKeys: (keys: StoredApiKeys) => void;
  customRoles: CustomRole[];
  onSaveCustomRoles: (roles: CustomRole[]) => void;
  owner: string;
  repo: string;
  branch: string;
  projectId: string | null;
}

export function SettingsDrawer({
  open,
  onClose,
  apiKeys,
  onSaveApiKeys,
  customRoles,
  onSaveCustomRoles,
  owner,
  repo,
  branch,
  projectId,
}: SettingsDrawerProps) {
  const [tab, setTab] = useState<"keys" | "roles" | "cleanup" | "openhands">("keys");
  const [localKeys, setLocalKeys] = useState<StoredApiKeys>(apiKeys);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRolePrompt, setNewRolePrompt] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!open) return null;

  function handleSaveKeys() {
    onSaveApiKeys(localKeys);
  }

  function handleAddOrUpdateRole() {
    if (!newRoleLabel.trim() || !newRolePrompt.trim()) return;
    if (editingId) {
      onSaveCustomRoles(
        customRoles.map((r) =>
          r.id === editingId ? { ...r, label: newRoleLabel, systemPrompt: newRolePrompt } : r
        )
      );
    } else {
      const newRole: CustomRole = {
        id: `custom-${Date.now()}`,
        label: newRoleLabel,
        systemPrompt: newRolePrompt,
      };
      onSaveCustomRoles([...customRoles, newRole]);
    }
    setNewRoleLabel("");
    setNewRolePrompt("");
    setEditingId(null);
  }

  function handleEditRole(role: CustomRole) {
    setEditingId(role.id);
    setNewRoleLabel(role.label);
    setNewRolePrompt(role.systemPrompt);
  }

  function handleDeleteRole(id: string) {
    onSaveCustomRoles(customRoles.filter((r) => r.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setNewRoleLabel("");
      setNewRolePrompt("");
    }
  }

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
          width: "min(400px, 92vw)",
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
            Configuración
          </h3>
          <button onClick={onClose} style={iconButtonStyle}>
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <button
            onClick={() => setTab("keys")}
            style={{ ...tabButtonStyle, ...(tab === "keys" ? tabButtonActiveStyle : {}) }}
          >
            Mis API keys
          </button>
          <button
            onClick={() => setTab("roles")}
            style={{ ...tabButtonStyle, ...(tab === "roles" ? tabButtonActiveStyle : {}) }}
          >
            Roles
          </button>
          <button
            onClick={() => setTab("cleanup")}
            style={{ ...tabButtonStyle, ...(tab === "cleanup" ? tabButtonActiveStyle : {}) }}
          >
            Limpieza
          </button>
          <button
            onClick={() => setTab("openhands")}
            style={{ ...tabButtonStyle, ...(tab === "openhands" ? tabButtonActiveStyle : {}) }}
          >
            OpenHands
          </button>
        </div>

        {tab === "keys" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>
              Estas keys se guardan solo en este navegador (nunca en el servidor). Si dejás un
              campo vacío, se usa la key compartida del servidor — útil si distribuís esta app a
              otras personas y cada una quiere usar la suya sin tocar tus keys.
            </p>

            <label style={labelStyle}>NVIDIA NIM</label>
            <input
              type="password"
              value={localKeys.nvidia ?? ""}
              onChange={(e) => setLocalKeys({ ...localKeys, nvidia: e.target.value })}
              placeholder="Key personal (opcional)"
              style={inputStyle}
            />

            <label style={labelStyle}>Anthropic (Claude)</label>
            <input
              type="password"
              value={localKeys.anthropic ?? ""}
              onChange={(e) => setLocalKeys({ ...localKeys, anthropic: e.target.value })}
              placeholder="Key personal (opcional)"
              style={inputStyle}
            />

            <label style={labelStyle}>OpenAI (ChatGPT)</label>
            <input
              type="password"
              value={localKeys.openai ?? ""}
              onChange={(e) => setLocalKeys({ ...localKeys, openai: e.target.value })}
              placeholder="Key personal (opcional)"
              style={inputStyle}
            />

            <label style={labelStyle}>GitHub (token personal)</label>
            <input
              type="password"
              value={localKeys.github ?? ""}
              onChange={(e) => setLocalKeys({ ...localKeys, github: e.target.value })}
              placeholder="Token personal (opcional, requiere scope repo)"
              style={inputStyle}
            />

            <button onClick={handleSaveKeys} style={{ ...primaryButtonStyle, marginTop: 10 }}>
              Guardar keys
            </button>
          </div>
        )}

        {tab === "roles" && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 11, color: "var(--spk-text-dim)" }}>
              Los roles fijos (Arquitecto/Auditor/Implementador) no se pueden editar. Acá podés
              crear los tuyos — se guardan en este navegador.
            </p>

            {customRoles.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid var(--spk-border)",
                  borderRadius: 8,
                  padding: 8,
                  marginTop: 6,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 12 }}>{r.label}</strong>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleEditRole(r)} style={iconButtonStyle}>
                      ✎
                    </button>
                    <button onClick={() => handleDeleteRole(r.id)} style={iconButtonStyle}>
                      🗑
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 11, color: "var(--spk-text-dim)", margin: "4px 0 0" }}>
                  {r.systemPrompt.slice(0, 80)}
                  {r.systemPrompt.length > 80 ? "..." : ""}
                </p>
              </div>
            ))}

            <div style={{ marginTop: 10 }}>
              <label style={labelStyle}>{editingId ? "Editar rol" : "Nuevo rol"}</label>
              <input
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="Nombre del rol (ej: Traductor)"
                style={inputStyle}
              />
              <textarea
                value={newRolePrompt}
                onChange={(e) => setNewRolePrompt(e.target.value)}
                placeholder="System prompt de este rol..."
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <button onClick={handleAddOrUpdateRole} style={{ ...primaryButtonStyle, marginTop: 6 }}>
                {editingId ? "Guardar cambios" : "+ Agregar rol"}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null);
                    setNewRoleLabel("");
                    setNewRolePrompt("");
                  }}
                  style={{ ...tabButtonStyle, marginTop: 6, width: "100%" }}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </div>
        )}

        {tab === "cleanup" && (
          <div style={{ marginTop: 12 }}>
            <CleanupPanel owner={owner} repo={repo} branch={branch} githubToken={apiKeys.github} projectId={projectId} />
          </div>
        )}

        {tab === "openhands" && (
          <div style={{ marginTop: 12 }}>
            <OpenHandsPanel projectId={projectId} owner={owner} repo={repo} branch={branch} />
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  color: "var(--spk-text-dim)",
  marginTop: 8,
  marginBottom: 3,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
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
  width: "100%",
};

const tabButtonStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text-dim)",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 11,
  flex: 1,
};

const tabButtonActiveStyle: React.CSSProperties = {
  background: "var(--spk-active-bg)",
  color: "var(--spk-active-fg)",
};

const iconButtonStyle: React.CSSProperties = {
  background: "var(--spk-button-bg)",
  border: "1px solid var(--spk-border)",
  color: "var(--spk-text-dim)",
  borderRadius: 6,
  padding: "4px 7px",
  fontSize: 11,
};
