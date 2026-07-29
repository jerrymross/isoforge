"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { validateProject } from "@/features/drawing/geometry";
import {
  downloadExportZip,
  downloadText,
  projectToSvg,
  projectToTsx,
  svgToPng,
} from "@/features/tiled-export/exporters";
import { useEditorStore } from "@/stores/editor-store";

type Props = { open: boolean; onClose: () => void };

export function ExportDialog({ open, onClose }: Props) {
  const project = useEditorStore((state) => state.project);
  const [busy, setBusy] = useState(false);
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const issues = validateProject(project);
  if (!open) return null;
  const svg = projectToSvg(project, tile);

  async function run(task: () => void | Promise<void>) {
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Exportera"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">TILED EXPORT</span>
            <h2>Exportera {tile.name}</h2>
          </div>
          <button aria-label="Stäng" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="export-summary">
          <div><span>Tile</span><b>{project.tileWidth} × {project.tileHeight}px</b></div>
          <div><span>Objektcanvas</span><b>{project.canvasWidth} × {project.canvasHeight}px</b></div>
          <div><span>Antialiasing</span><b>SVG / 2× PNG</b></div>
          <div><span>Bakgrund</span><b>Transparent</b></div>
        </div>
        <div className={issues.length ? "validation-box warning" : "validation-box"}>
          {issues.length ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <div>
            <strong>{issues.length ? "Export med varning" : "Validering godkänd"}</strong>
            <span>{issues[0] ?? "Mått, ankare och sökvägar ser korrekta ut."}</span>
          </div>
        </div>
        <div className="export-options">
          <button disabled={busy} onClick={() => downloadText(svg, "tile.svg", "image/svg+xml;charset=utf-8")}>
            <FileCode2 size={22} />
            <span><b>SVG-original</b><small>Redigerbar vektorgrafik</small></span>
            <Download size={16} />
          </button>
          <button disabled={busy} onClick={() => run(() => svgToPng(svg, "tile.png", 2).then(() => undefined))}>
            <ImageIcon size={22} />
            <span><b>PNG @2×</b><small>Transparent, kantutjämnad</small></span>
            <Download size={16} />
          </button>
          <button
            disabled={busy}
            onClick={() => downloadText(projectToTsx(project, tile), "tileset.tsx", "application/xml;charset=utf-8")}
          >
            <FileCode2 size={22} />
            <span><b>Tiled TSX</b><small>Tileoffset och properties</small></span>
            <Download size={16} />
          </button>
          <button className="primary-export" disabled={busy} onClick={() => run(() => downloadExportZip(project, tile))}>
            <FileArchive size={22} />
            <span><b>{busy ? "Förbereder…" : "Komplett ZIP"}</b><small>PNG, SVG, TSX och projekt-JSON</small></span>
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
