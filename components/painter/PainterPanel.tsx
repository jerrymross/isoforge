"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Brush, ChevronLeft, Eraser, Paintbrush, PenLine, Square } from "lucide-react";
import type { Point, UvPaint, UvVectorPath, VectorObject } from "@/types/editor";
import { useEditorStore } from "@/stores/editor-store";

const UV_SIZE = 12;
const faces = [
  { id: "top", label: "TOPP", description: "Klossens ovansida" },
  { id: "left", label: "VÄNSTER", description: "Vänster sida" },
  { id: "right", label: "HÖGER", description: "Höger sida" },
] as const;
type FaceId = (typeof faces)[number]["id"];

function makePaint(object: VectorObject): UvPaint {
  const existing = object.uvPaint;
  if (existing?.size === UV_SIZE) return existing;
  return {
    size: UV_SIZE,
    top: Array(UV_SIZE * UV_SIZE).fill(object.style.fill),
    left: Array(UV_SIZE * UV_SIZE).fill(object.style.fill),
    right: Array(UV_SIZE * UV_SIZE).fill(object.style.fill),
    activeColor: {},
    mode: "vector",
  };
}

export function PainterPanel() {
  const { project, selectedObjectId, updateObject, setWorkspaceMode } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId);
  const object = tile?.objects.find((item) => item.id === selectedObjectId);
  const [face, setFace] = useState<FaceId>("top");
  const [color, setColor] = useState("#ee6a47");
  const [drawMode, setDrawMode] = useState<"vector" | "cells">(() => object?.uvPaint?.mode ?? "vector");
  const [draftPath, setDraftPath] = useState<Point[]>([]);
  const painting = useRef(false);
  const draftRef = useRef<Point[]>([]);
  const paintRef = useRef<{ objectId: string; paint: UvPaint } | null>(null);
  const paint = useMemo(() => (object ? makePaint(object) : null), [object]);

  useEffect(() => {
    if (object && paint && paintRef.current?.objectId !== object.id) {
      paintRef.current = { objectId: object.id, paint };
    }
  }, [object, paint]);

  function paintCell(index: number, erase = false) {
    if (!object || !paint) return;
    const current = paintRef.current?.paint ?? paint;
    const next = { ...current, [face]: [...current[face]] } as UvPaint;
    const nextColor = erase ? object.style.fill : color;
    next[face][index] = nextColor;
    next.activeColor = { ...current.activeColor, [face]: nextColor };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
  }

  function paintAtPointer(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const column = Math.floor(((event.clientX - bounds.left) / bounds.width) * UV_SIZE);
    const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * UV_SIZE);
    if (column >= 0 && column < UV_SIZE && row >= 0 && row < UV_SIZE) {
      paintCell(row * UV_SIZE + column);
    }
  }

  function uvPoint(event: React.PointerEvent<HTMLDivElement>): Point {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function drawVector(event: React.PointerEvent<HTMLDivElement>) {
    const point = uvPoint(event);
    const previous = draftRef.current.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.008) {
      draftRef.current = [...draftRef.current, point];
      setDraftPath(draftRef.current);
    }
  }

  function finishVector() {
    if (!object || !paint || drawMode !== "vector" || draftRef.current.length < 2) {
      draftRef.current = [];
      setDraftPath([]);
      painting.current = false;
      return;
    }
    const current = paintRef.current?.paint ?? paint;
    const vector: UvVectorPath = { points: draftRef.current, color, width: 0.018 };
    const next: UvPaint = {
      ...current,
      vectors: {
        ...current.vectors,
        [face]: [...(current.vectors?.[face] ?? []), vector],
      },
      activeColor: { ...current.activeColor, [face]: color },
    };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
    draftRef.current = [];
    setDraftPath([]);
    painting.current = false;
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    painting.current = true;
    if (drawMode === "vector") {
      draftRef.current = [];
      setDraftPath([]);
      drawVector(event);
    } else {
      paintAtPointer(event);
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!painting.current) return;
    if (drawMode === "vector") drawVector(event);
    else paintAtPointer(event);
  }

  function changeDrawMode(nextMode: "vector" | "cells") {
    if (!object || !paint) return;
    setDrawMode(nextMode);
    const current = paintRef.current?.paint ?? paint;
    const next: UvPaint = { ...current, mode: nextMode };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
  }

  if (!object || !paint) {
    return (
      <section className="painter-panel empty-painter">
        <div className="panel-heading"><Paintbrush size={15} /> Painter</div>
        <p>Markera ett objekt i ritläget och öppna sedan Painter för att måla dess UV-ytor.</p>
        <button onClick={() => setWorkspaceMode("draw")}><ChevronLeft size={14} /> Tillbaka till ritläget</button>
      </section>
    );
  }

  const activeFace = faces.find((item) => item.id === face)!;
  return (
    <section className="painter-panel" aria-label="Painter UV-redigering">
      <div className="panel-heading painter-heading">
        <span><Paintbrush size={15} /> Painter <small>{object.name}</small></span>
        <button onClick={() => setWorkspaceMode("draw")} title="Tillbaka till ritläget"><ChevronLeft size={14} /> Ritläge</button>
      </div>
      <div className="painter-toolbar">
        <label className="painter-color"><span>Färg</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><code>{color}</code></label>
        <button className={`painter-tool ${drawMode === "vector" ? "active" : ""}`} title="Rita som vektor" onClick={() => changeDrawMode("vector")}><PenLine size={14} /> Vektor</button>
        <button className={`painter-tool ${drawMode === "cells" ? "active" : ""}`} title="Måla celler" onClick={() => changeDrawMode("cells")}><Brush size={14} /> Rutor</button>
        <button className="painter-tool" title="Använd objektets grundfärg" onClick={() => setColor(object.style.fill)}><Eraser size={14} /> Sudda</button>
        <span className="painter-mode-note"><Square size={12} /> {drawMode === "vector" ? "Vektorritning" : "Rutmålning"}</span>
      </div>
      <div className="painter-face-tabs">
        {faces.map((item) => <button key={item.id} className={face === item.id ? "active" : ""} onClick={() => setFace(item.id as FaceId)}>{item.label}</button>)}
      </div>
      <div className="painter-workspace">
        <div className="painter-canvas-wrap">
          <div className="painter-canvas-label"><strong>{activeFace.label}</strong><span>{activeFace.description} · {UV_SIZE} × {UV_SIZE}</span></div>
          <div
            className={`painter-grid face-${face}`}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={finishVector}
            onPointerCancel={finishVector}
          >
            {paint[face].map((cell, index) => (
              <button
                key={`${face}-${index}`}
                className="painter-cell"
                style={{ backgroundColor: drawMode === "cells" ? cell : object.style.fill }}
                aria-label={`${activeFace.label} cell ${index + 1}`}
              />
            ))}
            <svg className="painter-vector-layer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
              {(paint.vectors?.[face] ?? []).map((path, index) => (
                <path key={`saved-${index}`} d={path.points.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${point.x} ${point.y}`).join(" ")} fill="none" stroke={path.color} strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {draftPath.length > 1 && <path d={draftPath.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")} fill="none" stroke={color} strokeWidth="0.018" strokeLinecap="round" strokeLinejoin="round" />}
            </svg>
          </div>
          <small className="painter-hint">{drawMode === "vector" ? "Dra i kvadraten för att rita en vektorlinje." : "Klicka eller dra över rutorna för att måla."}</small>
        </div>
        <div className="painter-preview-card">
          <span>UV-layout</span>
          <div className="uv-layout" aria-hidden="true">
            <div className="uv-face uv-top" style={{ background: `linear-gradient(135deg, ${paint.top[0]}, ${paint.top[Math.floor(paint.top.length / 2)]})` }}>T</div>
            <div className="uv-face uv-left" style={{ background: `linear-gradient(90deg, ${paint.left[0]}, ${paint.left[Math.floor(paint.left.length / 2)]})` }}>V</div>
            <div className="uv-face uv-right" style={{ background: `linear-gradient(90deg, ${paint.right[0]}, ${paint.right[Math.floor(paint.right.length / 2)]})` }}>H</div>
          </div>
        </div>
      </div>
    </section>
  );
}
