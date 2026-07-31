"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  Check,
  ChevronDown,
  Download,
  Moon,
  PencilRuler,
  Paintbrush,
  Map as MapIcon,
  Shield,
  Redo2,
  Settings2,
  Sun,
  Undo2,
  WandSparkles,
} from "lucide-react";
import { EditorCanvas } from "./EditorCanvas";
import { Inspector } from "./Inspector";
import { ExportDialog } from "@/components/export/ExportDialog";
import { LayerPanel } from "@/components/layers/LayerPanel";
import { LivePreview } from "@/components/preview/LivePreview";
import { TileLibrary } from "@/components/tiles/TileLibrary";
import { ToolRail } from "@/components/toolbar/ToolRail";
import { GeneratorPanel } from "@/components/toolbar/GeneratorPanel";
import { CollisionPanel } from "@/components/toolbar/CollisionPanel";
import { PainterPanel } from "@/components/painter/PainterPanel";
import { WorldEditor } from "@/components/world/WorldEditor";
import { loadProject } from "@/lib/project-db";
import {
  normalizeProject,
  prepareProjectForLaunch,
  useEditorStore,
} from "@/stores/editor-store";
import type { TileGuideMode, Tool } from "@/types/editor";

const toolKeys: Record<string, Tool> = {
  v: "select",
  s: "scale",
  n: "node",
  p: "pen",
  l: "line",
  g: "polygon",
  c: "ellipse",
  y: "iso-cylinder",
  b: "iso-box",
};

type Theme = "light" | "dark";

export function EditorShell() {
  const {
    project,
    workspaceMode,
    autosaveState,
    autoTilt,
    gridSnap,
    denseGrid,
    history,
    future,
    setProjectName,
    setTileSize,
    setTileGuideMode,
    setTool,
    setWorkspaceMode,
    setAutoTilt,
    selectAllObjects,
    undo,
    redo,
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    saveNow,
  } = useEditorStore();
  const [exportOpen, setExportOpen] = useState(false);
  const activeTile = project.tiles.find(
    (tile) => tile.id === project.activeTileId,
  );
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
      ? "dark"
      : "light",
  );

  useEffect(() => {
    void loadProject("default-project").then((saved) => {
      if (saved) {
        useEditorStore.setState({
          project: prepareProjectForLaunch(normalizeProject(saved)),
          selectedObjectId: null,
          selectedObjectIds: [],
          selectedCollisionId: null,
          autosaveState: "saved",
        });
      }
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
      if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();
        setTool("select");
        selectAllObjects();
      } else if ((event.ctrlKey || event.metaKey) && key === "s") {
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
      } else if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        copySelected();
      } else if ((event.ctrlKey || event.metaKey) && key === "v") {
        event.preventDefault();
        pasteClipboard();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (toolKeys[key]) {
        setTool(toolKeys[key]);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    deleteSelected,
    duplicateSelected,
    copySelected,
    pasteClipboard,
    redo,
    saveNow,
    selectAllObjects,
    setTool,
    undo,
  ]);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem("isoforge-theme", nextTheme);
    setTheme(nextTheme);
  }

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
          <button
            className="theme-toggle"
            aria-label={theme === "dark" ? "Använd ljust läge" : "Använd mörkt läge"}
            title={theme === "dark" ? "Ljust läge" : "Mörkt läge"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button className="export-button" onClick={() => setExportOpen(true)}><Download size={16} /> Exportera</button>
        </div>
      </header>

      <div className="context-bar">
        <div className="workspace-mode-switch" aria-label="Arbetsläge">
          <button
            className={workspaceMode === "draw" ? "active" : ""}
            onClick={() => setWorkspaceMode("draw")}
          >
            <PencilRuler size={13} /> Rita
          </button>
          <button
            className={workspaceMode === "convert" ? "active" : ""}
            onClick={() => setWorkspaceMode("convert")}
          >
            <WandSparkles size={13} /> 2D → ISO
          </button>
          <button
            className={workspaceMode === "objects" ? "active" : ""}
            onClick={() => setWorkspaceMode("objects")}
          >
            <Boxes size={13} /> Objekt
          </button>
          <button
            className={workspaceMode === "collision" ? "active" : ""}
            onClick={() => setWorkspaceMode("collision")}
          >
            <Shield size={13} /> Kollision
          </button>
          <button
            className={workspaceMode === "painter" ? "active" : ""}
            onClick={() => setWorkspaceMode("painter")}
            title="Öppna Painter för markerat objekt"
          >
            <Paintbrush size={13} /> Painter
          </button>
          <button
            className={workspaceMode === "world" ? "active" : ""}
            onClick={() => setWorkspaceMode("world")}
            title="Bygg en värld av projektets tiles"
          >
            <MapIcon size={13} /> World Editor
          </button>
        </div>
        <span className="context-divider" />
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
        <label>
          Guide
          <select
            value={activeTile?.guideMode ?? "floor"}
            onChange={(event) =>
              setTileGuideMode(event.target.value as TileGuideMode)
            }
          >
            <option value="floor">Golv</option>
            <option value="wall-left">Vägg vänster</option>
            <option value="wall-right">Vägg höger</option>
            <option value="floor-object">Objekt på golv</option>
            <option value="corner">Hörn</option>
            <option value="roof">Tak</option>
            <option value="circle">Cirkel</option>
          </select>
        </label>
        <span className="context-divider" />
        <button
          className={autoTilt ? "angle-lock active" : "angle-lock"}
          onClick={() => setAutoTilt(!autoTilt)}
          title="Växla automatisk framåttiltning för Tiled 2:1-isometri"
        >
          <Settings2 size={14} /> Auto-tilt <b>{autoTilt ? "26,565°" : "Av"}</b>
        </button>
        <span className="context-note">
          Rutnät {denseGrid ? "8" : "16"} px · autosnap {gridSnap ? "på" : "av"}
        </span>
      </div>

      <div className={`workspace workspace-${workspaceMode}`}>
        {workspaceMode === "draw" ? (
          <ToolRail />
        ) : workspaceMode === "collision" ? (
          <CollisionPanel />
        ) : workspaceMode === "painter" || workspaceMode === "world" ? (
          <div className="workspace-side-placeholder" aria-hidden="true" />
        ) : (
          <GeneratorPanel mode={workspaceMode} />
        )}
        <div className="center-stack">
          {workspaceMode === "painter" ? <PainterPanel /> : workspaceMode === "world" ? <WorldEditor /> : <>
            <EditorCanvas />
            <div className="bottom-dock">
              <TileLibrary />
              <LayerPanel />
            </div>
          </>}
        </div>
        <div className="right-stack"><LivePreview /><Inspector /></div>
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </main>
  );
}
