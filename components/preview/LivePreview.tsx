"use client";

import { useMemo, useState } from "react";
import { Grid3X3, Layers3, Lightbulb, Maximize2, Minus, Plus } from "lucide-react";
import {
  isoGridOffset,
  pointsToString,
  TILE_CENTER,
  tileDiamond,
} from "@/features/drawing/geometry";
import { useEditorStore } from "@/stores/editor-store";
import type { Tile } from "@/types/editor";
import {
  CollisionShapeView,
  GuideLayer,
  VectorShape,
} from "@/components/editor/VectorScene";

type FillMode = "repeat" | "collection";

export function LivePreview() {
  const {
    project,
    zoom,
    previewMode,
    showGuides,
    showCollisions,
    setZoom,
    setPreviewMode,
    toggleGuides,
    setShowCollisions,
  } = useEditorStore();
  const [fillMode, setFillMode] = useState<FillMode>("repeat");
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const collectionTiles = project.tiles.filter(
    (item) => item.collectionId === tile.collectionId,
  );

  const cells = useMemo(() => {
    if (previewMode === "single") {
      return [{ column: 0, row: 0, x: 0, y: 0, depth: 0, tile }];
    }
    return [-1, 0, 1]
      .flatMap((row) =>
        [-1, 0, 1].map((column, index) => {
          const isCenter = column === 0 && row === 0;
          const offset = isoGridOffset(
            column,
            row,
            project.tileWidth,
            project.tileHeight,
          );
          const candidate =
            fillMode === "collection" && collectionTiles.length
              ? collectionTiles[
                  ((row + 1) * 3 + (column + 1) + index) % collectionTiles.length
                ]
              : tile;
          return {
            column,
            row,
            x: offset.x,
            y: offset.y,
            depth: column + row,
            tile: isCenter ? tile : candidate,
          };
        }),
      )
      .sort((a, b) => a.depth - b.depth || a.column - b.column);
  }, [
    collectionTiles,
    fillMode,
    previewMode,
    project.tileHeight,
    project.tileWidth,
    tile,
  ]);

  function visibleObjects(previewTile: Tile) {
    return previewTile.objects.filter((object) => {
      const layer = previewTile.layers.find((item) => item.id === object.layerId);
      return layer?.visible !== false;
    });
  }

  const floorPoints = pointsToString(
    tileDiamond(project.tileWidth, project.tileHeight, TILE_CENTER),
  );

  return (
    <aside className="preview-panel" aria-label="Live-preview">
      <div className="panel-heading preview-heading">
        <div>
          <span className="eyebrow">LIVE-PREVIEW</span>
          <strong>
            {previewMode === "single" ? "Enskild tile" : "Isometriskt 3 × 3-rutnät"}
          </strong>
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
            <filter id="preview-object-shadow" x="-40%" y="-40%" width="180%" height="190%">
              <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity=".16" />
            </filter>
          </defs>
          <rect width="640" height="480" fill="transparent" />
          {cells.map((cell) => {
            const isCenter = cell.column === 0 && cell.row === 0;
            return (
              <g
                key={`${cell.column}-${cell.row}-${cell.tile.id}`}
                transform={`translate(${cell.x} ${cell.y})`}
                className={isCenter ? "preview-cell active" : "preview-cell"}
              >
                <polygon
                  points={floorPoints}
                  fill="url(#preview-floor)"
                  stroke={isCenter ? "#ee6a47" : "#8fa6a0"}
                  strokeWidth={isCenter ? 1.6 : 1}
                  vectorEffect="non-scaling-stroke"
                />
                <g filter="url(#preview-object-shadow)">
                  {visibleObjects(cell.tile).map((object) => (
                    <VectorShape key={`${cell.column}-${cell.row}-${object.id}`} object={object} />
                  ))}
                </g>
                {showCollisions && (
                  <g className="collision-overlay preview-collisions">
                    {cell.tile.collisions
                      .filter((collision) => collision.enabled)
                      .map((collision) => (
                        <CollisionShapeView
                          key={`${cell.column}-${cell.row}-collision-${collision.id}`}
                          collision={collision}
                          compact
                        />
                      ))}
                  </g>
                )}
                {showGuides && !isCenter && (
                  <circle
                    cx={cell.tile.anchor.image.x}
                    cy={cell.tile.anchor.image.y}
                    r="2.6"
                    fill="#668e88"
                  />
                )}
              </g>
            );
          })}
          {showGuides && (
            <GuideLayer
              tile={tile}
              tileWidth={project.tileWidth}
              tileHeight={project.tileHeight}
              compact
            />
          )}
        </svg>
        {previewMode === "grid" && (
          <div className="preview-depth-axis" aria-hidden="true">
            <span className="depth-back">Bakåt / över</span>
            <i />
            <span className="depth-front">Framåt / under</span>
          </div>
        )}
        <div className="preview-scene-label">
          <Lightbulb size={14} />
          Isometrisk spelvy
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
            <Grid3X3 size={14} /> ISO 3 × 3
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
        {previewMode === "grid" && (
          <label className="preview-fill-control">
            <Layers3 size={13} />
            Rutnät
            <select value={fillMode} onChange={(event) => setFillMode(event.target.value as FillMode)}>
              <option value="repeat">Upprepa aktiv tile</option>
              <option value="collection">Blanda aktiv samling</option>
            </select>
          </label>
        )}
        <label className="toggle-row">
          <span>Guider och ankare</span>
          <input type="checkbox" checked={showGuides} onChange={toggleGuides} />
        </label>
        <label className="toggle-row">
          <span>Kollisionsytor</span>
          <input
            type="checkbox"
            checked={showCollisions}
            onChange={(event) => setShowCollisions(event.target.checked)}
          />
        </label>
      </div>
    </aside>
  );
}
