"use client";

import { diffLines } from "@/lib/diff/lineDiff";

export function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const lines = diffLines(oldText, newText);

  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        background: "rgba(0,0,0,0.3)",
        borderRadius: 8,
        padding: 8,
        maxHeight: 260,
        overflowY: "auto",
      }}
    >
      {lines.map((line, idx) => (
        <div
          key={idx}
          style={{
            color:
              line.type === "add" ? "#7CFFB2" : line.type === "remove" ? "#FF8FA3" : "var(--spk-text-dim)",
            background:
              line.type === "add"
                ? "rgba(124,255,178,0.08)"
                : line.type === "remove"
                ? "rgba(255,143,163,0.08)"
                : "transparent",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
          {line.text}
        </div>
      ))}
    </div>
  );
}
