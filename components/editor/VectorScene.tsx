"use client";

import type { Tile, VectorObject } from "@/types/editor";
import { pointsToString, tileDiamond, TILE_CENTER } from "@/features/drawing/geometry";
import { shade } from "@/features/tiled-export/exporters";

type VectorShapeProps = {
  object: VectorObject;
  selected?: boolean;
  onPointerDown?: (event: React.PointerEvent<SVGGElement>) => void;
};

export function VectorShape({ object, selected, onPointerDown }: VectorShapeProps) {
  const common = {
    stroke: object.style.stroke,
    strokeWidth: object.style.strokeWidth,
    opacity: object.style.opacity,
    strokeLinejoin: "round" as const,
    vectorEffect: "non-scaling-stroke" as const,
  };
  return (
    <g
      data-object-id={object.id}
      className={selected ? "vector-object is-selected" : "vector-object"}
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
          <polygon
            points={pointsToString(object.points.slice(0, 4))}
            fill={shade(object.style.fill, 12)}
            {...common}
          />
        </>
      ) : (
        <polygon points={pointsToString(object.points)} fill={object.style.fill} {...common} />
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
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#fffaf0"
              stroke="#f06b45"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          ))}
        </>
      )}
    </g>
  );
}

type GuideLayerProps = {
  tile: Tile;
  tileWidth: number;
  tileHeight: number;
  compact?: boolean;
};

export function GuideLayer({ tile, tileWidth, tileHeight, compact }: GuideLayerProps) {
  const diamond = tileDiamond(tileWidth, tileHeight);
  return (
    <g className="guide-layer" pointerEvents="none">
      <polygon points={pointsToString(diamond)} className="tile-guide" />
      <line
        x1={TILE_CENTER.x}
        y1={compact ? 250 : 100}
        x2={TILE_CENTER.x}
        y2={compact ? 360 : 410}
        className="center-guide"
      />
      <line
        x1={TILE_CENTER.x - 150}
        y1={tile.anchor.baseline}
        x2={TILE_CENTER.x + 150}
        y2={tile.anchor.baseline}
        className="baseline-guide"
      />
      {!compact && (
        <>
          <line x1={50} y1={439} x2={590} y2={169} className="iso-guide" />
          <line x1={50} y1={169} x2={590} y2={439} className="iso-guide" />
          <rect x="192" y="128" width="256" height="256" className="export-guide" />
        </>
      )}
      <g transform={`translate(${tile.anchor.image.x} ${tile.anchor.image.y})`}>
        <circle r="7" className="anchor-ring" />
        <path d="M -11 0 H 11 M 0 -11 V 11" className="anchor-cross" />
      </g>
    </g>
  );
}
