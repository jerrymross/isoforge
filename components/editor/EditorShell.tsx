"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  History,
  Redo2,
  Save,
  Settings2,
  Undo2,
} from "lucide-react";
import { EditorCanvas } from "./EditorCanvas";
import { Inspector } from "./Inspector";
import { ExportDialog } from "@/components/export/ExportDialog";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { LivePreview } from "@/components/preview/LivePreview";
import { TileLibrary } from "@/components/tiles/TileLibrary";
import { ToolRail } from "@/components/toolbar/ToolRail";
import { loadProject } from "@/lib/project-db";
import { useEditorStore } from "@/stores/editor-store";
import type { Tool } from "@/types/editor";

const toolKeys: Record<string, Tool> = {
  v: "select",
  n: "node",
  l: "line",
  p: "polygon",
  b: "iso-box",
};

export function EditorShell() {
  const {
    project,
    autosaveState,
    history,
    future,
    setProjectName,
    setTileSize,
    setTool,
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    saveNow,
  } = useEditorStore();
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void loadProject("default-project").then((saved) => {
      if (saved) useEditorStore.setState({ project: saved, autosaveState: "saved" });
    });
  }, []);

  useEffect(() => {
    if (autosaveState !== "saving") return;
    const timer = window.setTimeout(() => void saveNow(), 650);
    return () => window.clearTimeout(timer);
  }, [autosaveState, project.updatedAt, saveNow]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "s") {
        event.preventDefault();
        void saveNow();
      } else if ((event.ctrlKey || event.metaKey) && key === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
      } else if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        undo();
      } else if ((event.ctrlKey || event.metaKey) && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (toolKeys[key]) {
        setTool(toolKeys[key]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [deleteSelected, duplicateSelected, redo, saveNow, setTool, undo]);

  return (
    <main className="editor-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /></div>
          <div><strong>Isoforge</strong><small>Tile Studio</small></div>
        </div>
        <div className="project-crumb">
          <span>Projekt</span><i>/</i>
          <input aria-label="Projektnamn" value={project.name} onChange={(event) => setProjectName(event.target.value)} />
          <ChevronDown size={14} />
        </div>
        <div className="header-actions">
          <div className="save-state">
            {autosaveState === "saved" ? <Check size={13} /> : <span className="saving-spinner" />}
            {autosaveState === "saved" ? "Sparad lokalt" : "Sparar…"}
          </div>
          <button aria-label="Ångra" disabled={!history.length} onClick={undo}><Undo2 size={17} /></button>
          <button aria-label="Gör om" disabled={!future.length} onClick={redo}><Redo2 size={17} /></button>
          <button className="header-secondary" onClick={() => void saveNow()}><Save size={15} /> Spara</button>
          <button className="export-button" onClick={() => setExportOpen(true)}><Download size={16} /> Exportera</button>
        </div>
      </header>

      <div className="context-bar">
        <label>
          Tileformat
          <select
            value={`${project.tileWidth}x${project.tileHeight}`}
            onChange={(event) => {
              const [width, height] = event.target.value.split("x").map(Number);
              setTileSize(width, height);
            }}
          >
            <option value="64x32">64 × 32</option>
            <option value="128x64">128 × 64</option>
            <option value="256x128">256 × 128</option>
          </select>
        </label>
        <span className="context-divider" />
        <div><span className="swatch fill-swatch" /> Fyllning <b>{project.style.fillColor}</b></div>
        <div><span className="swatch stroke-swatch" /> Linje <b>{project.style.strokeWidth}px</b></div>
        <span className="context-divider" />
        <div><Settings2 size={14} /> Vinkellås <b>26,6° / 90°</b></div>
        <div><Copy size={14} /> Snäppning <b>Smart</b></div>
        <button className="history-button"><History size={14} /> Historik</button>
      </div>

      <div className="workspace">
        <ToolRail />
        <div className="center-stack">
          <EditorCanvas />
          <div className="bottom-dock">
            <TileLibrary />
            <LayerPanel />
          </div>
        </div>
        <div className="right-stack"><LivePreview /><Inspector /></div>
      </div>
      <footer className="status-bar">
        <span><i className="ok-dot" /> Inga blockerande fel</span>
        <span>Snäppning: <b>Tilehörn, centrum, isometriska vinklar</b></span>
        <span>SVG · IndexedDB · Tiled 1.11</span>
      </footer>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </main>
  );
}
