"use client";

import { useRef, useState } from "react";
import { makeIsoBox, snapIsoLine, snapPoint } from "@/features/drawing/geometry";
import { useEditorStore } from "@/stores/editor-store";
import type { Point, VectorObject } from "@/types/editor";
import { GuideLayer, VectorShape } from "./VectorScene";

function eventPoint(event: React.PointerEvent<SVGSVGElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 640,
    y: ((event.clientY - rect.top) / rect.height) * 480,
  };
}

export function EditorCanvas() {
  const {
    project,
    tool,
    selectedObjectId,
    selectedLayerId,
    showGuides,
    selectObject,
    addObject,
    moveObject,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const [start, setStart] = useState<Point | null>(null);
  const [draft, setDraft] = useState<Point[] | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const dragRef = useRef<{ id: string; start: Point; points: Point[] } | null>(null);

  const visibleObjects = tile.objects.filter((object) => {
    const layer = tile.layers.find((item) => item.id === object.layerId);
    return layer?.visible !== false;
  });

  function beginCanvas(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget && tool === "select") return;
    const point = snapPoint(eventPoint(event), project);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "select") {
      selectObject(null);
      return;
    }
    setStart(point);
    setDraft([point, point]);
  }

  function moveCanvas(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventPoint(event);
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
    const rect = svg.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * 640,
      y: ((event.clientY - rect.top) / rect.height) * 480,
    };
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
        <div className="canvas-status">
          <span>2:1 ISO</span>
          <span>128 × 192</span>
          <span className="status-dot">Snapping aktiv</span>
        </div>
      </div>
      <div className="canvas-wrap">
        <svg
          className="drawing-canvas"
          viewBox="0 0 640 480"
          role="img"
          aria-label="Isometrisk SVG-rityta"
          onPointerDown={beginCanvas}
          onPointerMove={moveCanvas}
          onPointerUp={endCanvas}
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
          <rect width="640" height="480" className="canvas-bg" />
          <rect width="640" height="480" fill="url(#micro-grid)" pointerEvents="none" />
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
