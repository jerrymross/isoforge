"use client";

import type { CollisionShape, Tile, VectorObject } from "@/types/editor";
import { collisionBounds } from "@/features/collision/collision";
import {
  objectTransform,
  pointsToString,
  tileGuideFaces,
  TILE_CENTER,
} from "@/features/drawing/geometry";
import { shade } from "@/features/tiled-export/exporters";

function uvFaceColor(object: VectorObject, face: "top" | "left" | "right"): string {
  const cells = object.uvPaint?.[face];
  if (object.uvPaint?.mode !== "cells" || !cells?.length) return object.style.fill;
  const counts = new Map<string, number>();
  cells.forEach((color) => counts.set(color, (counts.get(color) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? object.style.fill;
}

function mapUvPoint(point: { x: number; y: number }, quad: { x: number; y: number }[]) {
  if (quad.length !== 4) return point;
  const [a, b, c, d] = quad;
  const u = point.x;
  const v = point.y;
  return {
    x: a.x * (1 - u) * (1 - v) + b.x * u * (1 - v) + c.x * u * v + d.x * (1 - u) * v,
    y: a.y * (1 - u) * (1 - v) + b.y * u * (1 - v) + c.y * u * v + d.y * (1 - u) * v,
  };
}

function canonicalUvQuad(points: { x: number; y: number }[]) {
  if (points.length !== 4) return points;
  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
  let rising = 0;
  let falling = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    if (Math.abs(dx) < 0.001 || Math.abs(dy) < 0.001) return;
    if (dx * dy > 0) rising += Math.abs(dx);
    else falling += Math.abs(dx);
  });
  const ordered = [...points].sort((a, b) =>
    Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x),
  );
  const isTop = rising + falling > 0 && Math.abs(rising - falling) / (rising + falling) < 0.35;
  const start = isTop
    ? ordered.reduce((best, point, index) => point.y < ordered[best].y ? index : best, 0)
    : ordered.reduce((best, point, index) =>
        point.x < ordered[best].x || (point.x === ordered[best].x && point.y < ordered[best].y) ? index : best,
      0);
  return [...ordered.slice(start), ...ordered.slice(0, start)];
}

function uvVectorPath(points: { x: number; y: number }[], quad: { x: number; y: number }[]): string {
  if (quad.length !== 4) return "";
  return points.map((point, index) => {
    const mapped = mapUvPoint(point, quad);
    return `${index ? "L" : "M"} ${mapped.x} ${mapped.y}`;
  }).join(" ");
}

function UvCellOverlay({ object, face, quad }: { object: VectorObject; face: "top" | "left" | "right"; quad: { x: number; y: number }[] }) {
  const cells = object.uvPaint?.[face];
  const size = object.uvPaint?.size ?? 12;
  if (object.uvPaint?.mode !== "cells" || !cells?.length || quad.length !== 4) return null;
  return cells.map((color, index) => {
    const column = index % size;
    const row = Math.floor(index / size);
    const corners = [
      mapUvPoint({ x: column / size, y: row / size }, quad),
      mapUvPoint({ x: (column + 1) / size, y: row / size }, quad),
      mapUvPoint({ x: (column + 1) / size, y: (row + 1) / size }, quad),
      mapUvPoint({ x: column / size, y: (row + 1) / size }, quad),
    ];
    return <polygon key={`uv-cell-${face}-${index}`} points={pointsToString(corners)} fill={color} stroke="none" />;
  });
}

function UvVectorOverlay({ object, face, quad }: { object: VectorObject; face: "top" | "left" | "right"; quad: { x: number; y: number }[] }) {
  const vectors = object.uvPaint?.vectors?.[face] ?? [];
  const safeObjectId = object.id.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <g className="uv-vector-overlay">
      <defs>
        {vectors.map((vector, index) => vector.gradient && (
          <linearGradient key={`uv-gradient-${index}`} id={`uv-gradient-${safeObjectId}-${face}-${vector.id ?? index}`} x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform={`rotate(${vector.gradient.angle} .5 .5)`}>
            <stop offset="0" stopColor={vector.gradient.from} />
            <stop offset="1" stopColor={vector.gradient.to} />
          </linearGradient>
        ))}
      </defs>
      {vectors.map((vector, index) => {
        if (vector.visible === false) return null;
        const id = vector.id ?? index;
        const data = `${uvVectorPath(vector.points, quad)}${vector.closed ? " Z" : ""}`;
        const fill = vector.closed ? vector.gradient ? `url(#uv-gradient-${safeObjectId}-${face}-${id})` : vector.fill ?? "none" : "none";
        const width = Math.max(1, vector.width * 64);
        return (
          <g key={`uv-vector-${face}-${id}`}>
            {vector.effects?.shadow && <path d={data} fill={vector.closed ? "rgba(0,0,0,.22)" : "none"} stroke="rgba(0,0,0,.28)" strokeWidth={width} transform="translate(2 2)" />}
            {vector.effects?.bevel && <path d={data} fill="none" stroke="rgba(255,255,255,.62)" strokeWidth={width + 1.4} transform="translate(-.7 -.7)" />}
            <path d={data} fill={fill} stroke={vector.color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </g>
  );
}

type VectorShapeProps = {
  object: VectorObject;
  selected?: boolean;
  nodesInteractive?: boolean;
  layerOpacity?: number;
  onPointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
  onNodePointerDown?: (
    event: React.PointerEvent<SVGCircleElement>,
    index: number,
  ) => void;
};

export function VectorShape({
  object,
  selected,
  nodesInteractive = false,
  layerOpacity = 1,
  onPointerDown,
  onNodePointerDown,
}: VectorShapeProps) {
  const common = {
    stroke: object.style.stroke,
    strokeWidth: object.style.strokeWidth,
    opacity: object.style.opacity * layerOpacity,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <g
      data-object-id={object.id}
      className={selected ? "vector-object is-selected" : "vector-object"}
      transform={objectTransform(object)}
      onPointerDown={onPointerDown}
      style={{ cursor: object.locked ? "not-allowed" : "grab" }}
    >
      {object.kind === "line" && object.points.length >= 2 ? (
        <line
          x1={object.points[0].x}
          y1={object.points[0].y}
          x2={object.points[1].x}
          y2={object.points[1].y}
          fill="none"
          {...common}
        />
      ) : object.kind === "iso-cylinder" && object.points.length >= 4 ? (
        (() => {
          const [topCenter, radiusPoint, depthPoint, bottomCenter] = object.points;
          const radiusX = Math.abs(radiusPoint.x - topCenter.x);
          const radiusY = Math.max(3, Math.abs(depthPoint.y - topCenter.y));
          const left = topCenter.x - radiusX;
          const right = topCenter.x + radiusX;
          const bodyPath = [
            `M ${left} ${topCenter.y}`,
            `L ${left} ${bottomCenter.y}`,
            `A ${radiusX} ${radiusY} 0 0 0 ${right} ${bottomCenter.y}`,
            `L ${right} ${topCenter.y}`,
            "Z",
          ].join(" ");
          return (
            <>
              <path d={bodyPath} fill={shade(object.style.fill, -22)} {...common} />
              <ellipse
                cx={topCenter.x}
                cy={topCenter.y}
                rx={radiusX}
                ry={radiusY}
                fill={shade(object.style.fill, 14)}
                {...common}
              />
              <path
                d={`M ${left} ${bottomCenter.y} A ${radiusX} ${radiusY} 0 0 0 ${right} ${bottomCenter.y}`}
                fill="none"
                {...common}
              />
            </>
          );
        })()
      ) : object.kind === "iso-box" && object.points.length >= 7 ? (
        <>
          <polygon
            points={pointsToString([
              object.points[3],
              object.points[2],
              object.points[5],
              object.points[6],
            ])}
            fill={shade(object.style.fill, -18)}
            {...common}
          />
          <UvCellOverlay object={object} face="left" quad={[object.points[3], object.points[2], object.points[5], object.points[6]]} />
          <UvVectorOverlay object={object} face="left" quad={[object.points[3], object.points[2], object.points[5], object.points[6]]} />
          <polygon
            points={pointsToString([
              object.points[1],
              object.points[4],
              object.points[5],
              object.points[2],
            ])}
            fill={shade(object.style.fill, -32)}
            {...common}
          />
          <UvCellOverlay object={object} face="right" quad={[object.points[2], object.points[1], object.points[4], object.points[5]]} />
          <UvVectorOverlay object={object} face="right" quad={[object.points[2], object.points[1], object.points[4], object.points[5]]} />
          <polygon
            points={pointsToString(object.points.slice(0, 4))}
            fill={shade(object.style.fill, 12)}
            {...common}
          />
          <UvCellOverlay object={object} face="top" quad={object.points.slice(0, 4)} />
          <UvVectorOverlay object={object} face="top" quad={object.points.slice(0, 4)} />
        </>
      ) : (
        <>
          <polygon
            points={pointsToString(object.points)}
            fill={uvFaceColor(object, "top")}
            {...common}
          />
          {object.points.length === 4 && <UvCellOverlay object={object} face="top" quad={canonicalUvQuad(object.points)} />}
          {object.points.length === 4 && <UvVectorOverlay object={object} face="top" quad={canonicalUvQuad(object.points)} />}
        </>
      )}
      {selected && (
        <>
          <polygon
            points={pointsToString(object.points)}
            fill="none"
            stroke="#f06b45"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {object.points.map((point, index) => (
            <circle
              key={`${object.id}-${index}`}
              className={nodesInteractive ? "vector-node is-interactive" : "vector-node"}
              cx={point.x}
              cy={point.y}
              r={nodesInteractive ? 6 : 4}
              fill="#fffaf0"
              stroke="#f06b45"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              pointerEvents={nodesInteractive ? "all" : "none"}
              onPointerDown={
                nodesInteractive
                  ? (event) => onNodePointerDown?.(event, index)
                  : undefined
              }
            />
          ))}
        </>
      )}
    </g>
  );
}

type CollisionShapeProps = {
  collision: CollisionShape;
  selected?: boolean;
  compact?: boolean;
  onPointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
};

export function CollisionShapeView({
  collision,
  selected,
  compact,
  onPointerDown,
}: CollisionShapeProps) {
  const bounds = collisionBounds(collision);
  return (
    <g
      className={[
        "collision-shape",
        selected ? "is-selected" : "",
        compact ? "is-compact" : "",
      ].join(" ")}
      data-collision-id={collision.id}
      onPointerDown={onPointerDown}
    >
      {collision.kind === "ellipse" ? (
        <ellipse
          cx={bounds.x + bounds.width / 2}
          cy={bounds.y + bounds.height / 2}
          rx={bounds.width / 2}
          ry={bounds.height / 2}
        />
      ) : (
        <polygon points={pointsToString(collision.points)} />
      )}
      {selected &&
        collision.points.map((point, index) => (
          <circle
            key={`${collision.id}-${index}`}
            className="collision-node"
            cx={point.x}
            cy={point.y}
            r="4"
            pointerEvents="none"
          />
        ))}
    </g>
  );
}

type GuideLayerProps = {
  tile: Tile;
  tileWidth: number;
  tileHeight: number;
  compact?: boolean;
  showGuides?: boolean;
  showAnchors?: boolean;
};

export function GuideLayer({
  tile,
  tileWidth,
  tileHeight,
  compact,
  showGuides = true,
  showAnchors = true,
}: GuideLayerProps) {
  const guideFaces = tileGuideFaces(
    tile.guideMode ?? "floor",
    tileWidth,
    tileHeight,
    tile.anchor.baseline,
  );
  const guidePoints = guideFaces.flat();
  const guideCenterY =
    guidePoints.reduce((sum, point) => sum + point.y, 0) /
    guidePoints.length;
  const guideCenterX =
    guidePoints.reduce((sum, point) => sum + point.x, 0) /
    guidePoints.length;
  const guideOffsetY = guideCenterY - TILE_CENTER.y;
  const guideOffsetX = guideCenterX - TILE_CENTER.x;
  return (
    <g className="guide-layer" pointerEvents="none">
      {showGuides && (
        <>
          <g className="tile-guide-volume">
            {guideFaces.map((face, index) => (
              <polygon
                key={`${tile.guideMode ?? "floor"}-${index}`}
                points={pointsToString(face)}
                className="tile-guide"
              />
            ))}
          </g>
          <line
            x1={guideCenterX}
            y1={(compact ? 250 : 100) + guideOffsetY}
            x2={guideCenterX}
            y2={(compact ? 360 : 410) + guideOffsetY}
            className="center-guide"
          />
          {!compact && (
            <>
              <line x1={50 + guideOffsetX} y1={439 + guideOffsetY} x2={590 + guideOffsetX} y2={169 + guideOffsetY} className="iso-guide" />
              <line x1={50 + guideOffsetX} y1={169 + guideOffsetY} x2={590 + guideOffsetX} y2={439 + guideOffsetY} className="iso-guide" />
              <rect x={192 + guideOffsetX} y={128 + guideOffsetY} width="256" height="256" className="export-guide" />
            </>
          )}
        </>
      )}
      {showAnchors && (
        <>
          <line
            x1={TILE_CENTER.x - 150}
            y1={tile.anchor.baseline}
            x2={TILE_CENTER.x + 150}
            y2={tile.anchor.baseline}
            className="baseline-guide"
          />
          <g transform={`translate(${tile.anchor.image.x} ${tile.anchor.image.y})`}>
            <circle r="7" className="anchor-ring" />
            <path d="M -11 0 H 11 M 0 -11 V 11" className="anchor-cross" />
          </g>
          <g transform={`translate(${tile.anchor.sort.x} ${tile.anchor.sort.y})`}>
            <path d="M 0 -7 L 7 0 L 0 7 L -7 0 Z" className="sort-anchor" />
            {!compact && <text x="11" y="3" className="sort-anchor-label">SORT</text>}
          </g>
        </>
      )}
    </g>
  );
}
