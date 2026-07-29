import type { Point, Project, VectorObject } from "@/types/editor";

export const CANVAS_VIEWBOX = { width: 640, height: 480 };
export const TILE_CENTER: Point = { x: 320, y: 304 };

export function tileDiamond(width: number, height: number, center = TILE_CENTER): Point[] {
  return [
    { x: center.x, y: center.y - height / 2 },
    { x: center.x + width / 2, y: center.y },
    { x: center.x, y: center.y + height / 2 },
    { x: center.x - width / 2, y: center.y },
  ];
}

export function pointsToString(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function isoGridOffset(
  column: number,
  row: number,
  tileWidth: number,
  tileHeight: number,
): Point {
  return {
    x: ((column - row) * tileWidth) / 2,
    y: ((column + row) * tileHeight) / 2,
  };
}

export function snapPoint(point: Point, project: Project, threshold = 10): Point {
  const diamond = tileDiamond(project.tileWidth, project.tileHeight);
  const targets = [
    ...diamond,
    TILE_CENTER,
    { x: TILE_CENTER.x, y: TILE_CENTER.y + project.tileHeight / 2 },
  ];
  let result = { ...point };
  let best = threshold;
  for (const target of targets) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < best) {
      result = { ...target };
      best = distance;
    }
  }
  return result;
}

export function snapIsoLine(start: Point, end: Point): { point: Point; angle: number } {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const allowed = [0, 26.565, 90, 153.435, 180, -153.435, -90, -26.565];
  let snappedAngle = allowed[0];
  let smallest = Number.POSITIVE_INFINITY;
  for (const candidate of allowed) {
    const difference = Math.abs(
      ((((angle - candidate) % 360) + 540) % 360) - 180,
    );
    if (difference < smallest) {
      smallest = difference;
      snappedAngle = candidate;
    }
  }
  const radians = (snappedAngle * Math.PI) / 180;
  return {
    point: {
      x: start.x + Math.cos(radians) * length,
      y: start.y + Math.sin(radians) * length,
    },
    angle: snappedAngle,
  };
}

export function makeIsoBox(
  start: Point,
  end: Point,
  height: number,
): VectorObject["points"] {
  const halfWidth = Math.max(3, Math.abs(end.x - start.x));
  const halfDepth = Math.max(2, Math.abs(end.y - start.y));
  const cx = start.x;
  const cy = start.y;
  return [
    { x: cx, y: cy - halfDepth - height },
    { x: cx + halfWidth, y: cy - height },
    { x: cx, y: cy + halfDepth - height },
    { x: cx - halfWidth, y: cy - height },
    { x: cx + halfWidth, y: cy },
    { x: cx, y: cy + halfDepth },
    { x: cx - halfWidth, y: cy },
  ];
}

export function translateObject(object: VectorObject, dx: number, dy: number): VectorObject {
  return {
    ...object,
    points: object.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
  };
}

export type ObjectBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export function objectBounds(objects: VectorObject[]): ObjectBounds | null {
  const points = objects.flatMap((object) => {
    if (object.kind !== "iso-cylinder" || object.points.length < 4) {
      return object.points;
    }
    const [topCenter, radiusPoint, depthPoint, bottomCenter] = object.points;
    const radiusX = Math.abs(radiusPoint.x - topCenter.x);
    const radiusY = Math.max(3, Math.abs(depthPoint.y - topCenter.y));
    return [
      ...object.points,
      { x: topCenter.x - radiusX, y: topCenter.y - radiusY },
      { x: topCenter.x + radiusX, y: topCenter.y + radiusY },
      { x: bottomCenter.x - radiusX, y: bottomCenter.y - radiusY },
      { x: bottomCenter.x + radiusX, y: bottomCenter.y + radiusY },
    ];
  });
  if (!points.length) return null;
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function autoPlaceObjects(
  objects: VectorObject[],
  centerX = TILE_CENTER.x,
  baseline = TILE_CENTER.y + 32,
): VectorObject[] {
  const bounds = objectBounds(objects);
  if (!bounds) return objects;
  const dx = centerX - (bounds.minX + bounds.maxX) / 2;
  const dy = baseline - bounds.maxY;
  return objects.map((object) => translateObject(object, dx, dy));
}

export function autoSizeObjects(
  objects: VectorObject[],
  options: {
    centerX?: number;
    baseline?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {},
): VectorObject[] {
  const bounds = objectBounds(objects);
  if (!bounds) return objects;
  const centerX = options.centerX ?? TILE_CENTER.x;
  const baseline = options.baseline ?? TILE_CENTER.y + 32;
  const maxWidth = options.maxWidth ?? 232;
  const maxHeight = options.maxHeight ?? 196;
  const scale = Math.min(maxWidth / bounds.width, maxHeight / bounds.height);
  const targetLeft = centerX - (bounds.width * scale) / 2;
  const targetTop = baseline - bounds.height * scale;
  return objects.map((object) => ({
    ...object,
    height: object.height * scale,
    points: object.points.map((point) => ({
      x: targetLeft + (point.x - bounds.minX) * scale,
      y: targetTop + (point.y - bounds.minY) * scale,
    })),
  }));
}

export function validateProject(project: Project): string[] {
  const tile = project.tiles.find((item) => item.id === project.activeTileId);
  if (!tile) return ["Aktiv tile saknas"];
  const issues: string[] = [];
  if (tile.objects.length === 0) issues.push("Tilen saknar ritobjekt");
  if (!tile.anchor.image) issues.push("Bildankare saknas");
  for (const object of tile.objects) {
    if (object.kind === "polygon" && object.points.length < 3) {
      issues.push(`${object.name} är inte en sluten form`);
    }
    if (
      object.points.some(
        (point) =>
          point.x < 0 ||
          point.y < 0 ||
          point.x > CANVAS_VIEWBOX.width ||
          point.y > CANVAS_VIEWBOX.height,
      )
    ) {
      issues.push(`${object.name} ligger utanför exportytan`);
    }
  }
  return issues;
}
