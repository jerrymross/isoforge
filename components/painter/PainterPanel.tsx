"use client";

import { useMemo, useRef, useState } from "react";
import { Brush, ChevronLeft, Eraser, Paintbrush } from "lucide-react";
import type { UvPaint, VectorObject } from "@/types/editor";
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
  };
}

export function PainterPanel() {
  const { project, selectedObjectId, updateObject, setWorkspaceMode } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId);
  const object = tile?.objects.find((item) => item.id === selectedObjectId);
  const [face, setFace] = useState<FaceId>("top");
  const [color, setColor] = useState("#ee6a47");
  const painting = useRef(false);
  const paint = useMemo(() => (object ? makePaint(object) : null), [object]);

  function paintCell(index: number, erase = false) {
    if (!object || !paint) return;
    const next = { ...paint, [face]: [...paint[face]] } as UvPaint;
    next[face][index] = erase ? object.style.fill : color;
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
        <button className="painter-tool active" title="Måla" onClick={() => undefined}><Brush size={14} /> Pensel</button>
        <button className="painter-tool" title="Sudda med objektets grundfärg" onClick={() => setColor(object.style.fill)}><Eraser size={14} /> Sudda</button>
      </div>
      <div className="painter-face-tabs">
        {faces.map((item) => <button key={item.id} className={face === item.id ? "active" : ""} onClick={() => setFace(item.id as FaceId)}>{item.label}</button>)}
      </div>
      <div className="painter-workspace">
        <div className="painter-canvas-wrap">
          <div className="painter-canvas-label"><strong>{activeFace.label}</strong><span>{activeFace.description} · {UV_SIZE} × {UV_SIZE}</span></div>
          <div className="painter-grid" onPointerLeave={() => { painting.current = false; }}>
            {paint[face].map((cell, index) => (
              <button
                key={`${face}-${index}`}
                className="painter-cell"
                style={{ backgroundColor: cell }}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); painting.current = true; paintCell(index); }}
                onPointerEnter={() => { if (painting.current) paintCell(index); }}
                onPointerUp={() => { painting.current = false; }}
                aria-label={`${activeFace.label} cell ${index + 1}`}
              />
            ))}
          </div>
          <small className="painter-hint">Klicka eller dra över rutorna för att måla.</small>
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
