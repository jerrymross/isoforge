import { describe, expect, it } from "vitest";
import {
  autoPlaceObjects,
  autoSizeObjects,
  isoGridOffset,
  makeIsoBox,
  normalizeAngle,
  objectRotationTransform,
  snapObjectAngle,
  snapIsoLine,
  snapPoint,
  tileDiamond,
} from "./geometry";
import type { Project } from "@/types/editor";
import type { VectorObject } from "@/types/editor";

const project: Project = {
  id: "test",
  name: "Test",
  tileWidth: 128,
  tileHeight: 64,
  canvasWidth: 128,
  canvasHeight: 192,
  projection: "isometric-2-1",
  activeTileId: "tile",
  updatedAt: "2026-01-01T00:00:00.000Z",
  style: {
    strokeWidth: 2,
    strokeColor: "#000000",
    fillColor: "#ffffff",
    lightDirection: "top-left",
  },
  collections: [],
  tiles: [],
};

const square: VectorObject = {
  id: "square",
  name: "Square",
  kind: "polygon",
  layerId: "base",
  points: [
    { x: 20, y: 20 },
    { x: 120, y: 20 },
    { x: 120, y: 120 },
    { x: 20, y: 120 },
  ],
  height: 0,
  style: {
    fill: "#ffffff",
    stroke: "#000000",
    strokeWidth: 2,
    opacity: 1,
    shadow: false,
  },
  locked: false,
};

describe("isometrisk geometri", () => {
  it("skapar en exakt 2:1-diamant", () => {
    const points = tileDiamond(128, 64);
    expect(points[0]).toEqual({ x: 320, y: 272 });
    expect(points[1]).toEqual({ x: 384, y: 304 });
  });

  it("låser linjer till en isometrisk vinkel", () => {
    const result = snapIsoLine({ x: 0, y: 0 }, { x: 100, y: 44 });
    expect(result.angle).toBe(26.565);
    expect(result.point.x).toBeGreaterThan(result.point.y);
  });

  it("snappar nära ett tilehörn", () => {
    expect(snapPoint({ x: 383, y: 306 }, project)).toEqual({ x: 384, y: 304 });
  });

  it("bygger sju kontrollpunkter för en box", () => {
    expect(makeIsoBox({ x: 320, y: 280 }, { x: 380, y: 310 }, 72)).toHaveLength(7);
  });

  it("placerar rader både framför och bakom i isometriskt djup", () => {
    expect(isoGridOffset(0, -1, 128, 64)).toEqual({ x: 64, y: -32 });
    expect(isoGridOffset(0, 1, 128, 64)).toEqual({ x: -64, y: 32 });
  });

  it("autoplacerar gruppen centrerat mot baslinjen", () => {
    const [placed] = autoPlaceObjects([square], 320, 336);
    expect(placed.points[0]).toEqual({ x: 270, y: 236 });
    expect(placed.points[2]).toEqual({ x: 370, y: 336 });
  });

  it("autoanpassar proportionellt utan att förvränga formen", () => {
    const [sized] = autoSizeObjects([square], {
      centerX: 320,
      baseline: 336,
      maxWidth: 200,
      maxHeight: 100,
    });
    const width = sized.points[1].x - sized.points[0].x;
    const height = sized.points[3].y - sized.points[0].y;
    expect(width).toBe(100);
    expect(height).toBe(100);
    expect(sized.points[2].y).toBe(336);
  });

  it("snaps free rotation to the nearest isometric direction", () => {
    expect(snapObjectAngle(24)).toBe(26.565);
    expect(snapObjectAngle(101)).toBe(90);
    expect(normalizeAngle(450)).toBe(90);
  });

  it("creates an SVG rotation around the object center", () => {
    expect(objectRotationTransform({ ...square, rotation: 90 })).toBe(
      "rotate(90 70 70)",
    );
  });
});
