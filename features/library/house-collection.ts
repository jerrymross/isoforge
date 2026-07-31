import { makeIsoBox, makeIsoCylinder, tileDiamond, TILE_CENTER } from "@/features/drawing/geometry";
import type { Layer, Point, Tile, VectorObject } from "@/types/editor";

const HOUSE_COLLECTION_ID = "collection-house";

function layers(): Layer[] {
  return [
    { id: "shadow", name: "Skugga", visible: true, locked: false, opacity: 0.6 },
    { id: "base", name: "Bas", visible: true, locked: false, opacity: 1 },
    { id: "details", name: "Detaljer", visible: true, locked: false, opacity: 1 },
  ];
}

function style(fill: string, stroke = "#3d484d", shadow = true) {
  return { fill, stroke, strokeWidth: 2, opacity: 1, shadow };
}

function box(
  id: string,
  name: string,
  width: number,
  depth: number,
  height: number,
  center: Point,
  fill: string,
  layerId = "base",
): VectorObject {
  return {
    id,
    name,
    kind: "iso-box",
    layerId,
    points: makeIsoBox(center, { x: center.x + width / 2, y: center.y + depth / 2 }, height),
    height,
    style: style(fill),
    locked: false,
    tilt: 0,
  };
}

function tile(id: string, name: string, object: VectorObject, category: string): Tile {
  return {
    id,
    name,
    category,
    tags: ["hus", "byggdel", "isometrisk"],
    collectionId: HOUSE_COLLECTION_ID,
    layers: layers(),
    collisions: [],
    objects: [object],
    anchor: {
      image: { x: TILE_CENTER.x, y: TILE_CENTER.y + 32 },
      tile: { x: TILE_CENTER.x, y: TILE_CENTER.y },
      sort: { x: TILE_CENTER.x, y: TILE_CENTER.y + 24 },
      baseline: TILE_CENTER.y + 32,
    },
    guideMode: "floor",
  };
}

export function houseCollectionTiles(): Tile[] {
  const floor: VectorObject = {
    id: "house-floor-object",
    name: "Husgolv",
    kind: "polygon",
    layerId: "base",
    points: tileDiamond(128, 64, { x: TILE_CENTER.x, y: TILE_CENTER.y + 32 }),
    height: 0,
    style: style("#8a9093", "#3d484d", false),
    cornerRadius: 3,
    locked: false,
  };
  const roof: VectorObject = {
    id: "house-roof-object",
    name: "Sadeltak",
    kind: "polygon",
    layerId: "base",
    points: [
      { x: TILE_CENTER.x, y: TILE_CENTER.y - 104 },
      { x: TILE_CENTER.x + 70, y: TILE_CENTER.y - 68 },
      { x: TILE_CENTER.x, y: TILE_CENTER.y - 32 },
      { x: TILE_CENTER.x - 70, y: TILE_CENTER.y - 68 },
    ],
    height: 0,
    style: style("#667177", "#3d484d"),
    cornerRadius: 5,
    locked: false,
    tilt: 0,
  };
  const chimney: VectorObject = {
    ...box("house-chimney-object", "Skorsten", 20, 20, 58, { x: TILE_CENTER.x + 26, y: TILE_CENTER.y - 74 }, "#737b7f"),
    kind: "iso-cylinder",
    points: makeIsoCylinder({ x: TILE_CENTER.x + 16, y: TILE_CENTER.y - 102 }, { x: TILE_CENTER.x + 36, y: TILE_CENTER.y - 42 }, 0.5),
  };
  return [
    tile("house-floor", "Husgolv", floor, "Hus · grund"),
    tile("house-wall-left", "Vägg vänster", box("house-wall-left-object", "Vägg vänster", 112, 10, 112, { x: TILE_CENTER.x - 30, y: TILE_CENTER.y + 12 }, "#9da4a7"), "Hus · vägg"),
    tile("house-wall-right", "Vägg höger", box("house-wall-right-object", "Vägg höger", 112, 10, 112, { x: TILE_CENTER.x + 30, y: TILE_CENTER.y + 12 }, "#929a9e"), "Hus · vägg"),
    tile("house-roof", "Sadeltak", roof, "Hus · tak"),
    tile("house-door", "Dörr", box("house-door-object", "Dörr", 38, 9, 76, { x: TILE_CENTER.x, y: TILE_CENTER.y + 12 }, "#59656a", "details"), "Hus · detaljer"),
    tile("house-window", "Fönster", box("house-window-object", "Fönster", 52, 8, 48, { x: TILE_CENTER.x, y: TILE_CENTER.y - 12 }, "#b8c5c8", "details"), "Hus · detaljer"),
    tile("house-chimney", "Skorsten", chimney, "Hus · tak"),
    tile("house-table", "Bord", box("house-table-object", "Bord", 58, 34, 10, { x: TILE_CENTER.x, y: TILE_CENTER.y - 8 }, "#7d878b", "details"), "Hus · möbler"),
  ];
}

export { HOUSE_COLLECTION_ID };
