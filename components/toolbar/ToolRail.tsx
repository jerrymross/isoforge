"use client";

import {
  Box,
  Hexagon,
  MousePointer2,
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
  { id: "line", label: "Rak linje", icon: PenLine, shortcut: "L" },
  { id: "polygon", label: "Polygon", icon: Hexagon, shortcut: "P" },
  { id: "iso-box", label: "Isometrisk box", icon: Box, shortcut: "B" },
];

export function ToolRail() {
  const { tool, setTool } = useEditorStore();
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
      <p className="tool-hint">Kortkommandon fungerar när du ritar.</p>
    </nav>
  );
}
