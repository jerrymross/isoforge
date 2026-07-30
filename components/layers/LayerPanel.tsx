"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Layers3,
  Lock,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";

export function LayerPanel() {
  const {
    project,
    selectedLayerId,
    setSelectedLayer,
    toggleLayer,
    addLayer,
    duplicateLayer,
    deleteLayer,
    moveLayer,
    setLayerOpacity,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const selected = tile.layers.find((layer) => layer.id === selectedLayerId);
  const selectedIndex = tile.layers.findIndex((layer) => layer.id === selectedLayerId);
  return (
    <section className="bottom-section layer-section">
      <div className="bottom-heading">
        <span><Layers3 size={15} /> Lager</span>
        <div className="layer-heading-actions">
          <button title="Nytt lager" onClick={addLayer}><Plus size={13} /></button>
          <button
            title="Duplicera lager och dess objekt"
            disabled={!selected}
            onClick={() => selected && duplicateLayer(selected.id)}
          >
            <Copy size={12} />
          </button>
          <button
            title="Ta bort lager"
            disabled={!selected || tile.layers.length <= 1}
            onClick={() => selected && deleteLayer(selected.id)}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="layer-list">
        {[...tile.layers].reverse().map((layer) => (
          <button
            key={layer.id}
            className={selectedLayerId === layer.id ? "layer-row active" : "layer-row"}
            onClick={() => setSelectedLayer(layer.id)}
          >
            <GripVertical size={13} className="drag-handle" />
            <span className="layer-color" />
            <span className="layer-name">{layer.name}</span>
            <span
              role="button"
              tabIndex={0}
              className="icon-hit"
              aria-label={layer.visible ? "Dölj lager" : "Visa lager"}
              onClick={(event) => {
                event.stopPropagation();
                toggleLayer(layer.id, "visible");
              }}
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </span>
            <span
              role="button"
              tabIndex={0}
              className="icon-hit"
              aria-label={layer.locked ? "Lås upp lager" : "Lås lager"}
              onClick={(event) => {
                event.stopPropagation();
                toggleLayer(layer.id, "locked");
              }}
            >
              {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="layer-controls">
          <div>
            <button
              title="Flytta bakåt"
              disabled={selectedIndex <= 0}
              onClick={() => moveLayer(selected.id, "down")}
            >
              <ChevronDown size={13} />
            </button>
            <button
              title="Flytta framåt"
              disabled={selectedIndex >= tile.layers.length - 1}
              onClick={() => moveLayer(selected.id, "up")}
            >
              <ChevronUp size={13} />
            </button>
          </div>
          <label>
            <span>Opacitet {Math.round(selected.opacity * 100)}%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selected.opacity}
              onChange={(event) =>
                setLayerOpacity(selected.id, Number(event.target.value))
              }
            />
          </label>
        </div>
      )}
    </section>
  );
}
