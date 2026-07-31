"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, Brush, ChevronLeft, Circle, Columns3, Eraser, Eye, EyeOff, Grid3X3, Layers3, Magnet, Maximize2, Minus, MousePointer2, Move, PaintBucket, Paintbrush, PenLine, Plus, RectangleHorizontal, Trash2, Waypoints } from "lucide-react";
import type { Point, UvPaint, UvVectorPath, VectorObject } from "@/types/editor";
import { useEditorStore } from "@/stores/editor-store";

const UV_SIZE = 12;
const faces = [
  { id: "top", label: "TOPP", description: "Klossens ovansida" },
  { id: "left", label: "VÄNSTER", description: "Vänster sida" },
  { id: "right", label: "HÖGER", description: "Höger sida" },
] as const;
type FaceId = (typeof faces)[number]["id"];

function modelFacePoints(object: VectorObject, face: FaceId): Point[] {
  if (object.kind === "iso-box" && object.points.length >= 7) {
    if (face === "top") return object.points.slice(0, 4);
    if (face === "left") return [object.points[3], object.points[2], object.points[5], object.points[6]];
    return [object.points[1], object.points[4], object.points[5], object.points[2]];
  }
  return object.points;
}

function projectedFacePoints(object: VectorObject, face: FaceId): Point[] {
  const points = modelFacePoints(object, face);
  if (!object.points.length) return points;
  const minX = Math.min(...object.points.map((point) => point.x));
  const maxX = Math.max(...object.points.map((point) => point.x));
  const minY = Math.min(...object.points.map((point) => point.y));
  const maxY = Math.max(...object.points.map((point) => point.y));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const pivotY = maxY;
  const tilt = Math.max(0, Math.min(75, object.tilt ?? 0));
  const scaleY = Math.cos((tilt * Math.PI) / 180);
  const rotation = ((object.rotation ?? 0) * Math.PI) / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);

  return points.map((point) => {
    const tilted = {
      x: point.x,
      y: pivotY + (point.y - pivotY) * scaleY,
    };
    const dx = tilted.x - centerX;
    const dy = tilted.y - centerY;
    return {
      x: centerX + dx * cosine - dy * sine,
      y: centerY + dx * sine + dy * cosine,
    };
  });
}

function normalizedFacePoints(object: VectorObject, face: FaceId): Point[] {
  const points = projectedFacePoints(object, face);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return points.map((point) => ({
    x: (point.x - minX) / width,
    y: (point.y - minY) / height,
  }));
}

function mapUvToFace(point: Point, quad: Point[]): Point {
  if (quad.length !== 4) return point;
  const [a, b, c, d] = quad;
  const u = point.x;
  const v = point.y;
  return {
    x: a.x * (1 - u) * (1 - v) + b.x * u * (1 - v) + c.x * u * v + d.x * (1 - u) * v,
    y: a.y * (1 - u) * (1 - v) + b.y * u * (1 - v) + c.y * u * v + d.y * (1 - u) * v,
  };
}

function painterPathData(points: Point[], object: VectorObject, face: FaceId): string {
  const quad = normalizedFacePoints(object, face);
  return points.map((point, index) => {
    const mapped = mapUvToFace(point, quad);
    return `${index ? "L" : "M"} ${mapped.x} ${mapped.y}`;
  }).join(" ");
}

function uvGuidePath(quad: Point[], position: number, vertical: boolean): string {
  const samples = Array.from({ length: 13 }, (_, index) => index / 12);
  return samples.map((sample, index) => {
    const point = mapUvToFace(
      vertical ? { x: position, y: sample } : { x: sample, y: position },
      quad,
    );
    return `${index ? "L" : "M"} ${point.x} ${point.y}`;
  }).join(" ");
}

function faceCanvasStyle(object: VectorObject, face: FaceId): CSSProperties {
  const points = projectedFacePoints(object, face);
  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const clipPath = normalizedFacePoints(object, face)
    .map((point) => `${point.x * 100}% ${point.y * 100}%`)
    .join(", ");
  return {
    "--painter-aspect": String(width / height),
    clipPath: `polygon(${clipPath})`,
  } as CSSProperties;
}

function makePaint(object: VectorObject): UvPaint {
  const existing = object.uvPaint;
  if (existing?.size === UV_SIZE) return existing;
  return {
    size: UV_SIZE,
    top: Array(UV_SIZE * UV_SIZE).fill(object.style.fill),
    left: Array(UV_SIZE * UV_SIZE).fill(object.style.fill),
    right: Array(UV_SIZE * UV_SIZE).fill(object.style.fill),
    activeColor: {},
    mode: "vector",
  };
}

export function PainterPanel() {
  const { project, selectedObjectId, selectedObjectIds, updateObject, setWorkspaceMode } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId);
  const selectedObjects = tile?.objects.filter((item) => selectedObjectIds.includes(item.id)) ?? [];
  const [painterObjectId, setPainterObjectId] = useState<string | null>(() => selectedObjects.length >= 3 ? selectedObjects[0].id : selectedObjectId);
  const object = selectedObjects.find((item) => item.id === painterObjectId)
    ?? tile?.objects.find((item) => item.id === selectedObjectId);
  const [face, setFace] = useState<FaceId>("top");
  const [facesBeside, setFacesBeside] = useState(false);
  const [color, setColor] = useState("#4f575b");
  const [fillColor, setFillColor] = useState("#8a9093");
  const [gradientTo, setGradientTo] = useState("#c1c5c7");
  const [gradientAngle, setGradientAngle] = useState(45);
  const [strokeWidth, setStrokeWidth] = useState(0.018);
  const [fillEnabled, setFillEnabled] = useState(true);
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [bevelEnabled, setBevelEnabled] = useState(false);
  const [vectorTool, setVectorTool] = useState<"select" | "move" | "node" | "bucket" | "freehand" | "pen" | "rectangle" | "ellipse">("select");
  const [keepVectorProportions, setKeepVectorProportions] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [painterZoom, setPainterZoom] = useState(1);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [selectedVectorId, setSelectedVectorId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState<"vector" | "cells">(() => object?.uvPaint?.mode ?? "vector");
  const [draftPath, setDraftPath] = useState<Point[]>([]);
  const painting = useRef(false);
  const draftRef = useRef<Point[]>([]);
  const shapeStartRef = useRef<Point | null>(null);
  const painterSurfaceRef = useRef<HTMLDivElement | null>(null);
  const painterStageRef = useRef<HTMLDivElement | null>(null);
  const editDragRef = useRef<
    | { kind: "node"; id: string; index: number }
    | { kind: "move"; id: string; start: Point; points: Point[] }
    | { kind: "scale"; id: string; handle: number; points: Point[]; bounds: { minX: number; minY: number; maxX: number; maxY: number } }
    | null
  >(null);
  const paintRef = useRef<{ objectId: string; paint: UvPaint } | null>(null);
  const paint = object ? makePaint(object) : null;

  useEffect(() => {
    if (object && paint && paintRef.current?.objectId !== object.id) {
      paintRef.current = { objectId: object.id, paint };
    }
  }, [object, paint]);

  useEffect(() => {
    const stage = painterStageRef.current;
    if (!stage) return;
    const updateSize = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [object?.id]);

  function paintCell(index: number, erase = false) {
    if (!object || !paint) return;
    const current = paintRef.current?.paint ?? paint;
    const next = { ...current, [face]: [...current[face]] } as UvPaint;
    const nextColor = erase ? object.style.fill : color;
    next[face][index] = nextColor;
    next.activeColor = { ...current.activeColor, [face]: nextColor };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
  }

  function paintAtPointer(event: React.PointerEvent<HTMLDivElement>) {
    const point = uvPointFromClient(event.clientX, event.clientY, false);
    const column = Math.floor(point.x * UV_SIZE);
    const row = Math.floor(point.y * UV_SIZE);
    if (column >= 0 && column < UV_SIZE && row >= 0 && row < UV_SIZE) {
      paintCell(row * UV_SIZE + column);
    }
  }

  function uvPointFromClient(clientX: number, clientY: number, useSnap = true): Point {
    const bounds = painterSurfaceRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    const screen = {
      x: (clientX - bounds.left) / bounds.width,
      y: (clientY - bounds.top) / bounds.height,
    };
    const quad = normalizedFacePoints(object!, face);
    let result: Point;
    if (quad.length !== 4) result = { x: Math.max(0, Math.min(1, screen.x)), y: Math.max(0, Math.min(1, screen.y)) };
    else {
    const [origin, horizontal, , vertical] = quad;
    const ax = horizontal.x - origin.x;
    const ay = horizontal.y - origin.y;
    const bx = vertical.x - origin.x;
    const by = vertical.y - origin.y;
    const dx = screen.x - origin.x;
    const dy = screen.y - origin.y;
    const determinant = ax * by - ay * bx;
    result = Math.abs(determinant) < 0.000001 ? screen : {
      x: Math.max(0, Math.min(1, (dx * by - dy * bx) / determinant)),
      y: Math.max(0, Math.min(1, (ax * dy - ay * dx) / determinant)),
    };
    }
    if (!snapEnabled || !useSnap) return result;
    return {
      x: Math.max(0, Math.min(1, Math.round(result.x * UV_SIZE) / UV_SIZE)),
      y: Math.max(0, Math.min(1, Math.round(result.y * UV_SIZE) / UV_SIZE)),
    };
  }

  function uvPoint(event: React.PointerEvent<HTMLDivElement>): Point {
    return uvPointFromClient(event.clientX, event.clientY);
  }

  function drawVector(event: React.PointerEvent<HTMLDivElement>) {
    const point = uvPoint(event);
    const previous = draftRef.current.at(-1);
    if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.008) {
      draftRef.current = [...draftRef.current, point];
      setDraftPath(draftRef.current);
    }
  }

  function saveVectors(vectors: UvVectorPath[]) {
    if (!object || !paint) return;
    const current = paintRef.current?.paint ?? paint;
    const next: UvPaint = {
      ...current,
      vectors: { ...current.vectors, [face]: vectors },
    };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
  }

  function commitVector(closed: boolean) {
    if (!object || !paint || drawMode !== "vector" || draftRef.current.length < (closed ? 3 : 2)) {
      draftRef.current = [];
      setDraftPath([]);
      painting.current = false;
      return;
    }
    const current = paintRef.current?.paint ?? paint;
    const vector: UvVectorPath = {
      id: crypto.randomUUID(),
      name: `Form ${(current.vectors?.[face]?.length ?? 0) + 1}`,
      points: draftRef.current,
      color,
      width: strokeWidth,
      closed,
      fill: closed && fillEnabled ? fillColor : undefined,
      gradient: closed && gradientEnabled ? { from: fillColor, to: gradientTo, angle: gradientAngle } : undefined,
      visible: true,
      effects: { shadow: shadowEnabled, bevel: bevelEnabled },
    };
    const next: UvPaint = {
      ...current,
      vectors: {
        ...current.vectors,
        [face]: [...(current.vectors?.[face] ?? []), vector],
      },
      activeColor: { ...current.activeColor, [face]: color },
    };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
    setSelectedVectorId(vector.id ?? null);
    draftRef.current = [];
    setDraftPath([]);
    painting.current = false;
  }

  function finishPointerVector() {
    if (editDragRef.current) {
      editDragRef.current = null;
      painting.current = false;
    } else if (vectorTool === "freehand") {
      commitVector(false);
    } else if (vectorTool === "rectangle" || vectorTool === "ellipse") {
      commitVector(true);
      shapeStartRef.current = null;
    } else {
      painting.current = false;
    }
  }

  function toggleVectorVisibility(id: string) {
    const vectors = [...(paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [])];
    saveVectors(vectors.map((vector, index) => (vector.id ?? `legacy-${index}`) === id ? { ...vector, visible: vector.visible === false } : vector));
  }

  function moveVectorLayer(id: string, direction: -1 | 1) {
    const vectors = [...(paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [])];
    const index = vectors.findIndex((vector, itemIndex) => (vector.id ?? `legacy-${itemIndex}`) === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= vectors.length) return;
    [vectors[index], vectors[target]] = [vectors[target], vectors[index]];
    saveVectors(vectors);
  }

  function deleteVectorLayer(id: string) {
    const vectors = paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [];
    saveVectors(vectors.filter((vector, index) => (vector.id ?? `legacy-${index}`) !== id));
    setSelectedVectorId(null);
  }

  function selectVectorLayer(vector: UvVectorPath, id: string) {
    setSelectedVectorId(id);
    setColor(vector.color);
    setStrokeWidth(vector.width);
    setFillEnabled(Boolean(vector.fill || vector.gradient));
    setFillColor(vector.gradient?.from ?? vector.fill ?? fillColor);
    setGradientEnabled(Boolean(vector.gradient));
    setGradientTo(vector.gradient?.to ?? gradientTo);
    setGradientAngle(vector.gradient?.angle ?? gradientAngle);
    setShadowEnabled(Boolean(vector.effects?.shadow));
    setBevelEnabled(Boolean(vector.effects?.bevel));
  }

  function applyStyleToSelected() {
    if (!selectedVectorId) return;
    const vectors = paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [];
    saveVectors(vectors.map((vector, index) => {
      const id = vector.id ?? `legacy-${index}`;
      if (id !== selectedVectorId) return vector;
      return {
        ...vector,
        color,
        width: strokeWidth,
        fill: vector.closed && fillEnabled ? fillColor : undefined,
        gradient: vector.closed && gradientEnabled ? { from: fillColor, to: gradientTo, angle: gradientAngle } : undefined,
        effects: { shadow: shadowEnabled, bevel: bevelEnabled },
      };
    }));
  }

  function rectanglePoints(start: Point, end: Point): Point[] {
    return [start, { x: end.x, y: start.y }, end, { x: start.x, y: end.y }];
  }

  function ellipsePoints(start: Point, end: Point): Point[] {
    const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const radiusX = Math.abs(end.x - start.x) / 2;
    const radiusY = Math.abs(end.y - start.y) / 2;
    return Array.from({ length: 32 }, (_, index) => {
      const angle = (index / 32) * Math.PI * 2;
      return { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY };
    });
  }

  function updateEditDrag(point: Point) {
    const drag = editDragRef.current;
    if (!drag) return;
    const vectors = [...(paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [])];
    const vectorIndex = vectors.findIndex((vector, index) => (vector.id ?? `legacy-${index}`) === drag.id);
    if (vectorIndex < 0) return;
    const vector = vectors[vectorIndex];
    if (drag.kind === "node") {
      const points = [...vector.points];
      points[drag.index] = point;
      vectors[vectorIndex] = { ...vector, points };
    } else if (drag.kind === "move") {
      const dx = point.x - drag.start.x;
      const dy = point.y - drag.start.y;
      vectors[vectorIndex] = {
        ...vector,
        points: drag.points.map((source) => ({ x: source.x + dx, y: source.y + dy })),
      };
    } else {
      const { minX, minY, maxX, maxY } = drag.bounds;
      const handles = [
        { x: minX, y: minY }, { x: maxX, y: minY },
        { x: maxX, y: maxY }, { x: minX, y: maxY },
      ];
      const sourceHandle = handles[drag.handle];
      const pivot = handles[(drag.handle + 2) % 4];
      const denominatorX = sourceHandle.x - pivot.x;
      const denominatorY = sourceHandle.y - pivot.y;
      let scaleX = (point.x - pivot.x) / (Math.abs(denominatorX) < 0.0001 ? 0.0001 : denominatorX);
      let scaleY = (point.y - pivot.y) / (Math.abs(denominatorY) < 0.0001 ? 0.0001 : denominatorY);
      if (keepVectorProportions) {
        const uniform = Math.abs(scaleX) > Math.abs(scaleY) ? scaleX : scaleY;
        scaleX = uniform;
        scaleY = uniform;
      }
      vectors[vectorIndex] = {
        ...vector,
        points: drag.points.map((source) => ({
          x: pivot.x + (source.x - pivot.x) * scaleX,
          y: pivot.y + (source.y - pivot.y) * scaleY,
        })),
      };
    }
    saveVectors(vectors);
  }

  function handleScalePointerDown(event: React.PointerEvent<SVGRectElement>) {
    if (!selectedVectorId) return;
    const vectors = paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [];
    const vector = vectors.find((item, index) => (item.id ?? `legacy-${index}`) === selectedVectorId);
    if (!vector) return;
    const bounds = {
      minX: Math.min(...vector.points.map((point) => point.x)),
      minY: Math.min(...vector.points.map((point) => point.y)),
      maxX: Math.max(...vector.points.map((point) => point.x)),
      maxY: Math.max(...vector.points.map((point) => point.y)),
    };
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    editDragRef.current = {
      kind: "scale",
      id: selectedVectorId,
      handle: Number(event.currentTarget.dataset.handle),
      points: vector.points.map((source) => ({ ...source })),
      bounds,
    };
  }

  function handleDrawnShapePointerDown(
    event: React.PointerEvent<SVGPathElement>,
    vector: UvVectorPath,
    id: string,
  ) {
    event.stopPropagation();
    selectVectorLayer(vector, id);
    if (vectorTool === "bucket") {
      const vectors = paintRef.current?.paint.vectors?.[face] ?? paint?.vectors?.[face] ?? [];
      saveVectors(vectors.map((item, index) => (item.id ?? `legacy-${index}`) === id
        ? { ...item, closed: true, fill: fillColor, gradient: undefined }
        : item));
      return;
    }
    if (vectorTool === "move") {
      event.currentTarget.setPointerCapture(event.pointerId);
      editDragRef.current = {
        kind: "move",
        id,
        start: uvPointFromClient(event.clientX, event.clientY),
        points: vector.points.map((point) => ({ ...point })),
      };
      painting.current = true;
    }
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    painting.current = true;
    if (drawMode === "vector") {
      if (vectorTool === "select" || vectorTool === "move" || vectorTool === "node" || vectorTool === "bucket") {
        setSelectedVectorId(null);
        painting.current = false;
      } else if (vectorTool === "pen") {
        const point = uvPoint(event);
        const first = draftRef.current[0];
        if (first && draftRef.current.length >= 3 && Math.hypot(point.x - first.x, point.y - first.y) < 0.04) {
          commitVector(true);
          return;
        }
        draftRef.current = [...draftRef.current, point];
        setDraftPath(draftRef.current);
      } else if (vectorTool === "rectangle" || vectorTool === "ellipse") {
        const point = uvPoint(event);
        shapeStartRef.current = point;
        draftRef.current = vectorTool === "rectangle" ? rectanglePoints(point, point) : ellipsePoints(point, point);
        setDraftPath(draftRef.current);
      } else {
        draftRef.current = [];
        setDraftPath([]);
        drawVector(event);
      }
    } else {
      paintAtPointer(event);
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (editDragRef.current) {
      updateEditDrag(uvPoint(event));
      return;
    }
    if (!painting.current) return;
    if (drawMode === "vector" && vectorTool === "freehand") drawVector(event);
    else if (drawMode === "vector" && shapeStartRef.current && (vectorTool === "rectangle" || vectorTool === "ellipse")) {
      const end = uvPoint(event);
      draftRef.current = vectorTool === "rectangle" ? rectanglePoints(shapeStartRef.current, end) : ellipsePoints(shapeStartRef.current, end);
      setDraftPath(draftRef.current);
    } else if (drawMode === "cells") paintAtPointer(event);
  }

  function changeDrawMode(nextMode: "vector" | "cells") {
    if (!object || !paint) return;
    setDrawMode(nextMode);
    const current = paintRef.current?.paint ?? paint;
    const next: UvPaint = { ...current, mode: nextMode };
    paintRef.current = { objectId: object.id, paint: next };
    updateObject(object.id, { uvPaint: next });
  }

  function chooseVectorTool(tool: typeof vectorTool) {
    if (drawMode !== "vector") changeDrawMode("vector");
    setVectorTool(tool);
    draftRef.current = [];
    shapeStartRef.current = null;
    setDraftPath([]);
  }

  function chooseFace(nextFace: FaceId) {
    setFace(nextFace);
    setPainterZoom(1);
    if (selectedObjects.length >= 3) {
      const index = faces.findIndex((item) => item.id === nextFace);
      const matchingObject = selectedObjects[index];
      if (matchingObject) setPainterObjectId(matchingObject.id);
    }
    setSelectedVectorId(null);
  }

  function choosePainterObject(id: string, index: number) {
    setPainterObjectId(id);
    setPainterZoom(1);
    if (selectedObjects.length >= 3 && index < faces.length) setFace(faces[index].id);
    setSelectedVectorId(null);
  }

  if (!object || !paint) {
    return (
      <section className="painter-panel empty-painter">
        <div className="panel-heading"><Paintbrush size={15} /> Painter</div>
        <p>Markera ett objekt i ritläget och öppna sedan Painter för att måla dess UV-ytor.</p>
        <button onClick={() => setWorkspaceMode("draw")}><ChevronLeft size={14} /> Tillbaka till ritläget</button>
      </section>
    );
  }

  const activeFace = faces.find((item) => item.id === face)!;
  const activeQuad = normalizedFacePoints(object, face);
  const activeFaceStyle = faceCanvasStyle(object, face);
  const activeFaceAspect = Number(activeFaceStyle["--painter-aspect" as keyof CSSProperties]) || 1;
  const stageInset = 32;
  const availableStageWidth = Math.max(1, stageSize.width - stageInset);
  const availableStageHeight = Math.max(1, stageSize.height - stageInset);
  const fittedWidth = Math.min(availableStageWidth, availableStageHeight * activeFaceAspect);
  const fittedHeight = fittedWidth / activeFaceAspect;
  const zoomedWidth = fittedWidth * painterZoom;
  const zoomedHeight = fittedHeight * painterZoom;
  const faceVectors = paint.vectors?.[face] ?? [];
  const selectedVectorIndex = faceVectors.findIndex((vector, index) => (vector.id ?? `legacy-${index}`) === selectedVectorId);
  const selectedVector = selectedVectorIndex >= 0 ? faceVectors[selectedVectorIndex] : null;
  const selectedVectorBounds = selectedVector ? {
    minX: Math.min(...selectedVector.points.map((point) => point.x)),
    minY: Math.min(...selectedVector.points.map((point) => point.y)),
    maxX: Math.max(...selectedVector.points.map((point) => point.x)),
    maxY: Math.max(...selectedVector.points.map((point) => point.y)),
  } : null;
  const painterTools = [
    { id: "select" as const, label: "Markering", icon: MousePointer2 },
    { id: "move" as const, label: "Flytta", icon: Move },
    { id: "node" as const, label: "Noder", icon: Waypoints },
    { id: "bucket" as const, label: "Färgpyts", icon: PaintBucket },
    { id: "pen" as const, label: "Ritstift", icon: PenLine },
    { id: "freehand" as const, label: "Frihand", icon: Brush },
    { id: "rectangle" as const, label: "Rektangel", icon: RectangleHorizontal },
    { id: "ellipse" as const, label: "Ellips", icon: Circle },
  ];
  return (
    <section className="painter-panel" aria-label="Painter UV-redigering">
      <div className="panel-heading painter-heading">
        <span><Paintbrush size={15} /> Painter <small>{object.name}</small></span>
        <button onClick={() => setWorkspaceMode("draw")} title="Tillbaka till ritläget"><ChevronLeft size={14} /> Ritläge</button>
      </div>
      <div className="painter-toolbar">
        {drawMode === "cells" && <label className="painter-color"><span>Färg</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /><code>{color}</code></label>}
        <button className={`painter-tool ${drawMode === "vector" ? "active" : ""}`} title="Rita som vektor" onClick={() => changeDrawMode("vector")}><PenLine size={14} /> Vektor</button>
        <button className={`painter-tool ${drawMode === "cells" ? "active" : ""}`} title="Måla celler" onClick={() => changeDrawMode("cells")}><Brush size={14} /> Rutor</button>
        <button className="painter-tool" title="Använd objektets grundfärg" onClick={() => setColor(object.style.fill)}><Eraser size={14} /> Sudda</button>
        <span className="painter-mode-note">{drawMode === "vector" ? <PenLine size={12} /> : <Grid3X3 size={12} />} {drawMode === "vector" ? "Vektorritning" : "Rutmålning"}</span>
        <button className={`painter-tool ${facesBeside ? "active" : ""}`} onClick={() => setFacesBeside(!facesBeside)} title="Visa UV-ytorna bredvid varandra"><Columns3 size={14} /> Bredvid</button>
      </div>
      {drawMode === "vector" && (
        <div className="painter-stylebar">
          <label>Linje <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
          <label className="compact-range">Tjocklek <input type="range" min="0.004" max="0.06" step="0.002" value={strokeWidth} onChange={(event) => setStrokeWidth(Number(event.target.value))} /><b>{Math.round(strokeWidth * 1000)}</b></label>
          <label className="toggle-chip"><input type="checkbox" checked={fillEnabled} onChange={(event) => setFillEnabled(event.target.checked)} /> Fyllning</label>
          <input className="mini-color" type="color" value={fillColor} onChange={(event) => setFillColor(event.target.value)} title="Fyllningsfärg" />
          <label className="toggle-chip"><input type="checkbox" checked={gradientEnabled} onChange={(event) => setGradientEnabled(event.target.checked)} /> Gradient</label>
          {gradientEnabled && <><input className="mini-color" type="color" value={gradientTo} onChange={(event) => setGradientTo(event.target.value)} title="Gradientens slutfärg" /><label className="angle-compact">{gradientAngle}° <input type="range" min="0" max="360" value={gradientAngle} onChange={(event) => setGradientAngle(Number(event.target.value))} /></label></>}
          <label className="toggle-chip"><input type="checkbox" checked={shadowEnabled} onChange={(event) => setShadowEnabled(event.target.checked)} /> Skugga</label>
          <label className="toggle-chip"><input type="checkbox" checked={bevelEnabled} onChange={(event) => setBevelEnabled(event.target.checked)} /> Relief</label>
          {vectorTool === "pen" && draftPath.length > 2 && <>
            <button className="commit-shape" onClick={() => commitVector(true)}>Slut och fyll</button>
            <button onClick={() => { draftRef.current = []; setDraftPath([]); }}>Avbryt</button>
          </>}
          {selectedVectorId && <button className="commit-shape" onClick={applyStyleToSelected}>Uppdatera lager</button>}
        </div>
      )}
      {selectedObjects.length > 1 && (
        <div className="painter-object-tabs" aria-label="Markerade objekt">
          <span>Markerade objekt</span>
          {selectedObjects.map((item, index) => (
            <button key={item.id} className={object.id === item.id ? "active" : ""} onClick={() => choosePainterObject(item.id, index)}>
              {selectedObjects.length >= 3 && index < faces.length ? faces[index].label : `${index + 1}.`} {item.name}
            </button>
          ))}
        </div>
      )}
      <div className="painter-face-tabs">
        {faces.map((item, index) => {
          const previewObject = selectedObjects.length >= 3 ? selectedObjects[index] ?? object : object;
          const previewPoints = normalizedFacePoints(previewObject, item.id);
          return (
            <button key={item.id} className={`${face === item.id ? "active" : ""} ${facesBeside ? "face-preview-button" : ""}`} onClick={() => chooseFace(item.id)}>
              {facesBeside && <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><polygon points={previewPoints.map((point) => `${point.x},${point.y}`).join(" ")} /></svg>}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="painter-workspace">
        <div className="painter-design-area">
          <aside className="painter-tool-rail" aria-label="Vektorverktyg">
            {painterTools.map((tool) => {
              const Icon = tool.icon;
              return <button key={tool.id} className={vectorTool === tool.id && drawMode === "vector" ? "active" : ""} onClick={() => chooseVectorTool(tool.id)} title={tool.label}><Icon size={17} /><span>{tool.label}</span></button>;
            })}
            <span className="rail-divider" />
            <label className="rail-proportion" title="Behåll proportioner vid skalning"><input type="checkbox" checked={keepVectorProportions} onChange={(event) => setKeepVectorProportions(event.target.checked)} /><span>Proportion</span></label>
            <label className={`rail-proportion ${snapEnabled ? "active" : ""}`} title="Snappa till UV-guidernas skärningar"><input type="checkbox" checked={snapEnabled} onChange={(event) => setSnapEnabled(event.target.checked)} /><Magnet size={14} /><span>Snap</span></label>
          </aside>
          <div className="painter-canvas-wrap">
          <div className="painter-canvas-label">
            <strong>{activeFace.label}</strong>
            <span>{activeFace.description} · {UV_SIZE} × {UV_SIZE}</span>
            <div className="painter-zoom" aria-label="Zooma Painter">
              <button onClick={() => setPainterZoom((value) => Math.max(.5, value - .25))} title="Zooma ut"><Minus size={13} /></button>
              <button className="painter-fit" onClick={() => setPainterZoom(1)} title="Visa hela objektet"><Maximize2 size={12} /> {Math.round(painterZoom * 100)}%</button>
              <button onClick={() => setPainterZoom((value) => Math.min(4, value + .25))} title="Zooma in"><Plus size={13} /></button>
            </div>
          </div>
          <div ref={painterStageRef} className="painter-stage">
          <div className="painter-zoom-content" style={{ width: Math.max(stageSize.width, zoomedWidth + stageInset), height: Math.max(stageSize.height, zoomedHeight + stageInset) }}>
          <div
            ref={painterSurfaceRef}
            className={`painter-grid face-${face} tool-${vectorTool}`}
            style={{ ...activeFaceStyle, width: zoomedWidth || undefined, height: zoomedHeight || undefined }}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={finishPointerVector}
            onPointerCancel={finishPointerVector}
          >
            <svg className={`painter-vector-layer ${["select", "move", "node", "bucket"].includes(vectorTool) ? "is-editing" : ""}`} viewBox="0 0 1 1" preserveAspectRatio="none">
              <defs>
                {(paint.vectors?.[face] ?? []).map((path, index) => path.gradient && (
                  <linearGradient key={`gradient-${index}`} id={`painter-gradient-${object.id}-${face}-${path.id ?? `legacy-${index}`}`} x1="0" y1="0.5" x2="1" y2="0.5" gradientTransform={`rotate(${path.gradient.angle} .5 .5)`}>
                    <stop offset="0" stopColor={path.gradient.from} />
                    <stop offset="1" stopColor={path.gradient.to} />
                  </linearGradient>
                ))}
              </defs>
              {paint[face].map((cell, index) => {
                const column = index % UV_SIZE;
                const row = Math.floor(index / UV_SIZE);
                const corners = [
                  mapUvToFace({ x: column / UV_SIZE, y: row / UV_SIZE }, activeQuad),
                  mapUvToFace({ x: (column + 1) / UV_SIZE, y: row / UV_SIZE }, activeQuad),
                  mapUvToFace({ x: (column + 1) / UV_SIZE, y: (row + 1) / UV_SIZE }, activeQuad),
                  mapUvToFace({ x: column / UV_SIZE, y: (row + 1) / UV_SIZE }, activeQuad),
                ];
                return <polygon className="painter-uv-cell" key={`${face}-${index}`} points={corners.map((point) => `${point.x},${point.y}`).join(" ")} fill={drawMode === "cells" ? cell : object.style.fill} stroke="none" />;
              })}
              {Array.from({ length: UV_SIZE + 1 }, (_, index) => index / UV_SIZE).map((position) => (
                <g key={`guide-${position}`} className="painter-uv-guides">
                  <path d={uvGuidePath(activeQuad, position, true)} />
                  <path d={uvGuidePath(activeQuad, position, false)} />
                </g>
              ))}
              {(paint.vectors?.[face] ?? []).map((path, index) => {
                if (path.visible === false) return null;
                const id = path.id ?? `legacy-${index}`;
                const data = `${painterPathData(path.points, object, face)}${path.closed ? " Z" : ""}`;
                const fill = path.closed ? path.gradient ? `url(#painter-gradient-${object.id}-${face}-${id})` : path.fill ?? "none" : "none";
                return (
                  <g key={`saved-${id}`}>
                    {path.effects?.shadow && <path pointerEvents="none" d={data} fill={path.closed ? "rgba(0,0,0,.22)" : "none"} stroke="rgba(0,0,0,.28)" strokeWidth={path.width} transform="translate(.012 .014)" />}
                    {path.effects?.bevel && <path pointerEvents="none" d={data} fill="none" stroke="rgba(255,255,255,.62)" strokeWidth={path.width * 1.65} transform="translate(-.004 -.004)" />}
                    <path className="painter-drawn-shape" d={data} fill={fill} stroke={path.color} strokeWidth={path.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents={["select", "move", "node", "bucket"].includes(vectorTool) ? "visiblePainted" : "none"} onPointerDown={(event) => handleDrawnShapePointerDown(event, path, id)} />
                  </g>
                );
              })}
              {draftPath.length > 1 && <path d={painterPathData(draftPath, object, face)} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />}
              {vectorTool === "pen" && draftPath.map((point, index) => {
                const mapped = mapUvToFace(point, activeQuad);
                return <circle key={`pen-node-${index}`} cx={mapped.x} cy={mapped.y} r={index === 0 ? 0.012 : 0.009} fill="#fffaf0" stroke={color} strokeWidth="0.004" />;
              })}
              {selectedVector && selectedVectorBounds && vectorTool === "node" && selectedVector.points.map((point, index) => {
                const mapped = mapUvToFace(point, activeQuad);
                return <circle key={`edit-node-${index}`} className="painter-edit-node" cx={mapped.x} cy={mapped.y} r="0.011" onPointerDown={(event) => { event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); editDragRef.current = { kind: "node", id: selectedVectorId!, index }; }} />;
              })}
              {selectedVector && selectedVectorBounds && (vectorTool === "select" || vectorTool === "move") && (() => {
                const corners = [
                  { x: selectedVectorBounds.minX, y: selectedVectorBounds.minY },
                  { x: selectedVectorBounds.maxX, y: selectedVectorBounds.minY },
                  { x: selectedVectorBounds.maxX, y: selectedVectorBounds.maxY },
                  { x: selectedVectorBounds.minX, y: selectedVectorBounds.maxY },
                ];
                const mappedCorners = corners.map((point) => mapUvToFace(point, activeQuad));
                return <g className="painter-selection-box">
                  <polygon points={mappedCorners.map((point) => `${point.x},${point.y}`).join(" ")} />
                  {vectorTool === "select" && mappedCorners.map((point, index) => <rect key={`scale-${index}`} data-handle={index} x={point.x - 0.012} y={point.y - 0.012} width="0.024" height="0.024" onPointerDown={handleScalePointerDown} />)}
                </g>;
              })()}
            </svg>
          </div>
          </div>
          </div>
          <small className="painter-hint">{drawMode === "cells" ? "Klicka eller dra över rutorna för att måla." : vectorTool === "select" ? "Klicka på en form och dra i hörnhandtagen för att skala." : vectorTool === "move" ? "Dra en form till en ny plats." : vectorTool === "bucket" ? "Klicka på en form för att fylla den med aktuell fyllningsfärg." : vectorTool === "node" ? "Markera en form och dra dess noder för att ändra formen." : vectorTool === "pen" ? "Klicka punkt för punkt. Klicka på startpunkten för att sluta formen." : vectorTool === "rectangle" || vectorTool === "ellipse" ? "Dra ut formen över UV-ytan." : "Dra över ytan för att rita på fri hand."} {snapEnabled ? "Snap är aktiv." : ""}</small>
          </div>
        </div>
        <div className="painter-preview-card">
          <span>UV-layout</span>
          <div className="uv-layout">
            {faces.map((item, index) => {
              const faceObject = selectedObjects.length >= 3 ? selectedObjects[index] : object;
              const points = normalizedFacePoints(faceObject ?? object, item.id);
              return (
                <button key={`layout-${item.id}`} className={`uv-face uv-${item.id} ${face === item.id ? "active" : ""}`} onClick={() => chooseFace(item.id)} title={`Redigera ${item.label.toLowerCase()}`}>
                  <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><polygon points={points.map((point) => `${point.x},${point.y}`).join(" ")} style={{ fill: faceObject?.style.fill ?? object.style.fill }} /></svg>
                  <b>{item.label.slice(0, 1)}</b>
                </button>
              );
            })}
          </div>
          <div className="painter-layers">
            <div className="painter-layers-heading"><span><Layers3 size={13} /> Lager</span><b>{faceVectors.length}</b></div>
            {faceVectors.length ? [...faceVectors].reverse().map((vector, reverseIndex) => {
              const index = faceVectors.length - 1 - reverseIndex;
              const id = vector.id ?? `legacy-${index}`;
              return (
                <div key={id} className={`painter-layer-row ${selectedVectorId === id ? "active" : ""}`} onClick={() => selectVectorLayer(vector, id)}>
                  <button title="Visa/dölj" onClick={(event) => { event.stopPropagation(); toggleVectorVisibility(id); }}>{vector.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
                  <span>{vector.name ?? `Form ${index + 1}`}</span>
                  <i style={{ background: vector.gradient ? `linear-gradient(90deg, ${vector.gradient.from}, ${vector.gradient.to})` : vector.fill ?? vector.color }} />
                  <button title="Flytta upp" onClick={(event) => { event.stopPropagation(); moveVectorLayer(id, 1); }}><ArrowUp size={12} /></button>
                  <button title="Flytta ned" onClick={(event) => { event.stopPropagation(); moveVectorLayer(id, -1); }}><ArrowDown size={12} /></button>
                  <button title="Ta bort" onClick={(event) => { event.stopPropagation(); deleteVectorLayer(id); }}><Trash2 size={12} /></button>
                </div>
              );
            }) : <small>Inga vektorlager på denna yta.</small>}
          </div>
        </div>
      </div>
    </section>
  );
}
