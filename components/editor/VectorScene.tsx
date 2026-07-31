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
  if (!cells?.length) return object.style.fill;
  const activeColor = object.uvPaint?.activeColor?.[face];
  if (activeColor) return activeColor;
  const counts = new Map<string, number>();
  cells.forEach((color) => counts.set(color, (counts.get(color) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? object.style.fill;
}

function paintPatternId(object: VectorObject, face: "top" | "left" | "right") {
  return `uv-${object.id.replace(/[^a-zA-Z0-9_-]/g, "")}-${face}`;
}

function UvPattern({ object, face }: { object: VectorObject; face: "top" | "left" | "right" }) {
  const cells = object.uvPaint?.[face];
  const size = object.uvPaint?.size ?? 12;
  if (!cells?.length) return null;
  return (
    <pattern
      id={paintPatternId(object, face)}
      patternUnits="objectBoundingBox"
      patternContentUnits="userSpaceOnUse"
      width="1"
      height="1"
      viewBox={`0 0 ${size} ${size}`}
    >
      {cells.map((color, index) => (
        <rect
          key={`${face}-${index}`}
          x={index % size}
          y={Math.floor(index / size)}
          width="1"
          height="1"
          fill={color}
        />
      ))}
      {(object.uvPaint?.vectors?.[face] ?? []).map((vector, index) => (
        <path
          key={`vector-${face}-${index}`}
          d={vector.points.map((point, pointIndex) => `${pointIndex ? "L" : "M"} ${point.x * size} ${point.y * size}`).join(" ")}
          fill="none"
          stroke={vector.color}
          strokeWidth={vector.width * size}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </pattern>
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
      {object.uvPaint && (
        <defs>
          <UvPattern object={object} face="top" />
          <UvPattern object={object} face="left" />
          <UvPattern object={object} face="right" />
        </defs>
      )}
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
            fill={object.uvPaint ? `url(#${paintPatternId(object, "left")})` : shade(object.style.fill, -18)}
            {...common}
          />
          <polygon
            points={pointsToString([
              object.points[1],
              object.points[4],
              object.points[5],
              object.points[2],
            ])}
            fill={object.uvPaint ? `url(#${paintPatternId(object, "right")})` : shade(object.style.fill, -32)}
            {...common}
          />
          <polygon
            points={pointsToString(object.points.slice(0, 4))}
            fill={object.uvPaint ? `url(#${paintPatternId(object, "top")})` : shade(object.style.fill, 12)}
            {...common}
          />
        </>
      ) : (
        <polygon
          points={pointsToString(object.points)}
          fill={object.uvPaint ? `url(#${paintPatternId(object, "top")})` : uvFaceColor(object, "top")}
          {...common}
        />
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
