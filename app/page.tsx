"use client";

import { useState } from "react";
import { Panel, PanelMessage } from "@/components/Panel";
import { LoopConnector } from "@/components/LoopConnector";
import { CodeIntakeDrawer } from "@/components/CodeIntakeDrawer";
import { defaultRoles, CODE_INTAKE_INSTRUCTION } from "@/lib/roles";
import { getModelsForProvider } from "@/lib/providerModels";

interface PanelState {
  provider: string;
  model: string;
  roleId: string;
  messages: PanelMessage[];
  busy: boolean;
}

function initialPanelState(provider: string, model: string): PanelState {
  return { provider, model, roleId: "none", messages: [], busy: false };
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg-${idCounter}`;
}

export default function HomePage() {
  const [left, setLeft] = useState<PanelState>(initialPanelState("anthropic", "claude-sonnet-5"));
  const [right, setRight] = useState<PanelState>(
    initialPanelState("nvidia", "nvidia/llama-3.3-nemotron-super-49b-v1")
  );

  const [intakeRawText, setIntakeRawText] = useState("");
  const [owner, setOwner] = useState("SpukLab");
  const [repo, setRepo] = useState("");
  const [branch, setBranch] = useState("main");

  async function sendMessage(panel: "left" | "right", text: string) {
    const state = panel === "left" ? left : right;
    const setState = panel === "left" ? setLeft : setRight;

    const userMsg: PanelMessage = { id: nextId(), role: "user", content: text };
    setState({ ...state, messages: [...state.messages, userMsg], busy: true });

    const roleDef = defaultRoles.find((r) => r.id === state.roleId);
    const systemContent = [roleDef?.systemPrompt, CODE_INTAKE_INSTRUCTION]
      .filter(Boolean)
      .join("\n\n");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: state.provider,
          model: state.model,
          messages: [
            ...(systemContent ? [{ role: "system", content: systemContent }] : []),
            ...state.messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: text },
          ],
        }),
      });
      const data = await res.json();

      const assistantMsg: PanelMessage = {
        id: nextId(),
        role: "assistant",
        content: data.error ? `Error: ${data.error}` : data.content,
        originLabel:
          roleDef && roleDef.id !== "none"
            ? `${roleDef.label} (${state.provider})`
            : undefined,
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMsg],
        busy: false,
      }));
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

  function sendToOther(fromPanel: "left" | "right", content: string, template: string) {
    const toPanel = fromPanel === "left" ? "right" : "left";
    const finalText = template.trim() ? template.replace("[mensaje]", content) : content;
    sendMessage(toPanel, finalText);
  }

  return (
    <main style={{ padding: "16px", maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: 14 }}>
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
      </header>

      <div className="workspace" style={{ marginBottom: 14 }}>
        <Panel
          panelId="left"
          title="Panel A"
          messages={left.messages}
          provider={left.provider}
          model={left.model}
          roleId={left.roleId}
          busy={left.busy}
          onChangeProvider={(p) =>
            setLeft((s) => ({ ...s, provider: p, model: getModelsForProvider(p)[0]?.id ?? "" }))
          }
          onChangeModel={(m) => setLeft((s) => ({ ...s, model: m }))}
          onChangeRole={(r) => setLeft((s) => ({ ...s, roleId: r }))}
          onSend={(text) => sendMessage("left", text)}
          onSendToOther={(content, template) => sendToOther("left", content, template)}
          onOpenInIntake={(content) => setIntakeRawText(content)}
        />

        <LoopConnector />

        <Panel
          panelId="right"
          title="Panel B"
          messages={right.messages}
          provider={right.provider}
          model={right.model}
          roleId={right.roleId}
          busy={right.busy}
          onChangeProvider={(p) =>
            setRight((s) => ({ ...s, provider: p, model: getModelsForProvider(p)[0]?.id ?? "" }))
          }
          onChangeModel={(m) => setRight((s) => ({ ...s, model: m }))}
          onChangeRole={(r) => setRight((s) => ({ ...s, roleId: r }))}
          onSend={(text) => sendMessage("right", text)}
          onSendToOther={(content, template) => sendToOther("right", content, template)}
          onOpenInIntake={(content) => setIntakeRawText(content)}
        />
      </div>

      <CodeIntakeDrawer
        rawText={intakeRawText}
        owner={owner}
        repo={repo}
        branch={branch}
        onChangeOwner={setOwner}
        onChangeRepo={setRepo}
        onChangeBranch={setBranch}
      />
    </main>
  );
}
