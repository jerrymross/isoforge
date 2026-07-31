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
});
