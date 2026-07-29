"use client";

import { AlertTriangle, Link2, SlidersHorizontal } from "lucide-react";
import { validateProject } from "@/features/drawing/geometry";
import { useEditorStore } from "@/stores/editor-store";

export function Inspector() {
  const { project, selectedObjectId, updateObject } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const selected = tile.objects.find((object) => object.id === selectedObjectId);
  const issues = validateProject(project);

  if (!selected) {
    return (
      <section className="inspector-card">
        <div className="inspector-heading"><SlidersHorizontal size={15} /> Egenskaper</div>
        <p className="empty-copy">Markera ett objekt för att redigera dess vektoregenskaper.</p>
      </section>
    );
  }

  return (
    <section className="inspector-card">
      <div className="inspector-heading">
        <span><SlidersHorizontal size={15} /> Egenskaper</span>
        <span className="linked"><Link2 size={12} /> Länkad stil</span>
      </div>
      <label className="field-row">
        <span>Namn</span>
        <input
          value={selected.name}
          onChange={(event) => updateObject(selected.id, { name: event.target.value })}
        />
      </label>
      <div className="field-pair">
        <label>
          <span>Fyllning</span>
          <div className="color-field">
            <input
              type="color"
              value={selected.style.fill}
              onChange={(event) =>
                updateObject(selected.id, {
                  style: { ...selected.style, fill: event.target.value },
                })
              }
            />
            <code>{selected.style.fill}</code>
          </div>
        </label>
        <label>
          <span>Linje</span>
          <div className="color-field">
            <input
              type="color"
              value={selected.style.stroke}
              onChange={(event) =>
                updateObject(selected.id, {
                  style: { ...selected.style, stroke: event.target.value },
                })
              }
            />
            <code>{selected.style.stroke}</code>
          </div>
        </label>
      </div>
      <label className="range-field">
        <span>Linjetjocklek <b>{selected.style.strokeWidth}px</b></span>
        <input
          type="range"
          min="0"
          max="8"
          step="0.5"
          value={selected.style.strokeWidth}
          onChange={(event) =>
            updateObject(selected.id, {
              style: { ...selected.style, strokeWidth: Number(event.target.value) },
            })
          }
        />
      </label>
      <label className="range-field">
        <span>Transparens <b>{Math.round(selected.style.opacity * 100)}%</b></span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={selected.style.opacity}
          onChange={(event) =>
            updateObject(selected.id, {
              style: { ...selected.style, opacity: Number(event.target.value) },
            })
          }
        />
      </label>
      <div className={issues.length ? "validation-mini warning" : "validation-mini"}>
        <AlertTriangle size={14} />
        <span>{issues.length ? `${issues.length} varning att kontrollera` : "Redo för export"}</span>
      </div>
    </section>
  );
}
