"use client";

import { useEffect, useRef, useState } from "react";
import {
  CornerUpLeft,
  Crosshair,
  Eye,
  EyeOff,
  Grid2x2,
  Magnet,
  Maximize2,
  Minus,
  MoveDown,
  Plus,
  X,
} from "lucide-react";
import {
  constrainEllipseToRatio,
  ellipseFromBounds,
  makeIsoBox,
  makeIsoCylinder,
  objectBounds,
  penPathData,
  samplePenPath,
  snapIsoLine,
  snapPoint,
  snapPointToGrid,
  snapPointToTargets,
  TILE_CENTER,
  tileGuidePolygon,
} from "@/features/drawing/geometry";
import { sortObjectsByLayer } from "@/features/layers/layer-order";
import { useEditorStore } from "@/stores/editor-store";
import type { PenNode, Point, VectorObject } from "@/types/editor";
import { CollisionShapeView, GuideLayer, VectorShape } from "./VectorScene";

type CanvasViewBox = { x: number; y: number; width: number; height: number };
type AnchorHandle = "image" | "tile" | "sort" | "baseline";

function clientPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  viewBox: CanvasViewBox,
): Point {
  const screenMatrix = svg.getScreenCTM();
  if (screenMatrix) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(
      screenMatrix.inverse(),
    );
    return { x: point.x, y: point.y };
  }
  const rect = svg.getBoundingClientRect();
  return {
    x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
    y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
  };
}

function eventPoint(
  event: React.PointerEvent<SVGSVGElement>,
  viewBox: CanvasViewBox,
): Point {
  return clientPoint(
    event.currentTarget,
    event.clientX,
    event.clientY,
    viewBox,
  );
}

export function EditorCanvas() {
  const {
    project,
    tool,
    workspaceMode,
    selectedObjectId,
    selectedObjectIds,
    selectedCollisionId,
    selectedLayerId,
    showGuides,
    showAnchors,
    showCollisions,
    proportionalNodes,
    canvasZoom,
    gridSnap,
    denseGrid,
    selectObject,
    selectCollision,
    addObject,
    moveObject,
    moveObjects,
    scaleObject,
    beginContinuousEdit,
    moveAnchorPoint,
    moveBaseline,
    setCanvasZoom,
    setGridSnap,
    setDenseGrid,
    toggleGuides,
    toggleAnchors,
    autoPlaceSelected,
    autoTiltSelected,
    autoSizeSelected,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const [start, setStart] = useState<Point | null>(null);
  const [draft, setDraft] = useState<Point[] | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [penNodes, setPenNodes] = useState<PenNode[]>([]);
  const [penPointer, setPenPointer] = useState<Point | null>(null);
  const penDragRef = useRef<{ index: number; origin: Point } | null>(null);
  const dragRef = useRef<{
    start: Point;
    objects: Array<{ id: string; points: Point[] }>;
  } | null>(null);
  const anchorDragRef = useRef<AnchorHandle | null>(null);
  const scaleDragRef = useRef<{
    id: string;
    source: VectorObject;
    pivot: Point;
    startHandle: Point;
  } | null>(null);
  const nodeDragRef = useRef<{
    id: string;
    source: VectorObject;
    pivot: Point;
    startDistance: number;
    coordinateElement: SVGGraphicsElement;
    pointIndex: number;
    proportional: boolean;
  } | null>(null);
  const viewBox: CanvasViewBox = {
    width: 640 / canvasZoom,
    height: 480 / canvasZoom,
    x: 320 - 320 / canvasZoom,
    y: 240 - 240 / canvasZoom,
  };
  const gridSize = denseGrid ? 8 : 16;

  function snapToCanvasGrid(point: Point): Point {
    return gridSnap ? snapPointToGrid(point, gridSize) : point;
  }

  function snapToDrawingTargets(point: Point): Point {
    const threshold = 10 / canvasZoom;
    const objectTargets = tile.objects.flatMap((object) => object.points);
    const penTargets = penNodes.map((node) => node.point);
    const guidePolygon = tileGuidePolygon(
      tile.guideMode ?? "floor",
      project.tileWidth,
      project.tileHeight,
      tile.anchor.baseline,
    );
    const guideTargets = tile.guideMode === "circle" && guidePolygon.length >= 48
      ? [
          guidePolygon[0], guidePolygon[12], guidePolygon[24], guidePolygon[36],
          { x: guidePolygon[24].x, y: guidePolygon[36].y },
          { x: guidePolygon[0].x, y: guidePolygon[36].y },
          { x: guidePolygon[0].x, y: guidePolygon[12].y },
          { x: guidePolygon[24].x, y: guidePolygon[12].y },
        ]
      : guidePolygon;
    const targetSnap = snapPointToTargets(
      point,
      [...penTargets, ...objectTargets, ...guideTargets],
      threshold,
    );
    if (
      targetSnap.x !== point.x ||
      targetSnap.y !== point.y
    ) {
      return targetSnap;
    }
    const guideSnap = snapPoint(point, project, threshold);
    if (guideSnap.x !== point.x || guideSnap.y !== point.y) {
      return guideSnap;
    }
    return snapToCanvasGrid(point);
  }

  function commitClosedPen() {
    if (penNodes.length < 3) return;
    const object: VectorObject = {
      id: crypto.randomUUID(),
      name: "Ritstiftsform",
      kind: "polygon",
      layerId: selectedLayerId,
      points: samplePenPath(penNodes, true, 14),
      height: 0,
      tilt: 0,
      style: {
        fill: project.style.fillColor,
        stroke: project.style.strokeColor,
        strokeWidth: project.style.strokeWidth,
        opacity: 1,
        shadow: false,
      },
      locked: false,
    };
    addObject(object);
    selectObject(object.id);
    setPenNodes([]);
    setPenPointer(null);
    penDragRef.current = null;
  }

  function undoPenPoint() {
    setPenNodes((current) => current.slice(0, -1));
    penDragRef.current = null;
  }

  function cancelPen() {
    setPenNodes([]);
    setPenPointer(null);
    penDragRef.current = null;
  }

  useEffect(() => {
    function handlePenKey(event: KeyboardEvent) {
      if (tool !== "pen" || penNodes.length === 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setPenNodes([]);
        setPenPointer(null);
        penDragRef.current = null;
      } else if (event.key === "Backspace") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setPenNodes((current) => current.slice(0, -1));
        penDragRef.current = null;
      }
    }
    window.addEventListener("keydown", handlePenKey, true);
    return () => window.removeEventListener("keydown", handlePenKey, true);
  }, [penNodes.length, tool]);

  const visibleObjects = sortObjectsByLayer(
    tile.objects.filter((object) => {
      const layer = tile.layers.find((item) => item.id === object.layerId);
      return layer?.visible !== false;
    }),
    tile.layers,
  );
  const selectedObject = tile.objects.find(
    (object) => object.id === selectedObjectId,
  );
  const selectedBounds = selectedObject
    ? objectBounds([selectedObject])
    : null;
  const scaleCorners = selectedBounds
    ? [
        { x: selectedBounds.minX, y: selectedBounds.minY },
        { x: selectedBounds.maxX, y: selectedBounds.minY },
        { x: selectedBounds.maxX, y: selectedBounds.maxY },
        { x: selectedBounds.minX, y: selectedBounds.maxY },
      ]
    : [];

  function beginCanvas(event: React.PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    if (workspaceMode === "collision") {
      if (event.target === event.currentTarget) selectCollision(null);
      return;
    }
    if (tool === "pen") {
      const point = snapToDrawingTargets(eventPoint(event, viewBox));
      const first = penNodes[0]?.point;
      if (
        first &&
        penNodes.length >= 3 &&
        Math.hypot(point.x - first.x, point.y - first.y) <= 10 / canvasZoom
      ) {
        commitClosedPen();
        return;
      }
      const index = penNodes.length;
      setPenNodes((current) => [...current, { point }]);
      setPenPointer(point);
      penDragRef.current = { index, origin: point };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (
      event.target !== event.currentTarget &&
      (tool === "select" || tool === "scale" || tool === "node")
    ) {
      return;
    }
    const point = snapToDrawingTargets(eventPoint(event, viewBox));
    event.currentTarget.setPointerCapture(event.pointerId);
    if (tool === "select" || tool === "scale" || tool === "node") {
      selectObject(null);
      return;
    }
    setStart(point);
    setDraft([point, point]);
  }

  function moveCanvas(event: React.PointerEvent<SVGSVGElement>) {
    const point = eventPoint(event, viewBox);
    const snappedPoint = snapToDrawingTargets(point);
    if (tool === "pen") {
      setPenPointer(snappedPoint);
      if (penDragRef.current) {
        const { index, origin } = penDragRef.current;
        const dx = point.x - origin.x;
        const dy = point.y - origin.y;
        if (Math.hypot(dx, dy) >= 3 / canvasZoom) {
          setPenNodes((current) =>
            current.map((node, nodeIndex) =>
              nodeIndex === index
                ? {
                    ...node,
                    inHandle: { x: origin.x - dx, y: origin.y - dy },
                    outHandle: { x: origin.x + dx, y: origin.y + dy },
                  }
                : node,
            ),
          );
        }
      }
      return;
    }
    if (anchorDragRef.current) {
      if (anchorDragRef.current === "baseline") {
        moveBaseline(snappedPoint.y);
      } else {
        moveAnchorPoint(anchorDragRef.current, snappedPoint);
      }
      return;
    }
    if (nodeDragRef.current) {
      const matrix = nodeDragRef.current.coordinateElement.getScreenCTM();
      if (!matrix) return;
      const rawLocalPoint = new DOMPoint(
        event.clientX,
        event.clientY,
      ).matrixTransform(matrix.inverse());
      const localPoint = snapToCanvasGrid(rawLocalPoint);
      if (nodeDragRef.current.proportional) {
        const distance = Math.hypot(
          localPoint.x - nodeDragRef.current.pivot.x,
          localPoint.y - nodeDragRef.current.pivot.y,
        );
        scaleObject(
          nodeDragRef.current.id,
          nodeDragRef.current.source,
          nodeDragRef.current.pivot,
          distance / nodeDragRef.current.startDistance,
        );
      } else {
        moveObject(
          nodeDragRef.current.id,
          nodeDragRef.current.source.points.map((sourcePoint, index) =>
            index === nodeDragRef.current?.pointIndex
              ? { x: localPoint.x, y: localPoint.y }
              : sourcePoint,
          ),
        );
      }
      return;
    }
    if (scaleDragRef.current) {
      const startHandle = scaleDragRef.current.startHandle;
      const startX = startHandle.x - scaleDragRef.current.pivot.x;
      const startY = startHandle.y - scaleDragRef.current.pivot.y;
      let scaleX = (snappedPoint.x - scaleDragRef.current.pivot.x) / (Math.abs(startX) < 0.001 ? 0.001 : startX);
      let scaleY = (snappedPoint.y - scaleDragRef.current.pivot.y) / (Math.abs(startY) < 0.001 ? 0.001 : startY);
      if (proportionalNodes) {
        const uniform = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;
        scaleX = uniform;
        scaleY = uniform;
      }
      scaleObject(
        scaleDragRef.current.id,
        scaleDragRef.current.source,
        scaleDragRef.current.pivot,
        scaleX,
        scaleY,
      );
      return;
    }
    if (dragRef.current) {
      const rawDx = point.x - dragRef.current.start.x;
      const rawDy = point.y - dragRef.current.start.y;
      const dx = gridSnap ? Math.round(rawDx / gridSize) * gridSize : rawDx;
      const dy = gridSnap ? Math.round(rawDy / gridSize) * gridSize : rawDy;
      moveObjects(
        dragRef.current.objects.map((source) => ({
          id: source.id,
          points: source.points.map((original) => ({
            x: original.x + dx,
            y: original.y + dy,
          })),
        })),
      );
      return;
    }
    if (!start) return;
    if (tool === "line") {
      const snapped = snapIsoLine(start, snappedPoint);
      setDraft([start, snapped.point]);
      setAngle(snapped.angle);
    } else if (tool === "iso-box") {
      setDraft(makeIsoBox(start, snappedPoint, 72));
    } else if (tool === "polygon") {
      const snapped = snapToDrawingTargets(point);
      setDraft([
        start,
        { x: snapped.x + 56, y: snapped.y + 28 },
        { x: snapped.x, y: snapped.y + 56 },
        { x: snapped.x - 56, y: snapped.y + 28 },
      ]);
    } else if (tool === "ellipse") {
      const end = tile.guideMode === "circle"
        ? constrainEllipseToRatio(start, snappedPoint, project.tileHeight / project.tileWidth)
        : event.shiftKey
        ? (() => {
            const size = Math.max(Math.abs(snappedPoint.x - start.x), Math.abs(snappedPoint.y - start.y));
            return {
              x: start.x + Math.sign(snappedPoint.x - start.x || 1) * size,
              y: start.y + Math.sign(snappedPoint.y - start.y || 1) * size,
            };
          })()
        : snappedPoint;
      setDraft(ellipseFromBounds(start, end));
    } else if (tool === "iso-cylinder") {
      setDraft(makeIsoCylinder(start, snappedPoint, project.tileHeight / project.tileWidth));
    }
  }

  function endCanvas(event: React.PointerEvent<SVGSVGElement>) {
    if (tool === "pen") {
      penDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (anchorDragRef.current || scaleDragRef.current || nodeDragRef.current) {
      anchorDragRef.current = null;
      scaleDragRef.current = null;
      nodeDragRef.current = null;
      return;
    }
    if (dragRef.current) {
      dragRef.current = null;
      return;
    }
    if (
      !start ||
      !draft ||
      tool === "select" ||
      tool === "scale" ||
      tool === "node"
    ) {
      return;
    }
    if ((tool === "iso-cylinder" && draft.length < 4) || (tool === "ellipse" && draft.length < 12)) {
      setStart(null);
      setDraft(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const kind = tool === "iso-box" ? "iso-box" : tool;
    const object: VectorObject = {
      id: crypto.randomUUID(),
      name:
        kind === "iso-box" ? "Isometrisk box" : kind === "iso-cylinder" ? "Isometrisk cylinder" : kind === "line" ? "Linje" : kind === "ellipse" ? "Cirkel / ellips" : "Polygon",
      kind,
      layerId: selectedLayerId,
      points: draft,
      height: kind === "iso-box" ? 72 : kind === "iso-cylinder" ? Math.max(0, draft[3].y - draft[0].y) : 0,
      tilt: kind === "ellipse" || kind === "iso-cylinder" ? 0 : undefined,
      style: {
        fill: project.style.fillColor,
        stroke: project.style.strokeColor,
        strokeWidth: project.style.strokeWidth,
        opacity: 1,
        shadow: kind === "iso-box" || kind === "iso-cylinder",
      },
      locked: false,
    };
    addObject(object);
    selectObject(object.id);
    setStart(null);
    setDraft(null);
    setAngle(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function beginObjectDrag(
    event: React.PointerEvent<SVGGElement>,
    object: VectorObject,
  ) {
    if (tool === "pen") return;
    event.stopPropagation();
    if (event.shiftKey) {
      selectObject(object.id, true);
      return;
    }
    if (tool !== "select" || object.locked) return;
    const dragIds = selectedObjectIds.includes(object.id)
      ? selectedObjectIds
      : [object.id];
    if (!selectedObjectIds.includes(object.id)) {
      selectObject(object.id);
    }
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const point = clientPoint(svg, event.clientX, event.clientY, viewBox);
    beginContinuousEdit();
    dragRef.current = {
      start: point,
      objects: tile.objects
        .filter((item) => dragIds.includes(item.id) && !item.locked)
        .map((item) => ({ id: item.id, points: item.points })),
    };
    svg.setPointerCapture(event.pointerId);
  }

  function beginAnchorDrag(
    event: React.PointerEvent<SVGElement>,
    handle: AnchorHandle,
  ) {
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    beginContinuousEdit();
    anchorDragRef.current = handle;
    svg.setPointerCapture(event.pointerId);
  }

  function beginScaleDrag(
    event: React.PointerEvent<SVGElement>,
    object: VectorObject,
    handle: Point,
    pivot: Point,
  ) {
    event.stopPropagation();
    if (object.locked) return;
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    beginContinuousEdit();
    scaleDragRef.current = {
      id: object.id,
      source: object,
      pivot,
      startHandle: { ...handle },
    };
    svg.setPointerCapture(event.pointerId);
  }

  function beginNodeDrag(
    event: React.PointerEvent<SVGCircleElement>,
    object: VectorObject,
    pointIndex: number,
  ) {
    event.stopPropagation();
    if (tool !== "node" || object.locked || object.points.length < 2) return;
    const svg = event.currentTarget.ownerSVGElement;
    const coordinateElement = event.currentTarget.parentElement;
    if (!svg || !(coordinateElement instanceof SVGGraphicsElement)) return;
    const handle = object.points[pointIndex];
    const pivot = object.points.reduce((farthest, candidate) => {
      const farthestDistance = Math.hypot(
        farthest.x - handle.x,
        farthest.y - handle.y,
      );
      const candidateDistance = Math.hypot(
        candidate.x - handle.x,
        candidate.y - handle.y,
      );
      return candidateDistance > farthestDistance ? candidate : farthest;
    }, object.points[0]);
    beginContinuousEdit();
    nodeDragRef.current = {
      id: object.id,
      source: object,
      pivot,
      startDistance: Math.max(
        1,
        Math.hypot(handle.x - pivot.x, handle.y - pivot.y),
      ),
      coordinateElement,
      pointIndex,
      proportional: proportionalNodes,
    };
    svg.setPointerCapture(event.pointerId);
  }

  return (
    <section className="canvas-panel" aria-label="Rityta">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">VEKTORRITYTA</span>
          <strong>{tile.name}</strong>
        </div>
          <div className="canvas-header-actions">
          {tool === "pen" && (
            <div className="smart-layout-actions pen-actions">
              <button
                disabled={!penNodes.length}
                title="Ta bort den senast satta punkten (Backsteg)"
                onClick={undoPenPoint}
              >
                <CornerUpLeft size={13} /> Ångra punkt
              </button>
              <button
                disabled={!penNodes.length}
                title="Avbryt hela den pågående formen (Esc)"
                onClick={cancelPen}
              >
                <X size={13} /> Avbryt
              </button>
            </div>
          )}
          <div className="smart-layout-actions">
            <button
              title={selectedObjectId ? "Centrera markeringen på baslinjen" : "Centrera hela tilen på baslinjen"}
              disabled={!tile.objects.length}
              onClick={autoPlaceSelected}
            >
              <Crosshair size={13} /> Autoplacera
            </button>
            <button
              title={
                selectedObjectId
                  ? "Tilta markeringen 26,565° framåt för Tiled-isometri"
                  : "Tilta alla olåsta objekt 26,565° framåt"
              }
              disabled={!tile.objects.length}
              onClick={autoTiltSelected}
            >
              <MoveDown size={13} /> Auto-tilt
            </button>
            <button
              title={selectedObjectId ? "Skala markeringen till tilens previewyta" : "Skala hela tilen till previewytan"}
              disabled={!tile.objects.length}
              onClick={autoSizeSelected}
            >
              <Maximize2 size={13} /> Autoanpassa
            </button>
          </div>
          <div className="grid-options">
            <button
              className={gridSnap ? "active" : ""}
              aria-pressed={gridSnap}
              title="Fäst punkter och förflyttningar till rutnätet"
              onClick={() => setGridSnap(!gridSnap)}
            >
              <Magnet size={13} /> Autosnap
            </button>
            <button
              className={denseGrid ? "active" : ""}
              aria-pressed={denseGrid}
              title="Halvera rutavståndet från 16 till 8 px"
              onClick={() => setDenseGrid(!denseGrid)}
            >
              <Grid2x2 size={13} /> Tätt
            </button>
            <button
              className={showGuides ? "active" : ""}
              aria-pressed={showGuides}
              title="Visa eller dölj guider och ankarpunkter"
              onClick={toggleGuides}
            >
              {showGuides ? <Eye size={13} /> : <EyeOff size={13} />}
              Guider
            </button>
            <button
              className={showAnchors ? "active" : ""}
              aria-pressed={showAnchors}
              title="Visa eller dölj bild-, tile- och sorteringsankare"
              onClick={toggleAnchors}
            >
              {showAnchors ? <Eye size={13} /> : <EyeOff size={13} />}
              Ankare
            </button>
          </div>
          <div className="canvas-zoom-control">
            <button
              aria-label="Zooma ut ritytan"
              onClick={() => setCanvasZoom(Math.max(0.5, canvasZoom - 0.25))}
            >
              <Minus size={13} />
            </button>
            <button
              className="zoom-value"
              title="Återställ till 100 %"
              onClick={() => setCanvasZoom(1)}
            >
              {Math.round(canvasZoom * 100)}%
            </button>
            <button
              aria-label="Zooma in ritytan"
              onClick={() => setCanvasZoom(Math.min(3, canvasZoom + 0.25))}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>
      <div className="canvas-wrap">
        <svg
          className={tool === "pen" ? "drawing-canvas pen-tool" : "drawing-canvas"}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          role="img"
          aria-label="Isometrisk SVG-rityta"
          onPointerDown={beginCanvas}
          onPointerMove={moveCanvas}
          onPointerUp={endCanvas}
          onWheel={(event) => {
            event.preventDefault();
            const step = event.deltaY < 0 ? 0.1 : -0.1;
            setCanvasZoom(
              Math.max(0.5, Math.min(3, Number((canvasZoom + step).toFixed(2)))),
            );
          }}
          onPointerCancel={() => {
            setStart(null);
            setDraft(null);
            dragRef.current = null;
            anchorDragRef.current = null;
            scaleDragRef.current = null;
            nodeDragRef.current = null;
            penDragRef.current = null;
          }}
        >
          <defs>
            <pattern
              id="micro-grid"
              width={gridSize}
              height={gridSize}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
                className={denseGrid ? "micro-grid-line is-dense" : "micro-grid-line"}
              />
            </pattern>
            <filter id="object-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity=".18" />
            </filter>
          </defs>
          <rect x="-640" y="-480" width="1920" height="1440" className="canvas-bg" pointerEvents="none" />
          <rect x="-640" y="-480" width="1920" height="1440" fill="url(#micro-grid)" pointerEvents="none" />
          {(showGuides || showAnchors) && (
            <GuideLayer
              tile={tile}
              tileWidth={project.tileWidth}
              tileHeight={project.tileHeight}
              showGuides={showGuides}
              showAnchors={showAnchors}
            />
          )}
          <g filter="url(#object-shadow)">
            {visibleObjects.map((object) => (
              <VectorShape
                key={object.id}
                object={object}
                layerOpacity={
                  tile.layers.find((layer) => layer.id === object.layerId)
                    ?.opacity ?? 1
                }
                selected={selectedObjectIds.includes(object.id)}
                nodesInteractive={
                  tool === "node" && selectedObjectId === object.id
                }
                onPointerDown={(event) => beginObjectDrag(event, object)}
                onNodePointerDown={(event, index) =>
                  beginNodeDrag(event, object, index)
                }
              />
            ))}
            {draft && (
              <VectorShape
                object={{
                  id: "draft",
                  name: "Förhandsvisning",
                  kind: tool === "iso-box" ? "iso-box" : tool === "iso-cylinder" ? "iso-cylinder" : tool === "polygon" ? "polygon" : tool === "ellipse" ? "ellipse" : "line",
                  layerId: selectedLayerId,
                  points: draft,
                  height: 72,
                  style: {
                    fill: project.style.fillColor,
                    stroke: "#f06b45",
                    strokeWidth: 2,
                    opacity: 0.72,
                    shadow: false,
                  },
                  locked: false,
                }}
              />
            )}
            {tool === "pen" && penNodes.length > 0 && (
              <g className="pen-draft" pointerEvents="none">
                <path
                  d={penPathData(
                    penPointer
                      ? [...penNodes, { point: penPointer }]
                      : penNodes,
                  )}
                  className="pen-draft-path"
                />
                {penNodes.map((node, index) => (
                  <g key={`pen-node-${index}`}>
                    {node.inHandle && (
                      <line
                        x1={node.inHandle.x}
                        y1={node.inHandle.y}
                        x2={node.point.x}
                        y2={node.point.y}
                        className="pen-handle-line"
                      />
                    )}
                    {node.outHandle && (
                      <line
                        x1={node.point.x}
                        y1={node.point.y}
                        x2={node.outHandle.x}
                        y2={node.outHandle.y}
                        className="pen-handle-line"
                      />
                    )}
                    {node.inHandle && (
                      <circle
                        cx={node.inHandle.x}
                        cy={node.inHandle.y}
                        r="3"
                        className="pen-control"
                      />
                    )}
                    {node.outHandle && (
                      <circle
                        cx={node.outHandle.x}
                        cy={node.outHandle.y}
                        r="3"
                        className="pen-control"
                      />
                    )}
                    <circle
                      cx={node.point.x}
                      cy={node.point.y}
                      r={index === 0 && penNodes.length >= 3 ? 7 : 5}
                      className={
                        index === 0 && penNodes.length >= 3
                          ? "pen-node can-close"
                          : "pen-node"
                      }
                    />
                  </g>
                ))}
                <text
                  x={penNodes[0].point.x}
                  y={penNodes[0].point.y - 14}
                  className="pen-instruction"
                >
                  {penNodes.length >= 3
                    ? "Klicka första punkten för att stänga och fylla"
                    : "Klicka för linje · dra för kurva · Esc avbryter"}
                </text>
              </g>
            )}
          </g>
          {tool === "scale" && selectedObject && selectedBounds && (
            <g className="scale-overlay">
              <rect
                x={selectedBounds.minX}
                y={selectedBounds.minY}
                width={selectedBounds.width}
                height={selectedBounds.height}
                pointerEvents="none"
              />
              {scaleCorners.map((handle, index) => {
                const pivot = scaleCorners[(index + 2) % 4];
                return (
                  <circle
                    key={`scale-${index}`}
                    cx={handle.x}
                    cy={handle.y}
                    r="6"
                    onPointerDown={(event) =>
                      beginScaleDrag(event, selectedObject, handle, pivot)
                    }
                  />
                );
              })}
              <text
                x={selectedBounds.minX}
                y={selectedBounds.minY - 11}
                pointerEvents="none"
              >
                {proportionalNodes ? "Dra ett hörn för proportionell skalning" : "Dra ett hörn för fri bredd/höjd"}
              </text>
            </g>
          )}
          {tool === "node" && selectedObject && (
            <text
              className="node-tool-hint"
              x={selectedBounds?.minX ?? TILE_CENTER.x}
              y={(selectedBounds?.minY ?? TILE_CENTER.y) - 13}
              pointerEvents="none"
            >
              {proportionalNodes
                ? "Dra en punkt – proportionerna bevaras"
                : "Dra en punkt – fri omformning"}
            </text>
          )}
          {showAnchors && (
            <g className="interactive-anchor-layer">
              <g
                className="anchor-handle image-handle"
                transform={`translate(${tile.anchor.image.x} ${tile.anchor.image.y})`}
                onPointerDown={(event) => beginAnchorDrag(event, "image")}
              >
                <circle r="8" />
                <path d="M -4 0 H 4 M 0 -4 V 4" />
                <text x="12" y="-9">Bildankare</text>
              </g>
              <g
                className="anchor-handle tile-anchor-handle"
                transform={`translate(${tile.anchor.tile.x} ${tile.anchor.tile.y})`}
                onPointerDown={(event) => beginAnchorDrag(event, "tile")}
              >
                <rect x="-6" y="-6" width="12" height="12" rx="2" />
                <text x="12" y="14">Tileankare</text>
              </g>
              <g
                className="anchor-handle sort-handle"
                transform={`translate(${tile.anchor.sort.x} ${tile.anchor.sort.y})`}
                onPointerDown={(event) => beginAnchorDrag(event, "sort")}
              >
                <path d="M 0 -8 L 8 0 L 0 8 L -8 0 Z" />
                <text x="12" y="3">Sortering</text>
              </g>
              <g
                className="anchor-handle baseline-handle"
                transform={`translate(${TILE_CENTER.x + 150} ${tile.anchor.baseline})`}
                onPointerDown={(event) => beginAnchorDrag(event, "baseline")}
              >
                <path d="M -8 -6 L 4 0 L -8 6 Z" />
                <text x="8" y="3">Baslinje</text>
              </g>
            </g>
          )}
          {(showCollisions || workspaceMode === "collision") && (
            <g className="collision-overlay">
              {tile.collisions
                .filter((collision) => collision.enabled)
                .map((collision) => (
                  <CollisionShapeView
                    key={collision.id}
                    collision={collision}
                    selected={selectedCollisionId === collision.id}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      selectCollision(collision.id);
                    }}
                  />
                ))}
            </g>
          )}
          {angle !== null && draft && (
            <g transform={`translate(${draft.at(-1)!.x + 12} ${draft.at(-1)!.y - 12})`}>
              <rect x="-4" y="-15" width="54" height="24" rx="6" className="angle-chip" />
              <text className="angle-text">{angle.toFixed(1)}°</text>
            </g>
          )}
        </svg>
        <div className="axis-compass" aria-hidden="true">
          <span className="axis-z">Z</span>
          <span className="axis-y">Y</span>
          <span className="axis-x">X</span>
        </div>
      </div>
    </section>
  );
}
