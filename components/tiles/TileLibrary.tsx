"use client";

import { Box, Search, SlidersHorizontal } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { VectorShape } from "@/components/editor/VectorScene";

const placeholders = [
  { name: "Golv · kalksten", color: "#b8c4b7" },
  { name: "Vägg · puts", color: "#d4c7ad" },
  { name: "Bakugn", color: "#9f6853" },
];

export function TileLibrary() {
  const { project } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  return (
    <section className="bottom-section library-section">
      <div className="bottom-heading">
        <span><Box size={15} /> Tilebibliotek <b>4</b></span>
        <div className="library-actions">
          <label className="mini-search">
            <Search size={13} />
            <input aria-label="Sök tiles" placeholder="Sök tiles…" />
          </label>
          <button aria-label="Filtrera"><SlidersHorizontal size={14} /></button>
        </div>
      </div>
      <div className="tile-strip">
        <button className="tile-card active">
          <div className="tile-thumb">
            <svg viewBox="180 130 280 250">
              {tile.objects.map((object) => (
                <VectorShape key={object.id} object={object} />
              ))}
            </svg>
          </div>
          <span>{tile.name}</span>
          <small>{tile.category}</small>
        </button>
        {placeholders.map((item) => (
          <button className="tile-card" key={item.name}>
            <div className="tile-thumb placeholder-thumb">
              <span style={{ backgroundColor: item.color }} />
            </div>
            <span>{item.name.split(" · ")[0]}</span>
            <small>{item.name.split(" · ")[1]}</small>
          </button>
        ))}
        <button className="tile-card add-tile">
          <i>+</i>
          <span>Ny tile</span>
        </button>
      </div>
    </section>
  );
}
