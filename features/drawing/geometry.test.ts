import { describe, expect, it } from "vitest";
import { makeIsoBox, snapIsoLine, snapPoint, tileDiamond } from "./geometry";
import type { Project } from "@/types/editor";

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
  tiles: [],
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
});
