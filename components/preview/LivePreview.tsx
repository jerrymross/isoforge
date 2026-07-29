"use client";

import { Grid3X3, Lightbulb, Maximize2, Minus, Plus } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { GuideLayer, VectorShape } from "@/components/editor/VectorScene";

export function LivePreview() {
  const {
    project,
    zoom,
    previewMode,
    showGuides,
    setZoom,
    setPreviewMode,
    toggleGuides,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const objects = tile.objects.filter((object) => {
    const layer = tile.layers.find((item) => item.id === object.layerId);
    return layer?.visible !== false;
  });
  const offsets =
    previewMode === "grid"
      ? [-1, 0, 1].flatMap((row) =>
          [-1, 0, 1].map((column) => ({
            x: column * project.tileWidth,
            y: (row * project.tileHeight) / 2,
            opacity: row === 0 && column === 0 ? 1 : 0.24,
          })),
        )
      : [{ x: 0, y: 0, opacity: 1 }];

  return (
    <aside className="preview-panel" aria-label="Live-preview">
      <div className="panel-heading preview-heading">
        <div>
          <span className="eyebrow">LIVE-PREVIEW</span>
          <strong>{previewMode === "single" ? "Enskild tile" : "3 × 3-rutnät"}</strong>
        </div>
        <span className="live-pill"><i /> LIVE</span>
      </div>
      <div className="preview-stage">
        <div className="preview-horizon" />
        <svg viewBox="0 0 640 480" style={{ transform: `scale(${zoom})` }}>
          <defs>
            <linearGradient id="preview-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#edf1ed" />
              <stop offset="100%" stopColor="#d7ddd7" />
            </linearGradient>
          </defs>
          <rect width="640" height="480" fill="transparent" />
          {offsets.map((offset, index) => (
            <g
              key={`${offset.x}-${offset.y}-${index}`}
              transform={`translate(${offset.x} ${offset.y})`}
              opacity={offset.opacity}
            >
              <polygon
                points="320,272 384,304 320,336 256,304"
                fill="url(#preview-floor)"
                stroke="#a9b8b3"
                strokeWidth="1"
              />
              {objects.map((object) => (
                <VectorShape key={`${index}-${object.id}`} object={object} />
              ))}
            </g>
          ))}
          {showGuides && (
            <GuideLayer
              tile={tile}
              tileWidth={project.tileWidth}
              tileHeight={project.tileHeight}
              compact
            />
          )}
        </svg>
        <div className="preview-scene-label">
          <Lightbulb size={14} />
          Ljus miljö
        </div>
      </div>
      <div className="preview-controls">
        <div className="segmented">
          <button
            className={previewMode === "single" ? "active" : ""}
            onClick={() => setPreviewMode("single")}
          >
            <Maximize2 size={14} /> 1 × 1
          </button>
          <button
            className={previewMode === "grid" ? "active" : ""}
            onClick={() => setPreviewMode("grid")}
          >
            <Grid3X3 size={14} /> 3 × 3
          </button>
        </div>
        <div className="zoom-control">
          <button aria-label="Zooma ut" onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button aria-label="Zooma in" onClick={() => setZoom(Math.min(2, zoom + 0.25))}>
            <Plus size={14} />
          </button>
        </div>
        <label className="toggle-row">
          <span>Guider</span>
          <input type="checkbox" checked={showGuides} onChange={toggleGuides} />
        </label>
      </div>
    </aside>
  );
}
