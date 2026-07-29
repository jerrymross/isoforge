"use client";

import { Eye, EyeOff, GripVertical, Layers3, Lock, Unlock } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";

export function LayerPanel() {
  const { project, selectedLayerId, setSelectedLayer, toggleLayer } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  return (
    <section className="bottom-section layer-section">
      <div className="bottom-heading">
        <span><Layers3 size={15} /> Lager</span>
        <button className="text-button">+ Nytt</button>
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
    </section>
  );
}
