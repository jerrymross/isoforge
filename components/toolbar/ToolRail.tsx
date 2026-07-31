"use client";

import {
  Box,
  CheckCheck,
  Hexagon,
  Link2,
  Link2Off,
  MousePointer2,
  PenTool,
  PenLine,
  Scaling,
  Waypoints,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import type { Tool } from "@/types/editor";

const tools: Array<{
  id: Tool;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  shortcut: string;
}> = [
  { id: "select", label: "Markering", icon: MousePointer2, shortcut: "V" },
  { id: "scale", label: "Skalning", icon: Scaling, shortcut: "S" },
  { id: "node", label: "Nodverktyg", icon: Waypoints, shortcut: "N" },
  { id: "pen", label: "Ritstift", icon: PenTool, shortcut: "P" },
  { id: "line", label: "Rak linje", icon: PenLine, shortcut: "L" },
  { id: "polygon", label: "Polygon", icon: Hexagon, shortcut: "G" },
  { id: "iso-box", label: "Isometrisk box", icon: Box, shortcut: "B" },
];

export function ToolRail() {
  const {
    tool,
    proportionalNodes,
    setTool,
    setProportionalNodes,
    selectAllObjects,
  } = useEditorStore();
  return (
    <nav className="tool-rail" aria-label="Ritverktyg">
      <div className="tool-group-label">VERKTYG</div>
      {tools.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={tool === item.id ? "tool-button active" : "tool-button"}
            onClick={() => setTool(item.id)}
            title={`${item.label} (${item.shortcut})`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{item.label}</span>
            <kbd>{item.shortcut}</kbd>
          </button>
        );
      })}
      {tool === "node" && (
        <button
          className={proportionalNodes ? "node-option active" : "node-option"}
          aria-pressed={proportionalNodes}
          onClick={() => setProportionalNodes(!proportionalNodes)}
          title="Växla mellan proportionell och fri punktredigering"
        >
          {proportionalNodes ? <Link2 size={14} /> : <Link2Off size={14} />}
          <span>Behåll proportioner</span>
          <b>{proportionalNodes ? "På" : "Av"}</b>
        </button>
      )}
      {tool === "select" && (
        <button
          className="node-option"
          onClick={selectAllObjects}
          title="Markera alla olåsta objekt på synliga lager"
        >
          <CheckCheck size={14} />
          <span>Markera allt</span>
          <b>Ctrl+A</b>
        </button>
      )}
      <p className="tool-hint">Kortkommandon fungerar när du ritar.</p>
    </nav>
  );
}
