import { describe, expect, it } from "vitest";
import {
  autoPlaceObjects,
  autoSizeObjects,
  autoSizeObjectsToTile,
  isoGridOffset,
  makeIsoBox,
  normalizeAngle,
  normalizeTilt,
  objectBounds,
  objectRotationTransform,
  objectTiltTransform,
  objectTransform,
  penPathData,
  samplePenPath,
  snapObjectAngle,
  snapObjectTilt,
  snapIsoLine,
  snapPoint,
  snapPointToGrid,
  snapPointToTargets,
  scaleObjectFromPivot,
  tileDiamond,
  tileGuidePolygon,
  tileGuideFaces,
  TILED_ISOMETRIC_TILT,
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

  it("keeps guide modes on isometric angles", () => {
    const floor = tileGuidePolygon("floor", 128, 64, 336);
    const raised = tileGuidePolygon("floor-object", 128, 64, 336);
    const wallLeft = tileGuidePolygon("wall-left", 128, 64, 336);
    const wallRight = tileGuidePolygon("wall-right", 128, 64, 336);
    expect(floor[2].y).toBe(336);
    expect(raised[2].y).toBe(272);
    expect(wallLeft[1].x - wallLeft[0].x).toBe(64);
    expect(wallLeft[1].y - wallLeft[0].y).toBe(32);
    expect(wallRight[1].x - wallRight[0].x).toBe(64);
    expect(wallRight[1].y - wallRight[0].y).toBe(-32);
  });

  it("shows every face of a raised block and half-depth walls", () => {
    const floorFaces = tileGuideFaces("floor", 128, 64, 336);
    const blockFaces = tileGuideFaces("floor-object", 128, 64, 336);
    const wallLeftFaces = tileGuideFaces("wall-left", 128, 64, 336);
    const wallRightFaces = tileGuideFaces("wall-right", 128, 64, 336);

    expect(floorFaces).toHaveLength(5);
    expect(blockFaces).toHaveLength(5);
    expect(floorFaces[0][2].y).toBe(336);
    expect(floorFaces[1][2].y - floorFaces[1][1].y).toBe(32);
    expect(blockFaces[0][2].y).toBe(272);
    expect(floorFaces[0]).toEqual(tileDiamond(128, 64, { x: 320, y: 304 }));
    expect(floorFaces[0]).toEqual([
      blockFaces[1][3],
      blockFaces[1][2],
      blockFaces[2][2],
      blockFaces[3][2],
    ]);
    expect(wallLeftFaces).toHaveLength(6);
    expect(wallRightFaces).toHaveLength(6);
    expect(wallLeftFaces[1][0].x - wallLeftFaces[0][0].x).toBe(32);
    expect(wallLeftFaces[1][0].y - wallLeftFaces[0][0].y).toBe(-16);
    expect(wallRightFaces[1][0].x - wallRightFaces[0][0].x).toBe(-32);
    expect(wallRightFaces[1][0].y - wallRightFaces[0][0].y).toBe(-16);
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

  it("snaps to normal and dense drawing grids", () => {
    expect(snapPointToGrid({ x: 27, y: 37 }, 16)).toEqual({ x: 32, y: 32 });
    expect(snapPointToGrid({ x: 27, y: 37 }, 8)).toEqual({ x: 24, y: 40 });
  });

  it("prioritizes nearby drawing targets", () => {
    expect(
      snapPointToTargets(
        { x: 29, y: 34 },
        [{ x: 30, y: 32 }, { x: 80, y: 80 }],
        8,
      ),
    ).toEqual({ x: 30, y: 32 });
  });

  it("builds straight and curved pen paths", () => {
    expect(
      penPathData([
        { point: { x: 0, y: 0 } },
        { point: { x: 20, y: 0 } },
      ]),
    ).toBe("M 0 0 L 20 0");
    const curved = [
      { point: { x: 0, y: 0 }, outHandle: { x: 10, y: -10 } },
      { point: { x: 20, y: 0 }, inHandle: { x: 10, y: 10 } },
      { point: { x: 10, y: 20 } },
    ];
    expect(penPathData(curved, true)).toContain("C 10 -10 10 10 20 0");
    expect(penPathData(curved, true).endsWith("Z")).toBe(true);
    const sampled = samplePenPath(curved, true, 4);
    expect(sampled.length).toBeGreaterThan(3);
    expect(sampled).toContainEqual(curved[0].point);
    expect(sampled).toContainEqual(curved[1].point);
    expect(sampled).toContainEqual(curved[2].point);
  });

  it("places neighboring tile diamonds exactly edge to edge", () => {
    const center = tileDiamond(128, 64);
    const offset = isoGridOffset(1, 0, 128, 64);
    const neighbor = tileDiamond(128, 64).map((point) => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
    }));
    expect(center[1]).toEqual(neighbor[0]);
    expect(center[2]).toEqual(neighbor[3]);
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

  it("auto-fits a flat tile exactly to the live preview diamond", () => {
    const floor: VectorObject = {
      ...square,
      points: tileDiamond(128, 64),
    };
    const [sized] = autoSizeObjectsToTile([floor], {
      tileWidth: 128,
      tileHeight: 64,
      baseline: 336,
    });
    const bounds = objectBounds([sized])!;
    expect(bounds.width).toBe(128);
    expect(bounds.height).toBe(64);
    expect(bounds.maxY).toBe(336);
  });

  it("keeps raised objects inside one preview tile footprint", () => {
    const [sized] = autoSizeObjectsToTile([{ ...square, height: 80 }], {
      tileWidth: 128,
      tileHeight: 64,
      baseline: 336,
    });
    const bounds = objectBounds([sized])!;
    expect(bounds.width).toBeCloseTo(128);
    expect(bounds.maxY).toBe(336);
  });

  it("scales an object uniformly around the opposite handle", () => {
    const scaled = scaleObjectFromPivot(square, { x: 20, y: 20 }, 2);
    expect(scaled.points[0]).toEqual({ x: 20, y: 20 });
    expect(scaled.points[2]).toEqual({ x: 220, y: 220 });
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

  it("creates a forward Tiled tilt separately from rotation", () => {
    expect(snapObjectTilt(25)).toBe(TILED_ISOMETRIC_TILT);
    expect(normalizeTilt(90)).toBe(75);
    expect(objectTiltTransform({ ...square, tilt: TILED_ISOMETRIC_TILT })).toBe(
      "translate(70 120) scale(1 0.894428) translate(-70 -120)",
    );
    const combined = objectTransform({
      ...square,
      rotation: 90,
      tilt: TILED_ISOMETRIC_TILT,
    });
    expect(combined).toContain("rotate(90 70 70)");
    expect(combined).toContain("scale(1 0.894428)");
  });
});
