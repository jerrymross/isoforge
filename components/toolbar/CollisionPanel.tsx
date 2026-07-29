"use client";

import {
  Circle,
  Diamond,
  Eye,
  EyeOff,
  Hexagon,
  Square,
  Trash2,
} from "lucide-react";
import { collisionBounds } from "@/features/collision/collision";
import { useEditorStore } from "@/stores/editor-store";
import type { CollisionKind } from "@/types/editor";

const shapeButtons: Array<{
  kind: CollisionKind;
  label: string;
  icon: typeof Square;
}> = [
  { kind: "rectangle", label: "Rektangel", icon: Square },
  { kind: "polygon", label: "Polygon", icon: Hexagon },
  { kind: "ellipse", label: "Ellips", icon: Circle },
  { kind: "diamond", label: "ISO-diamant", icon: Diamond },
];

export function CollisionPanel() {
  const {
    project,
    selectedCollisionId,
    showCollisions,
    addCollision,
    selectCollision,
    updateCollisionBounds,
    toggleCollision,
    deleteCollision,
    setShowCollisions,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const selected = tile.collisions.find(
    (collision) => collision.id === selectedCollisionId,
  );
  const bounds = selected ? collisionBounds(selected) : null;

  function setBound(
    field: "x" | "y" | "width" | "height",
    value: string,
  ) {
    if (!selected) return;
    const number = Number(value);
    if (Number.isFinite(number)) updateCollisionBounds(selected.id, { [field]: number });
  }

  return (
    <aside className="generator-rail collision-rail" aria-label="Kollisionseditor">
      <div className="generator-heading">
        <span>TILED-DATA</span>
        <strong>Kollisionseditor</strong>
      </div>
      <p className="collision-intro">
        Definiera ytan som blockerar spelaren. Den exporteras i TSX och projektfilen.
      </p>
      <span className="generator-section-label">Lägg till form</span>
      <div className="collision-shape-grid">
        {shapeButtons.map(({ kind, label, icon: Icon }) => (
          <button key={kind} onClick={() => addCollision(kind)}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <label className="collision-master-toggle">
        <span>
          {showCollisions ? <Eye size={13} /> : <EyeOff size={13} />}
          Visa överlägg
        </span>
        <input
          type="checkbox"
          checked={showCollisions}
          onChange={(event) => setShowCollisions(event.target.checked)}
        />
      </label>
      <span className="generator-section-label">Former på denna tile</span>
      <div className="collision-list">
        {tile.collisions.map((collision) => (
          <button
            key={collision.id}
            className={collision.id === selectedCollisionId ? "active" : ""}
            onClick={() => selectCollision(collision.id)}
          >
            <span>{collision.name}</span>
            <i
              role="button"
              tabIndex={0}
              title={collision.enabled ? "Inaktivera" : "Aktivera"}
              onClick={(event) => {
                event.stopPropagation();
                toggleCollision(collision.id);
              }}
            >
              {collision.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
            </i>
          </button>
        ))}
        {!tile.collisions.length && <p>Inga kollisionsformer ännu.</p>}
      </div>
      {selected && bounds && (
        <div className="collision-editor">
          <div className="collision-editor-heading">
            <strong>{selected.name}</strong>
            <button
              aria-label="Ta bort kollisionsform"
              onClick={() => deleteCollision(selected.id)}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="collision-fields">
            {(["x", "y", "width", "height"] as const).map((field) => (
              <label key={field}>
                <span>
                  {field === "width" ? "Bredd" : field === "height" ? "Höjd" : field.toUpperCase()}
                </span>
                <input
                  type="number"
                  min={field === "width" || field === "height" ? 1 : undefined}
                  value={Math.round(bounds[field])}
                  onChange={(event) => setBound(field, event.target.value)}
                />
              </label>
            ))}
          </div>
          <small>{selected.points.length} punkter · {selected.kind}</small>
        </div>
      )}
      <p className="collision-export-note">
        Kollisionsformer visas som hjälpöverlägg men bränns inte in i PNG eller SVG.
      </p>
    </aside>
  );
}
