"use client";

import { useState } from "react";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const path of paths) {
    const parts = path.split("/");
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, idx) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = idx === parts.length - 1;
      let node = currentLevel.find((n) => n.name === part && n.type === (isFile ? "file" : "folder"));
      if (!node) {
        node = { name: part, path: currentPath, type: isFile ? "file" : "folder", children: [] };
        currentLevel.push(node);
      }
      currentLevel = node.children;
    });
  }

  function sortRec(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortRec(n.children));
  }
  sortRec(root);
  return root;
}

function getAllFilePaths(node: TreeNode): string[] {
  if (node.type === "file") return [node.path];
  return node.children.flatMap(getAllFilePaths);
}

interface FileTreeProps {
  paths: string[];
  selected: Set<string>;
  onChangeSelected: (next: Set<string>) => void;
}

export function FileTree({ paths, selected, onChangeSelected }: FileTreeProps) {
  const tree = buildTree(paths);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(path: string) {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
  }

  function toggleFile(path: string) {
    const next = new Set(selected);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    onChangeSelected(next);
  }

  function toggleFolder(node: TreeNode) {
    const filePaths = getAllFilePaths(node);
    const allSelected = filePaths.every((p) => selected.has(p));
    const next = new Set(selected);
    filePaths.forEach((p) => (allSelected ? next.delete(p) : next.add(p)));
    onChangeSelected(next);
  }

  function renderNode(node: TreeNode, depth: number) {
    if (node.type === "file") {
      return (
        <label
          key={node.path}
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            padding: "3px 0",
            paddingLeft: depth * 14 + 18,
          }}
        >
          <input type="checkbox" checked={selected.has(node.path)} onChange={() => toggleFile(node.path)} />
          {node.name}
        </label>
      );
    }

    const filePaths = getAllFilePaths(node);
    const allSelected = filePaths.length > 0 && filePaths.every((p) => selected.has(p));
    const isExpanded = expanded.has(node.path);

    return (
      <div key={node.path}>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            padding: "3px 0",
            paddingLeft: depth * 14,
          }}
        >
          <button
            onClick={() => toggleExpand(node.path)}
            style={{ background: "none", border: "none", color: "var(--spk-text-dim)", padding: 0 }}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
          <input type="checkbox" checked={allSelected} onChange={() => toggleFolder(node)} />
          <span style={{ color: "var(--spk-active-fg)" }}>{node.name}/</span>
        </div>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return <div>{tree.map((node) => renderNode(node, 0))}</div>;
}
