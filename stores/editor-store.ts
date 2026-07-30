"use client";

import { create } from "zustand";
import type {
  Anchor,
  CollisionKind,
  CollisionShape,
  Layer,
  Point,
  Project,
  Tile,
  Tool,
  VectorObject,
  WorkspaceMode,
} from "@/types/editor";
import {
  createCollisionShape,
  resizeCollision,
  type CollisionBounds,
} from "@/features/collision/collision";
import { saveProject } from "@/lib/project-db";
import {
  autoPlaceObjects,
  autoSizeObjectsToTile,
  normalizeAngle,
  normalizeTilt,
  scaleObjectFromPivot,
  snapObjectAngle,
  snapObjectTilt,
  TILED_ISOMETRIC_TILT,
} from "@/features/drawing/geometry";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

function defaultLayers(): Layer[] {
  return [
    { id: "shadow", name: "Skugga", visible: true, locked: false, opacity: 0.6 },
    { id: "base", name: "Bas", visible: true, locked: false, opacity: 1 },
    { id: "details", name: "Detaljer", visible: true, locked: false, opacity: 1 },
    { id: "outlines", name: "Konturer", visible: true, locked: false, opacity: 1 },
    { id: "highlights", name: "Highlights", visible: true, locked: false, opacity: 1 },
  ];
}

function defaultAnchor() {
  return {
    image: { x: 320, y: 336 },
    tile: { x: 320, y: 336 },
    sort: { x: 320, y: 328 },
    baseline: 336,
  };
}

function sampleBox(
  id: string,
  name: string,
  fill: string,
  height: number,
  halfWidth: number,
  halfDepth: number,
): VectorObject {
  const topY = 304 - halfDepth - height;
  return {
    id,
    name,
    kind: "iso-box",
    layerId: "base",
    points: [
      { x: 320, y: topY },
      { x: 320 + halfWidth, y: 304 - height },
      { x: 320, y: 304 + halfDepth - height },
      { x: 320 - halfWidth, y: 304 - height },
      { x: 320 + halfWidth, y: 304 },
      { x: 320, y: 304 + halfDepth },
      { x: 320 - halfWidth, y: 304 },
    ],
    height,
    style: {
      fill,
      stroke: "#24313a",
      strokeWidth: 2,
      opacity: 1,
      shadow: true,
    },
    locked: false,
  };
}

export function createDefaultProject(): Project {
  const layers = defaultLayers();
  return {
    id: "default-project",
    name: "Bageri — prototyp",
    tileWidth: 128,
    tileHeight: 64,
    canvasWidth: 128,
    canvasHeight: 192,
    projection: "isometric-2-1",
    style: {
      strokeWidth: 2,
      strokeColor: "#24313a",
      fillColor: "#e9a85d",
      lightDirection: "top-left",
    },
    collections: [
      { id: "collection-bakery", name: "Bageri" },
      { id: "collection-architecture", name: "Arkitektur" },
    ],
    tiles: [
      {
        id: "tile-workbench",
        name: "Arbetsbänk",
        category: "Möbler",
        tags: ["bageri", "metall"],
        collectionId: "collection-bakery",
        layers,
        collisions: [
          {
            id: "workbench-collision",
            name: "Bas",
            kind: "diamond",
            points: [
              { x: 320, y: 261 },
              { x: 390, y: 296 },
              { x: 320, y: 331 },
              { x: 250, y: 296 },
            ],
            enabled: true,
          },
        ],
        objects: [
          {
            id: "starter-box",
            name: "Isometrisk box",
            kind: "iso-box",
            layerId: "base",
            points: [
              { x: 320, y: 184 },
              { x: 402, y: 225 },
              { x: 320, y: 266 },
              { x: 238, y: 225 },
              { x: 402, y: 305 },
              { x: 320, y: 346 },
              { x: 238, y: 305 },
            ],
            height: 80,
            style: {
              fill: "#e9a85d",
              stroke: "#24313a",
              strokeWidth: 2,
              opacity: 1,
              shadow: true,
            },
            locked: false,
          },
        ],
        anchor: defaultAnchor(),
      },
      {
        id: "tile-floor",
        name: "Kalkstensgolv",
        category: "Golv",
        tags: ["sten", "sömlös"],
        collectionId: "collection-architecture",
        layers: defaultLayers(),
        collisions: [],
        objects: [
          {
            id: "floor-diamond",
            name: "Golvyta",
            kind: "polygon",
            layerId: "base",
            points: [
              { x: 320, y: 272 },
              { x: 384, y: 304 },
              { x: 320, y: 336 },
              { x: 256, y: 304 },
            ],
            height: 0,
            style: {
              fill: "#b8c4b7",
              stroke: "#66746f",
              strokeWidth: 1.5,
              opacity: 1,
              shadow: false,
            },
            locked: false,
          },
        ],
        anchor: defaultAnchor(),
      },
      {
        id: "tile-wall",
        name: "Putsad vägg",
        category: "Väggar",
        tags: ["vägg", "puts"],
        collectionId: "collection-architecture",
        layers: defaultLayers(),
        collisions: [],
        objects: [sampleBox("wall-box", "Väggsektion", "#d4c7ad", 116, 64, 12)],
        anchor: defaultAnchor(),
      },
      {
        id: "tile-oven",
        name: "Bakugn",
        category: "Maskiner",
        tags: ["bageri", "ugn"],
        collectionId: "collection-bakery",
        layers: defaultLayers(),
        collisions: [],
        objects: [sampleBox("oven-box", "Ugn", "#9f6853", 92, 52, 28)],
        anchor: defaultAnchor(),
      },
    ],
    activeTileId: "tile-workbench",
    updatedAt: now(),
  };
}

export function normalizeProject(project: Project): Project {
  const fallback = createDefaultProject();
  const legacy = project as Project & {
    collections?: Project["collections"];
    tiles: Array<Tile & { collectionId?: string; collisions?: CollisionShape[] }>;
  };
  if (legacy.collections?.length) {
    return {
      ...project,
      tiles: legacy.tiles.map((tile) => ({
        ...tile,
        collectionId: tile.collectionId ?? legacy.collections![0].id,
        collisions: tile.collisions ?? [],
      })),
    };
  }
  const existingIds = new Set(legacy.tiles.map((tile) => tile.id));
  return {
    ...project,
    collections: fallback.collections,
    tiles: [
      ...legacy.tiles.map((tile) => ({
        ...tile,
        collectionId: "collection-bakery",
        collisions: tile.collisions ?? [],
      })),
      ...fallback.tiles.filter((tile) => !existingIds.has(tile.id)),
    ],
  };
}

type EditorState = {
  project: Project;
  tool: Tool;
  workspaceMode: WorkspaceMode;
  selectedObjectId: string | null;
  selectedCollisionId: string | null;
  selectedLayerId: string;
  zoom: number;
  canvasZoom: number;
  previewMode: "single" | "grid";
  showGuides: boolean;
  showCollisions: boolean;
  autoAngle: boolean;
  autoTilt: boolean;
  history: Project[];
  future: Project[];
  autosaveState: "saved" | "saving";
  setTool: (tool: Tool) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  selectObject: (id: string | null) => void;
  selectCollision: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setCanvasZoom: (zoom: number) => void;
  setPreviewMode: (mode: "single" | "grid") => void;
  toggleGuides: () => void;
  setShowCollisions: (visible: boolean) => void;
  setAutoAngle: (enabled: boolean) => void;
  setAutoTilt: (enabled: boolean) => void;
  addObject: (object: VectorObject) => void;
  addObjects: (objects: VectorObject[]) => void;
  updateObject: (id: string, patch: Partial<VectorObject>) => void;
  setObjectAngle: (id: string, angle: number) => void;
  setObjectTilt: (id: string, tilt: number) => void;
  moveObject: (id: string, points: Point[]) => void;
  scaleObject: (
    id: string,
    source: VectorObject,
    pivot: Point,
    scale: number,
  ) => void;
  beginContinuousEdit: () => void;
  moveAnchorPoint: (kind: "image" | "tile" | "sort", point: Point) => void;
  moveBaseline: (baseline: number) => void;
  addCollision: (kind: CollisionKind) => void;
  updateCollisionBounds: (id: string, patch: Partial<CollisionBounds>) => void;
  toggleCollision: (id: string) => void;
  deleteCollision: (id: string) => void;
  autoPlaceSelected: () => void;
  autoTiltSelected: () => void;
  autoSizeSelected: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  toggleLayer: (id: string, field: "visible" | "locked") => void;
  addLayer: () => void;
  duplicateLayer: (id: string) => void;
  deleteLayer: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down") => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  setSelectedLayer: (id: string) => void;
  setAnchorPoint: (kind: "image" | "tile" | "sort", point: Point) => void;
  setBaseline: (baseline: number) => void;
  setProjectName: (name: string) => void;
  setTileSize: (width: number, height: number) => void;
  selectTile: (id: string) => void;
  createTile: (name: string, collectionId: string) => void;
  duplicateTile: (id: string) => void;
  deleteTile: (id: string) => void;
  createCollection: (name: string) => void;
  moveTileToCollection: (tileId: string, collectionId: string) => void;
  importTiles: (tiles: Tile[], collectionName?: string) => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
};

function updateActiveTile(
  project: Project,
  update: (tile: Project["tiles"][number]) => Project["tiles"][number],
): Project {
  return {
    ...project,
    updatedAt: now(),
    tiles: project.tiles.map((tile) =>
      tile.id === project.activeTileId ? update(tile) : tile,
    ),
  };
}

function snapshot(state: EditorState, next: Project): Partial<EditorState> {
  return {
    project: next,
    history: [...state.history.slice(-39), state.project],
    future: [],
    autosaveState: "saving",
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createDefaultProject(),
  tool: "select",
  workspaceMode: "draw",
  selectedObjectId: "starter-box",
  selectedCollisionId: "workbench-collision",
  selectedLayerId: "base",
  zoom: 1,
  canvasZoom: 1,
  previewMode: "single",
  showGuides: true,
  showCollisions: false,
  autoAngle: true,
  autoTilt: true,
  history: [],
  future: [],
  autosaveState: "saved",
  setTool: (tool) => set({ tool }),
  setWorkspaceMode: (workspaceMode) =>
    set({ workspaceMode, showCollisions: workspaceMode === "collision" }),
  selectObject: (selectedObjectId) =>
    set({ selectedObjectId, selectedCollisionId: null }),
  selectCollision: (selectedCollisionId) =>
    set({ selectedCollisionId, selectedObjectId: null }),
  setZoom: (zoom) => set({ zoom }),
  setCanvasZoom: (canvasZoom) => set({ canvasZoom }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  toggleGuides: () => set((state) => ({ showGuides: !state.showGuides })),
  setShowCollisions: (showCollisions) => set({ showCollisions }),
  setAutoAngle: (autoAngle) => set({ autoAngle }),
  setAutoTilt: (autoTilt) =>
    set((state) => {
      if (!autoTilt || !state.selectedObjectId) return { autoTilt };
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (tile) => ({
            ...tile,
            objects: tile.objects.map((object) =>
              object.id === state.selectedObjectId
                ? { ...object, tilt: TILED_ISOMETRIC_TILT }
                : object,
            ),
          })),
        ),
        autoTilt,
      };
    }),
  addObject: (object) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          objects: [
            ...tile.objects,
            state.autoTilt
              ? { ...object, tilt: TILED_ISOMETRIC_TILT }
              : object,
          ],
        })),
      ),
    ),
  addObjects: (objects) =>
    set((state) => {
      if (!objects.length) return state;
      const preparedObjects = state.autoTilt
        ? objects.map((object) => ({
            ...object,
            tilt: TILED_ISOMETRIC_TILT,
          }))
        : objects;
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (tile) => ({
            ...tile,
            objects: [...tile.objects, ...preparedObjects],
          })),
        ),
        selectedObjectId: preparedObjects.at(-1)?.id ?? null,
        selectedLayerId:
          preparedObjects.at(-1)?.layerId ?? state.selectedLayerId,
      };
    }),
  updateObject: (id, patch) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          objects: tile.objects.map((object) =>
            object.id === id ? { ...object, ...patch } : object,
          ),
        })),
      ),
    ),
  setObjectAngle: (id, angle) =>
    set((state) => {
      const rotation = state.autoAngle
        ? snapObjectAngle(angle)
        : normalizeAngle(angle);
      return snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          objects: tile.objects.map((object) =>
            object.id === id ? { ...object, rotation } : object,
          ),
        })),
      );
    }),
  setObjectTilt: (id, tilt) =>
    set((state) => {
      const normalizedTilt = state.autoTilt
        ? snapObjectTilt(tilt)
        : normalizeTilt(tilt);
      return snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          objects: tile.objects.map((object) =>
            object.id === id ? { ...object, tilt: normalizedTilt } : object,
          ),
        })),
      );
    }),
  moveObject: (id, points) =>
    set((state) => ({
      project: updateActiveTile(state.project, (tile) => ({
        ...tile,
        objects: tile.objects.map((object) =>
          object.id === id ? { ...object, points } : object,
        ),
      })),
      autosaveState: "saving",
    })),
  scaleObject: (id, source, pivot, scale) =>
    set((state) => ({
      project: updateActiveTile(state.project, (tile) => ({
        ...tile,
        objects: tile.objects.map((object) =>
          object.id === id
            ? scaleObjectFromPivot(source, pivot, scale)
            : object,
        ),
      })),
      autosaveState: "saving",
    })),
  beginContinuousEdit: () =>
    set((state) => ({
      history: [...state.history.slice(-39), state.project],
      future: [],
    })),
  moveAnchorPoint: (kind, point) =>
    set((state) => ({
      project: updateActiveTile(state.project, (tile) => ({
        ...tile,
        anchor: { ...tile.anchor, [kind]: point } as Anchor,
      })),
      autosaveState: "saving",
    })),
  moveBaseline: (baseline) =>
    set((state) => ({
      project: updateActiveTile(state.project, (tile) => ({
        ...tile,
        anchor: { ...tile.anchor, baseline },
      })),
      autosaveState: "saving",
    })),
  addCollision: (kind) =>
    set((state) => {
      const collision = createCollisionShape(kind);
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (tile) => ({
            ...tile,
            collisions: [...tile.collisions, collision],
          })),
        ),
        selectedCollisionId: collision.id,
        selectedObjectId: null,
        showCollisions: true,
      };
    }),
  updateCollisionBounds: (id, patch) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          collisions: tile.collisions.map((collision) =>
            collision.id === id ? resizeCollision(collision, patch) : collision,
          ),
        })),
      ),
    ),
  toggleCollision: (id) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          collisions: tile.collisions.map((collision) =>
            collision.id === id
              ? { ...collision, enabled: !collision.enabled }
              : collision,
          ),
        })),
      ),
    ),
  deleteCollision: (id) =>
    set((state) => ({
      ...snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          collisions: tile.collisions.filter((collision) => collision.id !== id),
        })),
      ),
      selectedCollisionId:
        state.selectedCollisionId === id ? null : state.selectedCollisionId,
    })),
  autoPlaceSelected: () =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      if (!tile) return state;
      const targets = tile.objects.filter(
        (object) =>
          !object.locked &&
          (!state.selectedObjectId || object.id === state.selectedObjectId),
      );
      if (!targets.length) return state;
      const placed = new Map(
        autoPlaceObjects(targets, 320, tile.anchor.baseline).map((object) => [
          object.id,
          object,
        ]),
      );
      return snapshot(
        state,
        updateActiveTile(state.project, (activeTile) => ({
          ...activeTile,
          objects: activeTile.objects.map(
            (object) => placed.get(object.id) ?? object,
          ),
        })),
      );
    }),
  autoTiltSelected: () =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      if (!tile) return state;
      const targetIds = new Set(
        tile.objects
          .filter(
            (object) =>
              !object.locked &&
              (!state.selectedObjectId || object.id === state.selectedObjectId),
          )
          .map((object) => object.id),
      );
      if (!targetIds.size) return state;
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (activeTile) => ({
            ...activeTile,
            objects: activeTile.objects.map((object) =>
              targetIds.has(object.id)
                ? { ...object, tilt: TILED_ISOMETRIC_TILT }
                : object,
            ),
          })),
        ),
        autoTilt: true,
      };
    }),
  autoSizeSelected: () =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      if (!tile) return state;
      const targets = tile.objects.filter(
        (object) =>
          !object.locked &&
          (!state.selectedObjectId || object.id === state.selectedObjectId),
      );
      if (!targets.length) return state;
      const sized = new Map(
        autoSizeObjectsToTile(targets, {
          tileWidth: state.project.tileWidth,
          tileHeight: state.project.tileHeight,
          baseline: tile.anchor.baseline,
        }).map((object) => [object.id, object]),
      );
      return snapshot(
        state,
        updateActiveTile(state.project, (activeTile) => ({
          ...activeTile,
          objects: activeTile.objects.map(
            (object) => sized.get(object.id) ?? object,
          ),
        })),
      );
    }),
  deleteSelected: () =>
    set((state) => {
      if (!state.selectedObjectId) return state;
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (tile) => ({
            ...tile,
            objects: tile.objects.filter(
              (object) => object.id !== state.selectedObjectId,
            ),
          })),
        ),
        selectedObjectId: null,
      };
    }),
  duplicateSelected: () =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      const source = tile?.objects.find(
        (object) => object.id === state.selectedObjectId,
      );
      if (!source) return state;
      const copy: VectorObject = {
        ...source,
        id: newId(),
        name: `${source.name} kopia`,
        points: source.points.map((point) => ({
          x: point.x + 12,
          y: point.y + 6,
        })),
      };
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (activeTile) => ({
            ...activeTile,
            objects: [...activeTile.objects, copy],
          })),
        ),
        selectedObjectId: copy.id,
      };
    }),
  toggleLayer: (id, field) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          layers: tile.layers.map((layer) =>
            layer.id === id ? { ...layer, [field]: !layer[field] } : layer,
          ),
        })),
      ),
    ),
  addLayer: () =>
    set((state) => {
      const layer: Layer = {
        id: newId(),
        name: `Lager ${state.project.tiles.find((tile) => tile.id === state.project.activeTileId)!.layers.length + 1}`,
        visible: true,
        locked: false,
        opacity: 1,
      };
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (tile) => ({
            ...tile,
            layers: [...tile.layers, layer],
          })),
        ),
        selectedLayerId: layer.id,
      };
    }),
  duplicateLayer: (id) =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      const source = tile?.layers.find((layer) => layer.id === id);
      if (!tile || !source) return state;
      const layer: Layer = { ...source, id: newId(), name: `${source.name} kopia` };
      const sourceIndex = tile.layers.findIndex((item) => item.id === id);
      const copies = tile.objects
        .filter((object) => object.layerId === id)
        .map((object) => ({
          ...object,
          id: newId(),
          name: `${object.name} kopia`,
          layerId: layer.id,
          points: object.points.map((point) => ({ ...point })),
          style: { ...object.style },
        }));
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (activeTile) => ({
            ...activeTile,
            layers: [
              ...activeTile.layers.slice(0, sourceIndex + 1),
              layer,
              ...activeTile.layers.slice(sourceIndex + 1),
            ],
            objects: [...activeTile.objects, ...copies],
          })),
        ),
        selectedLayerId: layer.id,
        selectedObjectId: copies[0]?.id ?? null,
      };
    }),
  deleteLayer: (id) =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      if (!tile || tile.layers.length <= 1) return state;
      const fallback = tile.layers.find((layer) => layer.id !== id)!;
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (activeTile) => ({
            ...activeTile,
            layers: activeTile.layers.filter((layer) => layer.id !== id),
            objects: activeTile.objects.map((object) =>
              object.layerId === id
                ? { ...object, layerId: fallback.id }
                : object,
            ),
          })),
        ),
        selectedLayerId:
          state.selectedLayerId === id ? fallback.id : state.selectedLayerId,
      };
    }),
  moveLayer: (id, direction) =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      if (!tile) return state;
      const index = tile.layers.findIndex((layer) => layer.id === id);
      const target = direction === "up" ? index + 1 : index - 1;
      if (index < 0 || target < 0 || target >= tile.layers.length) return state;
      const layers = [...tile.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return snapshot(
        state,
        updateActiveTile(state.project, (activeTile) => ({
          ...activeTile,
          layers,
        })),
      );
    }),
  setLayerOpacity: (id, opacity) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          layers: tile.layers.map((layer) =>
            layer.id === id
              ? { ...layer, opacity: Math.max(0, Math.min(1, opacity)) }
              : layer,
          ),
        })),
      ),
    ),
  setSelectedLayer: (selectedLayerId) => set({ selectedLayerId }),
  setAnchorPoint: (kind, point) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          anchor: { ...tile.anchor, [kind]: point } as Anchor,
        })),
      ),
    ),
  setBaseline: (baseline) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          anchor: { ...tile.anchor, baseline },
        })),
      ),
    ),
  setProjectName: (name) =>
    set((state) => ({
      project: { ...state.project, name, updatedAt: now() },
      autosaveState: "saving",
    })),
  setTileSize: (tileWidth, tileHeight) =>
    set((state) =>
      snapshot(state, { ...state.project, tileWidth, tileHeight, updatedAt: now() }),
    ),
  selectTile: (id) =>
    set((state) => {
      const tile = state.project.tiles.find((item) => item.id === id);
      if (!tile) return state;
      return {
        project: { ...state.project, activeTileId: id },
        selectedObjectId: tile.objects[0]?.id ?? null,
        selectedCollisionId: tile.collisions[0]?.id ?? null,
        selectedLayerId: tile.objects[0]?.layerId ?? tile.layers[0]?.id ?? "base",
      };
    }),
  createTile: (name, collectionId) =>
    set((state) => {
      const tile: Tile = {
        id: newId(),
        name: name.trim() || "Namnlös tile",
        category: "Övrigt",
        tags: [],
        collectionId,
        layers: defaultLayers(),
        objects: [],
        collisions: [],
        anchor: defaultAnchor(),
      };
      return {
        ...snapshot(state, {
          ...state.project,
          activeTileId: tile.id,
          tiles: [...state.project.tiles, tile],
          updatedAt: now(),
        }),
        selectedObjectId: null,
        selectedCollisionId: null,
        selectedLayerId: "base",
        tool: "iso-box",
      };
    }),
  duplicateTile: (id) =>
    set((state) => {
      const source = state.project.tiles.find((tile) => tile.id === id);
      if (!source) return state;
      const tile: Tile = {
        ...source,
        id: newId(),
        name: `${source.name} kopia`,
        layers: source.layers.map((layer) => ({ ...layer })),
        objects: source.objects.map((object) => ({
          ...object,
          id: newId(),
          points: object.points.map((point) => ({ ...point })),
          style: { ...object.style },
        })),
        collisions: source.collisions.map((collision) => ({
          ...collision,
          id: newId(),
          points: collision.points.map((point) => ({ ...point })),
        })),
        anchor: {
          image: { ...source.anchor.image },
          tile: { ...source.anchor.tile },
          sort: { ...source.anchor.sort },
          baseline: source.anchor.baseline,
        },
      };
      return {
        ...snapshot(state, {
          ...state.project,
          activeTileId: tile.id,
          tiles: [...state.project.tiles, tile],
          updatedAt: now(),
        }),
        selectedObjectId: tile.objects[0]?.id ?? null,
        selectedCollisionId: tile.collisions[0]?.id ?? null,
      };
    }),
  deleteTile: (id) =>
    set((state) => {
      if (state.project.tiles.length <= 1) return state;
      const tiles = state.project.tiles.filter((tile) => tile.id !== id);
      const nextActive =
        state.project.activeTileId === id ? tiles[0].id : state.project.activeTileId;
      const active = tiles.find((tile) => tile.id === nextActive)!;
      return {
        ...snapshot(state, {
          ...state.project,
          activeTileId: nextActive,
          tiles,
          updatedAt: now(),
        }),
        selectedObjectId: active.objects[0]?.id ?? null,
        selectedCollisionId: active.collisions[0]?.id ?? null,
      };
    }),
  createCollection: (name) =>
    set((state) => {
      const trimmed = name.trim();
      if (!trimmed) return state;
      return snapshot(state, {
        ...state.project,
        collections: [
          ...state.project.collections,
          { id: newId(), name: trimmed },
        ],
        updatedAt: now(),
      });
    }),
  moveTileToCollection: (tileId, collectionId) =>
    set((state) =>
      snapshot(state, {
        ...state.project,
        tiles: state.project.tiles.map((tile) =>
          tile.id === tileId ? { ...tile, collectionId } : tile,
        ),
        updatedAt: now(),
      }),
    ),
  importTiles: (tilesToImport, collectionName) =>
    set((state) => {
      const collectionId = newId();
      const imported = tilesToImport.map((tile) => ({
        ...tile,
        id: newId(),
        collectionId,
        layers: tile.layers?.length ? tile.layers.map((layer) => ({ ...layer })) : defaultLayers(),
        objects: (tile.objects ?? []).map((object) => ({
          ...object,
          id: newId(),
          points: object.points.map((point) => ({ ...point })),
          style: { ...object.style },
        })),
        collisions: (tile.collisions ?? []).map((collision) => ({
          ...collision,
          id: newId(),
          points: collision.points.map((point) => ({ ...point })),
        })),
        anchor: tile.anchor ?? defaultAnchor(),
      }));
      if (!imported.length) return state;
      return {
        ...snapshot(state, {
          ...state.project,
          activeTileId: imported[0].id,
          collections: [
            ...state.project.collections,
            { id: collectionId, name: collectionName?.trim() || "Importerade filer" },
          ],
          tiles: [...state.project.tiles, ...imported],
          updatedAt: now(),
        }),
        selectedObjectId: imported[0].objects[0]?.id ?? null,
      };
    }),
  undo: () =>
    set((state) => {
      const previous = state.history.at(-1);
      if (!previous) return state;
      return {
        project: previous,
        history: state.history.slice(0, -1),
        future: [state.project, ...state.future],
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return state;
      return {
        project: next,
        history: [...state.history, state.project],
        future: state.future.slice(1),
      };
    }),
  saveNow: async () => {
    const project = get().project;
    await saveProject(project);
    set({ autosaveState: "saved" });
  },
}));
