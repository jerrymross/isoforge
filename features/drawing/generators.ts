import { makeIsoBox, TILE_CENTER } from "./geometry";
import type { Point, VectorObject, VectorStyle } from "@/types/editor";

export type PrimitiveKind = "floor" | "box" | "cylinder";
export type ObjectTemplate = "workbench" | "shelf" | "cabinet" | "wall";

export type GeneratorParams = {
  width: number;
  depth: number;
  height: number;
  shelves: number;
};

function objectStyle(fill: string, stroke: string): VectorStyle {
  return {
    fill,
    stroke,
    strokeWidth: 2,
    opacity: 1,
    shadow: true,
  };
}

export function makeFloorVector(
  id: string,
  width: number,
  depth: number,
  fill: string,
  stroke: string,
): VectorObject {
  return {
    id,
    name: "2D-golv → isometrisk yta",
    kind: "polygon",
    layerId: "base",
    points: [
      { x: TILE_CENTER.x, y: TILE_CENTER.y - depth / 2 },
      { x: TILE_CENTER.x + width / 2, y: TILE_CENTER.y },
      { x: TILE_CENTER.x, y: TILE_CENTER.y + depth / 2 },
      { x: TILE_CENTER.x - width / 2, y: TILE_CENTER.y },
    ],
    height: 0,
    style: { ...objectStyle(fill, stroke), shadow: false },
    locked: false,
  };
}

export function makeBoxVector(
  id: string,
  name: string,
  width: number,
  depth: number,
  height: number,
  fill: string,
  stroke: string,
  center: Point = TILE_CENTER,
): VectorObject {
  return {
    id,
    name,
    kind: "iso-box",
    layerId: "base",
    points: makeIsoBox(
      center,
      { x: center.x + width / 2, y: center.y + depth / 2 },
      height,
    ),
    height,
    style: objectStyle(fill, stroke),
    locked: false,
  };
}

export function makeCylinderVector(
  id: string,
  diameter: number,
  depth: number,
  height: number,
  fill: string,
  stroke: string,
): VectorObject {
  const topCenter = { x: TILE_CENTER.x, y: TILE_CENTER.y - height };
  return {
    id,
    name: "Isometrisk cylinder",
    kind: "iso-cylinder",
    layerId: "base",
    points: [
      topCenter,
      { x: topCenter.x + diameter / 2, y: topCenter.y },
      { x: topCenter.x, y: topCenter.y + depth / 4 },
      { x: TILE_CENTER.x, y: TILE_CENTER.y },
    ],
    height,
    style: objectStyle(fill, stroke),
    locked: false,
  };
}

export function primitiveObjects(
  kind: PrimitiveKind,
  params: GeneratorParams,
  fill: string,
  stroke: string,
): VectorObject[] {
  if (kind === "floor") {
    return [makeFloorVector("preview-floor", params.width, params.depth, fill, stroke)];
  }
  if (kind === "cylinder") {
    return [
      makeCylinderVector(
        "preview-cylinder",
        params.width,
        params.depth,
        params.height,
        fill,
        stroke,
      ),
    ];
  }
  return [
    makeBoxVector(
      "preview-box",
      "2D-låda → isometrisk box",
      params.width,
      params.depth,
      params.height,
      fill,
      stroke,
    ),
  ];
}

function at(
  object: VectorObject,
  id: string,
  name: string,
  dx: number,
  dy: number,
): VectorObject {
  return {
    ...object,
    id,
    name,
    points: object.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  };
}

export function templateObjects(
  template: ObjectTemplate,
  params: GeneratorParams,
  fill: string,
  stroke: string,
): VectorObject[] {
  const { width, depth, height } = params;
  if (template === "wall") {
    return [
      makeBoxVector(
        "preview-wall",
        "Parametrisk vägg",
        width,
        Math.max(8, depth * 0.22),
        height,
        fill,
        stroke,
      ),
    ];
  }

  if (template === "cabinet") {
    const body = makeBoxVector(
      "preview-cabinet",
      "Skåpstomme",
      width,
      depth,
      height,
      fill,
      stroke,
    );
    const handle: VectorObject = {
      id: "preview-handle",
      name: "Skåphandtag",
      kind: "line",
      layerId: "details",
      points: [
        { x: TILE_CENTER.x + width * 0.17, y: TILE_CENTER.y - height * 0.48 },
        { x: TILE_CENTER.x + width * 0.17, y: TILE_CENTER.y - height * 0.28 },
      ],
      height: 0,
      style: { ...objectStyle("#d8ddd9", stroke), strokeWidth: 3, shadow: false },
      locked: false,
    };
    return [body, handle];
  }

  if (template === "shelf") {
    const sideWidth = Math.max(7, width * 0.08);
    const side = makeBoxVector(
      "preview-shelf-side",
      "Hyllgavel",
      sideWidth,
      depth,
      height,
      fill,
      stroke,
    );
    const objects: VectorObject[] = [
      at(side, "preview-shelf-left", "Vänster gavel", -width * 0.42, 0),
      at(side, "preview-shelf-right", "Höger gavel", width * 0.42, 0),
    ];
    const shelfCount = Math.max(2, Math.min(5, params.shelves));
    for (let index = 0; index < shelfCount; index += 1) {
      const elevation = (height * index) / (shelfCount - 1);
      const shelf = makeBoxVector(
        `preview-shelf-${index}`,
        `Hyllplan ${index + 1}`,
        width,
        depth,
        6,
        fill,
        stroke,
        { x: TILE_CENTER.x, y: TILE_CENTER.y - elevation + 6 },
      );
      objects.push(shelf);
    }
    return objects;
  }

  const topThickness = Math.max(8, height * 0.12);
  const top = makeBoxVector(
    "preview-worktop",
    "Arbetsyta",
    width,
    depth,
    topThickness,
    fill,
    stroke,
    {
      x: TILE_CENTER.x,
      y: TILE_CENTER.y - height + topThickness,
    },
  );
  const legHeight = Math.max(16, height - topThickness);
  const leg = makeBoxVector(
    "preview-leg",
    "Ben",
    Math.max(7, width * 0.08),
    Math.max(6, depth * 0.12),
    legHeight,
    fill,
    stroke,
  );
  return [
    top,
    at(leg, "preview-leg-1", "Ben fram vänster", -width * 0.34, depth * 0.24),
    at(leg, "preview-leg-2", "Ben fram höger", width * 0.34, depth * 0.24),
    at(leg, "preview-leg-3", "Ben bak vänster", -width * 0.34, -depth * 0.24),
    at(leg, "preview-leg-4", "Ben bak höger", width * 0.34, -depth * 0.24),
  ];
}

export function finalizeGeneratedObjects(
  objects: VectorObject[],
  idFactory: () => string,
): VectorObject[] {
  return objects.map((object) => ({ ...object, id: idFactory() }));
}
