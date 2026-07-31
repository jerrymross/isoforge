import { describe, expect, it } from "vitest";
import { HOUSE_COLLECTION_ID, houseCollectionTiles } from "./house-collection";

describe("hus-samling", () => {
  it("innehåller färdiga byggdelar och möbler", () => {
    const tiles = houseCollectionTiles();

    expect(tiles).toHaveLength(8);
    expect(new Set(tiles.map((tile) => tile.collectionId))).toEqual(new Set([HOUSE_COLLECTION_ID]));
    expect(tiles.map((tile) => tile.name)).toEqual([
      "Husgolv",
      "Vägg vänster",
      "Vägg höger",
      "Sadeltak",
      "Dörr",
      "Fönster",
      "Skorsten",
      "Bord",
    ]);
    expect(tiles.every((tile) => tile.objects.length === 1)).toBe(true);
  });
  it("håller samma 2:1-projektion och neutral rotation på alla objekt", () => {
    const objects = houseCollectionTiles().flatMap((tile) => tile.objects);
    const boxes = objects.filter((object) => object.kind === "iso-box");

    expect(boxes).not.toHaveLength(0);
    boxes.forEach((object) => {
      const [top, right] = object.points;
      expect(Math.abs(right.x - top.x) / Math.abs(right.y - top.y)).toBeCloseTo(2, 5);
      expect(object.rotation ?? 0).toBe(0);
      expect(object.tilt ?? 0).toBe(0);
    });

    const roof = objects.find((object) => object.id === "house-roof-object");
    expect(roof?.rotation ?? 0).toBe(0);
    expect(roof?.tilt ?? 0).toBe(0);
  });
});
