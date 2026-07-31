"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brush, Eraser, Grid3X3, Minus, Plus, Trash2 } from "lucide-react";
import { VectorShape } from "@/components/editor/VectorScene";
import { useEditorStore } from "@/stores/editor-store";

export function WorldEditor() {
  const { project, setWorldSize, paintWorldCell, clearWorld } = useEditorStore();
  const [collectionId, setCollectionId] = useState(project.collections[0]?.id ?? "");
  const collectionTiles = project.tiles.filter((tile) => tile.collectionId === collectionId && tile.id !== "tile-start");
  const [selectedTileId, setSelectedTileId] = useState<string | null>(() => collectionTiles[0]?.id ?? null);
  const [tool, setTool] = useState<"brush" | "erase">("brush");
  const [zoom, setZoom] = useState(1);
  const painting = useRef(false);
  const cellWidth = 80;
  const cellHeight = 40;
  const margin = 130;
  const originX = margin + project.world.height * cellWidth / 2;
  const originY = margin;
  const mapWidth = (project.world.width + project.world.height) * cellWidth / 2 + margin * 2;
  const mapHeight = (project.world.width + project.world.height) * cellHeight / 2 + margin * 2;
  const cells = useMemo(() => Array.from(
    { length: project.world.width * project.world.height },
    (_, index) => ({ x: index % project.world.width, y: Math.floor(index / project.world.width) }),
  ).sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.x - b.x), [project.world.height, project.world.width]);

  useEffect(() => {
    const stop = () => { painting.current = false; };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  function tileAt(x: number, y: number) {
    const tileId = project.world.cells[`${x},${y}`];
    return project.tiles.find((tile) => tile.id === tileId);
  }

  function paint(x: number, y: number) {
    paintWorldCell(x, y, tool === "erase" ? null : selectedTileId);
  }

  return (
    <section className="world-editor">
      <aside className="world-palette">
        <div className="world-title"><Grid3X3 size={16} /><div><strong>World Editor</strong><small>Isometrisk tilemap</small></div></div>
        <div className="world-size-fields">
          <label>Kolumner<input type="number" min="1" max="64" value={project.world.width} onChange={(event) => setWorldSize(Number(event.target.value), project.world.height)} /></label>
          <label>Rader<input type="number" min="1" max="64" value={project.world.height} onChange={(event) => setWorldSize(project.world.width, Number(event.target.value))} /></label>
        </div>
        <div className="world-tools">
          <button className={tool === "brush" ? "active" : ""} onClick={() => setTool("brush")}><Brush size={14} /> Pensel</button>
          <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}><Eraser size={14} /> Sudd</button>
        </div>
        <label className="world-collection">Samling<select value={collectionId} onChange={(event) => { setCollectionId(event.target.value); const first = project.tiles.find((tile) => tile.collectionId === event.target.value && tile.id !== "tile-start"); setSelectedTileId(first?.id ?? null); }}>
          {project.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
        </select></label>
        <div className="world-tile-palette">
          {collectionTiles.map((tile) => (
            <button key={tile.id} className={selectedTileId === tile.id ? "active" : ""} onClick={() => { setSelectedTileId(tile.id); setTool("brush"); }}>
              <svg viewBox="190 170 260 205" aria-hidden="true"><g>{tile.objects.map((object) => <VectorShape key={object.id} object={object} />)}</g></svg>
              <span>{tile.name}</span>
            </button>
          ))}
          {!collectionTiles.length && <p>Samlingen saknar tiles. Skapa dem i ritläget först.</p>}
        </div>
        <button className="world-clear" onClick={clearWorld}><Trash2 size={13} /> Rensa världen</button>
      </aside>

      <div className="world-stage-shell">
        <div className="world-stage-heading">
          <div><strong>{project.world.width} × {project.world.height}</strong><span>{Object.keys(project.world.cells).length} placerade tiles</span></div>
          <div className="world-zoom"><button onClick={() => setZoom(Math.max(.4, zoom - .1))}><Minus size={13} /></button><b>{Math.round(zoom * 100)}%</b><button onClick={() => setZoom(Math.min(2, zoom + .1))}><Plus size={13} /></button></div>
        </div>
        <div className="world-stage">
          <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} style={{ width: mapWidth * zoom, height: mapHeight * zoom }} onPointerLeave={() => { painting.current = false; }}>
            <g className="world-grid-base">
              {cells.map(({ x, y }) => {
                const centerX = originX + (x - y) * cellWidth / 2;
                const centerY = originY + (x + y) * cellHeight / 2;
                return <polygon key={`base-${x}-${y}`} points={`${centerX},${centerY - cellHeight / 2} ${centerX + cellWidth / 2},${centerY} ${centerX},${centerY + cellHeight / 2} ${centerX - cellWidth / 2},${centerY}`} />;
              })}
            </g>
            <g className="world-placed-tiles">
              {cells.map(({ x, y }) => {
                const tile = tileAt(x, y);
                if (!tile) return null;
                const centerX = originX + (x - y) * cellWidth / 2;
                const centerY = originY + (x + y) * cellHeight / 2;
                const scale = cellWidth / project.tileWidth;
                const transform = `translate(${centerX - tile.anchor.sort.x * scale} ${centerY + cellHeight / 2 - tile.anchor.baseline * scale}) scale(${scale})`;
                return <g key={`tile-${x}-${y}`} transform={transform}>{tile.objects.map((object) => <VectorShape key={object.id} object={object} />)}</g>;
              })}
            </g>
            <g className="world-hit-grid">
              {cells.map(({ x, y }) => {
                const centerX = originX + (x - y) * cellWidth / 2;
                const centerY = originY + (x + y) * cellHeight / 2;
                return <polygon
                  key={`hit-${x}-${y}`}
                  points={`${centerX},${centerY - cellHeight / 2} ${centerX + cellWidth / 2},${centerY} ${centerX},${centerY + cellHeight / 2} ${centerX - cellWidth / 2},${centerY}`}
                  onPointerDown={(event) => { event.preventDefault(); painting.current = true; paint(x, y); }}
                  onPointerEnter={() => { if (painting.current) paint(x, y); }}
                />;
              })}
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
}
