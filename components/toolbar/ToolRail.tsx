"use client";

import {
  Box,
  ChevronRight,
  Circle,
  Hexagon,
  MousePointer2,
  PaintBucket,
  PenLine,
  Pipette,
  ScanLine,
  Scaling,
  Spline,
  Square,
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
      <div className="tool-group-label">RITA</div>
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
      <div className="tool-divider" />
      <div className="tool-group-label">FORMER</div>
      {[
        { label: "Rektangel", icon: Square },
        { label: "Ellips", icon: Circle },
        { label: "Bézier", icon: Spline },
        { label: "Frihand", icon: ScanLine },
      ].map(({ label, icon: Icon }) => (
        <button key={label} className="tool-button muted" title={`${label} – kommer i nästa steg`}>
          <Icon size={18} strokeWidth={1.8} />
          <span>{label}</span>
          <ChevronRight size={13} />
        </button>
      ))}
      <div className="tool-divider" />
      <button className="tool-button muted">
        <PaintBucket size={18} />
        <span>Fyllning</span>
      </button>
      <button className="tool-button muted">
        <Pipette size={18} />
        <span>Färgväljare</span>
      </button>
    </nav>
  );
}
