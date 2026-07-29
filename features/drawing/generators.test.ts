import { describe, expect, it } from "vitest";
import {
  finalizeGeneratedObjects,
  primitiveObjects,
  templateObjects,
} from "./generators";

const params = { width: 128, depth: 64, height: 72, shelves: 3 };

describe("2D till isometriskt och objektmallar", () => {
  it("omvandlar ett golv till en 2:1-diamant", () => {
    const [floor] = primitiveObjects("floor", params, "#aaaaaa", "#222222");
    expect(floor.kind).toBe("polygon");
    expect(floor.points).toEqual([
      { x: 320, y: 272 },
      { x: 384, y: 304 },
      { x: 320, y: 336 },
      { x: 256, y: 304 },
    ]);
  });

  it("skapar en redigerbar isometrisk cylinder", () => {
    const [cylinder] = primitiveObjects("cylinder", params, "#aaaaaa", "#222222");
    expect(cylinder.kind).toBe("iso-cylinder");
    expect(cylinder.points).toHaveLength(4);
  });

  it("bygger arbetsbänk av separat arbetsyta och fyra ben", () => {
    const objects = templateObjects("workbench", params, "#aaaaaa", "#222222");
    expect(objects).toHaveLength(5);
    expect(objects.map((object) => object.name)).toContain("Arbetsyta");
  });

  it("bygger rätt antal hyllplan", () => {
    const objects = templateObjects("shelf", params, "#aaaaaa", "#222222");
    expect(objects).toHaveLength(5);
  });

  it("ersätter preview-id:n vid infogning", () => {
    const objects = templateObjects("wall", params, "#aaaaaa", "#222222");
    const final = finalizeGeneratedObjects(objects, () => "final-id");
    expect(final[0].id).toBe("final-id");
  });
});
