"use client";

import { useRef, useState } from "react";
import { Crosshair, Maximize2, Minus, MoveDown, Plus } from "lucide-react";
import { makeIsoBox, snapIsoLine, snapPoint } from "@/features/drawing/geometry";
import { sortObjectsByLayer } from "@/features/layers/layer-order";
import { useEditorStore } from "@/stores/editor-store";
import type { Point, VectorObject } from "@/types/editor";
import { CollisionShapeView, GuideLayer, VectorShape } from "./VectorScene";

type CanvasViewBox = { x: number; y: number; width: number; height: number };

function clientPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  viewBox: CanvasViewBox,
): Point {
  const rect = svg.getBoundingClientRect();
  return {
    x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}

function eventPoint(
  event: React.PointerEvent<SVGSVGElement>,
  viewBox: CanvasViewBox,
): Point {
  return clientPoint(
    event.currentTarget,
    event.clientX,
    event.clientY,
    viewBox,
  );
}

export function EditorCanvas() {
  const {
    project,
    tool,
    workspaceMode,
    selectedObjectId,
    selectedCollisionId,
    selectedLayerId,
    showGuides,
    showCollisions,
    canvasZoom,
    selectObject,
    selectCollision,
    addObject,
    moveObject,
    setCanvasZoom,
    autoPlaceSelected,
    autoTiltSelected,
    autoSizeSelected,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const [start, setStart] = useState<Point | null>(null);
  const [draft, setDraft] = useState<Point[] | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const dragRef = useRef<{ id: string; start: Point; points: Point[] } | null>(null);
  const viewBox: CanvasViewBox = {
    width: 640 / canvasZoom,
    height: 480 / canvasZoom,
    x: 320 - 320 / canvasZoom,
    y: 240 - 240 / canvasZoom,
  };

  const visibleObjects = sortObjectsByLayer(
    tile.objects.filter((object) => {
      const layer = tile.layers.find((item) => item.id === object.layerId);
      return layer?.visible !== false;
    }),
    tile.layers,
  );

  function beginCanvas(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    if (workspaceMode === "collision") {
      if (event.target === event.currentTarget) selectCollision(null);
      return;
    }
    if (event.target !== event.currentTarget && tool === "select") return;
    const point = snapPoint(eventPoint(event, viewBox), project);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "select") {
      selectObject(null);
      return;
    }
    setStart(point);
    setDraft([point, point]);
  }

  function moveCanvas(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventPoint(event, viewBox);
    if (dragRef.current) {
      const dx = point.x - dragRef.current.start.x;
      const dy = point.y - dragRef.current.start.y;
      moveObject(
        dragRef.current.id,
        dragRef.current.points.map((original) => ({
          x: original.x + dx,
          y: original.y + dy,
        })),
      );
      return;
    }
    if (!start) return;
    if (tool === "line") {
      const snapped = snapIsoLine(start, point);
      setDraft([start, snapped.point]);
      setAngle(snapped.angle);
    } else if (tool === "iso-box") {
      setDraft(makeIsoBox(start, point, 72));
    } else if (tool === "polygon") {
      const snapped = snapPoint(point, project);
      setDraft([
        start,
        { x: snapped.x + 56, y: snapped.y + 28 },
        { x: snapped.x, y: snapped.y + 56 },
        { x: snapped.x - 56, y: snapped.y + 28 },
      ]);
    }
  }

  function endCanvas(event: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    if (!start || !draft || tool === "select" || tool === "node") return;
    const kind = tool === "iso-box" ? "iso-box" : tool;
    const object: VectorObject = {
      id: crypto.randomUUID(),
      name:
        kind === "iso-box" ? "Isometrisk box" : kind === "line" ? "Linje" : "Polygon",
      kind,
      layerId: selectedLayerId,
      points: draft,
      height: kind === "iso-box" ? 72 : 0,
      style: {
        fill: project.style.fillColor,
        stroke: project.style.strokeColor,
        strokeWidth: project.style.strokeWidth,
        opacity: 1,
        shadow: kind === "iso-box",
      },
      locked: false,
    };
    addObject(object);
    selectObject(object.id);
    setStart(null);
    setDraft(null);
    setAngle(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function beginObjectDrag(
    event: React.PointerEvent<SVGGElement>,
    object: VectorObject,
  ) {
    event.stopPropagation();
    selectObject(object.id);
    if (tool !== "select" || object.locked) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const point = clientPoint(svg, event.clientX, event.clientY, viewBox);
    dragRef.current = { id: object.id, start: point, points: object.points };
    svg.setPointerCapture(event.pointerId);
  }

  return (
    <section className="canvas-panel" aria-label="Rityta">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">VEKTORRITYTA</span>
          <strong>{tile.name}</strong>
        </div>
        <div className="canvas-header-actions">
          <div className="smart-layout-actions">
            <button
              title={selectedObjectId ? "Centrera markeringen på baslinjen" : "Centrera hela tilen på baslinjen"}
              disabled={!tile.objects.length}
              onClick={autoPlaceSelected}
            >
              <Crosshair size={13} /> Autoplacera
            </button>
            <button
              title={
                selectedObjectId
                  ? "Tilta markeringen 26,565° framåt för Tiled-isometri"
                  : "Tilta alla olåsta objekt 26,565° framåt"
              }
              disabled={!tile.objects.length}
              onClick={autoTiltSelected}
            >
              <MoveDown size={13} /> Auto-tilt
            </button>
            <button
              title={selectedObjectId ? "Skala markeringen till exportytan" : "Skala hela tilen till exportytan"}
              disabled={!tile.objects.length}
              onClick={autoSizeSelected}
            >
              <Maximize2 size={13} /> Autoanpassa
            </button>
          </div>
          <div className="canvas-zoom-control">
            <button
              aria-label="Zooma ut ritytan"
              onClick={() => setCanvasZoom(Math.max(0.5, canvasZoom - 0.25))}
            >
              <Minus size={13} />
            </button>
            <button
              className="zoom-value"
              title="Återställ till 100 %"
              onClick={() => setCanvasZoom(1)}
            >
              {Math.round(canvasZoom * 100)}%
            </button>
            <button
              aria-label="Zooma in ritytan"
              onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>
      <div className="canvas-wrap">
        <svg
          className="drawing-canvas"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="Isometrisk SVG-rityta"
          onPointerDown={beginCanvas}
          onPointerMove={moveCanvas}
          onPointerUp={endCanvas}
          onWheel={(event) => {
            event.preventDefault();
            const step = event.deltaY < 0 ? 0.1 : -0.1;
            setCanvasZoom(
              Math.max(0.5, Math.min(3, Number((canvasZoom + step).toFixed(2)))),
            );
          }}
          onPointerCancel={() => {
            setStart(null);
            setDraft(null);
            dragRef.current = null;
          }}
        >
          <defs>
            <pattern id="micro-grid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" className="micro-grid-line" />
            </pattern>
            <filter id="object-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".18" />
            </filter>
          </defs>
          <rect x="-640" y="-480" width="1920" height="1440" className="canvas-bg" pointerEvents="none" />
          <rect x="-640" y="-480" width="1920" height="1440" fill="url(#micro-grid)" pointerEvents="none" />
          {showGuides && (
            <GuideLayer
              tile={tile}
              tileWidth={project.tileWidth}
              tileHeight={project.tileHeight}
            />
          )}
          <g filter="url(#object-shadow)">
            {visibleObjects.map((object) => (
              <VectorShape
                key={object.id}
                object={object}
                layerOpacity={
                  tile.layers.find((layer) => layer.id === object.layerId)
                    ?.opacity ?? 1
                }
                selected={selectedObjectId === object.id}
                onPointerDown={(event) => beginObjectDrag(event, object)}
              />
            ))}
            {draft && (
              <VectorShape
                object={{
                  id: "draft",
                  name: "Förhandsvisning",
                  kind: tool === "iso-box" ? "iso-box" : tool === "polygon" ? "polygon" : "line",
                  layerId: selectedLayerId,
                  points: draft,
                  height: 72,
                  style: {
                    fill: project.style.fillColor,
                    stroke: "#f06b45",
                    strokeWidth: 2,
                    opacity: 0.72,
                    shadow: false,
                  },
                  locked: false,
                }}
              />
            )}
          </g>
          {(showCollisions || workspaceMode === "collision") && (
            <g className="collision-overlay">
              {tile.collisions
                .filter((collision) => collision.enabled)
                .map((collision) => (
                  <CollisionShapeView
                    key={collision.id}
                    collision={collision}
                    selected={selectedCollisionId === collision.id}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      selectCollision(collision.id);
                    }}
                  />
                ))}
            </g>
          )}
          {angle !== null && draft && (
            <g transform={`translate(${draft.at(-1)!.x + 12} ${draft.at(-1)!.y - 12})`}>
              <rect x="-4" y="-15" width="54" height="24" rx="6" className="angle-chip" />
              <text className="angle-text">{angle.toFixed(1)}°</text>
            </g>
          )}
        </svg>
        <div className="axis-compass" aria-hidden="true">
          <span className="axis-z">Z</span>
          <span className="axis-y">Y</span>
          <span className="axis-x">X</span>
        </div>
      </div>
    </section>
  );
}
