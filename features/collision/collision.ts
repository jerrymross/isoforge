import type {
  CollisionKind,
  CollisionShape,
  Point,
} from "@/types/editor";

export type CollisionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const labels: Record<CollisionKind, string> = {
  rectangle: "Rektangel",
  polygon: "Polygon",
  ellipse: "Ellips",
  diamond: "ISO-diamant",
};

function boundsPoints(bounds: CollisionBounds): Point[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
}

export function createCollisionShape(
  kind: CollisionKind,
  id = crypto.randomUUID(),
): CollisionShape {
  const bounds = { x: 264, y: 280, width: 112, height: 56 };
  let points = boundsPoints(bounds);
  if (kind === "diamond") {
    points = [
      { x: 320, y: 280 },
      { x: 376, y: 308 },
      { x: 320, y: 336 },
      { x: 264, y: 308 },
    ];
  } else if (kind === "polygon") {
    points = [
      { x: 276, y: 288 },
      { x: 364, y: 288 },
      { x: 376, y: 324 },
      { x: 320, y: 338 },
      { x: 264, y: 324 },
    ];
  }
  return { id, name: labels[kind], kind, points, enabled: true };
}

export function collisionBounds(shape: CollisionShape): CollisionBounds {
  const xs = shape.points.map((point) => point.x);
  const ys = shape.points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

export function resizeCollision(
  shape: CollisionShape,
  patch: Partial<CollisionBounds>,
): CollisionShape {
  const previous = collisionBounds(shape);
  const next = {
    x: patch.x ?? previous.x,
    y: patch.y ?? previous.y,
    width: Math.max(1, patch.width ?? previous.width),
    height: Math.max(1, patch.height ?? previous.height),
  };
  const points = shape.points.map((point) => ({
    x:
      next.x +
      ((point.x - previous.x) / Math.max(1, previous.width)) * next.width,
    y:
      next.y +
      ((point.y - previous.y) / Math.max(1, previous.height)) * next.height,
  }));
  return { ...shape, points };
}

export function isValidCollision(shape: CollisionShape): boolean {
  const minimum = shape.kind === "polygon" || shape.kind === "diamond" ? 3 : 2;
  const bounds = collisionBounds(shape);
  return (
    shape.points.length >= minimum &&
    shape.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}
