import { describe, expect, it } from "vitest";
import type { Layer, VectorObject } from "@/types/editor";
import { effectiveObjectOpacity, sortObjectsByLayer } from "./layer-order";

const layers: Layer[] = [
  { id: "back", name: "Bak", visible: true, locked: false, opacity: 0.5 },
  { id: "front", name: "Fram", visible: true, locked: false, opacity: 1 },
];

function object(id: string, layerId: string): VectorObject {
  return {
    id,
    name: id,
    kind: "polygon",
    layerId,
    points: [],
    height: 0,
    style: {
      fill: "#000000",
      stroke: "#000000",
      strokeWidth: 1,
      opacity: 0.8,
      shadow: false,
    },
    locked: false,
  };
}

describe("layer ordering", () => {
  it("sorts back layers before front layers and keeps local order", () => {
    const sorted = sortObjectsByLayer(
      [object("front", "front"), object("back-a", "back"), object("back-b", "back")],
      layers,
    );
    expect(sorted.map((item) => item.id)).toEqual(["back-a", "back-b", "front"]);
  });

  it("combines object and layer opacity", () => {
    expect(effectiveObjectOpacity(object("box", "back"), layers)).toBe(0.4);
  });
});
