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
  TileGuideMode,
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

function normalizeGuideMode(
  mode: TileGuideMode | "wall" | undefined,
): TileGuideMode {
  return mode === "wall" ? "wall-left" : mode ?? "floor";
}

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

export function createEmptyTile(): Tile {
  return {
    id: "tile-start",
    name: "Ny tile",
    category: "Okategoriserad",
    tags: [],
    collectionId: "collection-my-tiles",
    layers: defaultLayers(),
    collisions: [],
    objects: [],
    anchor: defaultAnchor(),
    guideMode: "floor",
  };
}

export function createDefaultProject(): Project {
  return {
    id: "default-project",
    name: "Nytt isometriskt projekt",
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
    collections: [{ id: "collection-my-tiles", name: "Mina tiles" }],
    tiles: [createEmptyTile()],
    activeTileId: "tile-start",
    updatedAt: now(),
  };
}

export function prepareProjectForLaunch(project: Project): Project {
  const emptyTile = createEmptyTile();
  const collections = project.collections.some(
    (collection) => collection.id === emptyTile.collectionId,
  )
    ? project.collections
    : [
        { id: emptyTile.collectionId, name: "Mina tiles" },
        ...project.collections,
      ];
  return {
    ...project,
    collections,
    tiles: [
      emptyTile,
      ...project.tiles.filter((tile) => tile.id !== emptyTile.id),
    ],
    activeTileId: emptyTile.id,
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
        guideMode: normalizeGuideMode(
          tile.guideMode as TileGuideMode | "wall" | undefined,
        ),
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
        guideMode: normalizeGuideMode(
          tile.guideMode as TileGuideMode | "wall" | undefined,
        ),
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
  selectedObjectIds: string[];
  selectedCollisionId: string | null;
  selectedLayerId: string;
  zoom: number;
  canvasZoom: number;
  gridSnap: boolean;
  denseGrid: boolean;
  previewMode: "single" | "grid";
  showGuides: boolean;
  showAnchors: boolean;
  showCollisions: boolean;
  autoAngle: boolean;
  autoTilt: boolean;
  proportionalNodes: boolean;
  history: Project[];
  future: Project[];
  autosaveState: "saved" | "saving";
  setTool: (tool: Tool) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  selectObject: (id: string | null, additive?: boolean) => void;
  selectAllObjects: () => void;
  selectCollision: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setCanvasZoom: (zoom: number) => void;
  setGridSnap: (enabled: boolean) => void;
  setDenseGrid: (enabled: boolean) => void;
  setPreviewMode: (mode: "single" | "grid") => void;
  toggleGuides: () => void;
  toggleAnchors: () => void;
  setShowCollisions: (visible: boolean) => void;
  setAutoAngle: (enabled: boolean) => void;
  setAutoTilt: (enabled: boolean) => void;
  setProportionalNodes: (enabled: boolean) => void;
  addObject: (object: VectorObject) => void;
  addObjects: (objects: VectorObject[]) => void;
  updateObject: (id: string, patch: Partial<VectorObject>) => void;
  setObjectAngle: (id: string, angle: number) => void;
  setObjectTilt: (id: string, tilt: number) => void;
  moveObject: (id: string, points: Point[]) => void;
  moveObjects: (updates: Array<{ id: string; points: Point[] }>) => void;
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
  setTileGuideMode: (mode: TileGuideMode) => void;
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
  selectedObjectId: null,
  selectedObjectIds: [],
  selectedCollisionId: null,
  selectedLayerId: "base",
  zoom: 1,
  canvasZoom: 1,
  gridSnap: true,
  denseGrid: false,
  previewMode: "single",
  showGuides: true,
  showAnchors: false,
  showCollisions: false,
  autoAngle: true,
  autoTilt: true,
  proportionalNodes: false,
  history: [],
  future: [],
  autosaveState: "saved",
  setTool: (tool) => set({ tool }),
  setWorkspaceMode: (workspaceMode) =>
    set({ workspaceMode, showCollisions: workspaceMode === "collision" }),
  selectObject: (selectedObjectId, additive = false) =>
    set((state) => {
      if (!selectedObjectId) {
        return {
          selectedObjectId: null,
          selectedObjectIds: [],
          selectedCollisionId: null,
        };
      }
      const selectedObjectIds = additive
        ? state.selectedObjectIds.includes(selectedObjectId)
          ? state.selectedObjectIds.filter((id) => id !== selectedObjectId)
          : [...state.selectedObjectIds, selectedObjectId]
        : [selectedObjectId];
      return {
        selectedObjectId: selectedObjectIds.at(-1) ?? null,
        selectedObjectIds,
        selectedCollisionId: null,
      };
    }),
  selectAllObjects: () =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      const selectedObjectIds =
        tile?.objects
          .filter((object) => {
            const layer = tile.layers.find((item) => item.id === object.layerId);
            return !object.locked && layer?.visible !== false;
          })
          .map((object) => object.id) ?? [];
      return {
        selectedObjectIds,
        selectedObjectId: selectedObjectIds.at(-1) ?? null,
        selectedCollisionId: null,
      };
    }),
  selectCollision: (selectedCollisionId) =>
    set({ selectedCollisionId, selectedObjectId: null, selectedObjectIds: [] }),
  setZoom: (zoom) => set({ zoom }),
  setCanvasZoom: (canvasZoom) => set({ canvasZoom }),
  setGridSnap: (gridSnap) => set({ gridSnap }),
  setDenseGrid: (denseGrid) => set({ denseGrid }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  toggleGuides: () => set((state) => ({ showGuides: !state.showGuides })),
  toggleAnchors: () => set((state) => ({ showAnchors: !state.showAnchors })),
  setShowCollisions: (showCollisions) => set({ showCollisions }),
  setAutoAngle: (autoAngle) => set({ autoAngle }),
  setProportionalNodes: (proportionalNodes) => set({ proportionalNodes }),
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
            state.autoTilt && object.tilt === undefined
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
        ? objects.map((object) =>
            object.tilt === undefined
              ? { ...object, tilt: TILED_ISOMETRIC_TILT }
              : object,
          )
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
        selectedObjectIds: preparedObjects.at(-1)?.id
          ? [preparedObjects.at(-1)!.id]
          : [],
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
  moveObjects: (updates) =>
    set((state) => {
      const pointsById = new Map(
        updates.map((update) => [update.id, update.points]),
      );
      return {
        project: updateActiveTile(state.project, (tile) => ({
          ...tile,
          objects: tile.objects.map((object) => {
            const points = pointsById.get(object.id);
            return points ? { ...object, points } : object;
          }),
        })),
        autosaveState: "saving",
      };
    }),
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
        selectedObjectIds: [],
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
      const selectedIds = new Set(state.selectedObjectIds);
      const targets = tile.objects.filter(
        (object) =>
          !object.locked &&
          (!selectedIds.size || selectedIds.has(object.id)),
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
      const selectedIds = new Set(state.selectedObjectIds);
      const targetIds = new Set(
        tile.objects
          .filter(
            (object) =>
              !object.locked &&
              (!selectedIds.size || selectedIds.has(object.id)),
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
      const selectedIds = new Set(state.selectedObjectIds);
      const targets = tile.objects.filter(
        (object) =>
          !object.locked &&
          (!selectedIds.size || selectedIds.has(object.id)),
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
      const selectedIds = new Set(
        state.selectedObjectIds.length
          ? state.selectedObjectIds
          : state.selectedObjectId
            ? [state.selectedObjectId]
            : [],
      );
      if (!selectedIds.size) return state;
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (tile) => ({
            ...tile,
            objects: tile.objects.filter(
              (object) => !selectedIds.has(object.id),
            ),
          })),
        ),
        selectedObjectId: null,
        selectedObjectIds: [],
      };
    }),
  duplicateSelected: () =>
    set((state) => {
      const tile = state.project.tiles.find(
        (item) => item.id === state.project.activeTileId,
      );
      const selectedIds = new Set(
        state.selectedObjectIds.length
          ? state.selectedObjectIds
          : state.selectedObjectId
            ? [state.selectedObjectId]
            : [],
      );
      const copies: VectorObject[] =
        tile?.objects
          .filter((object) => selectedIds.has(object.id))
          .map((source) => ({
            ...source,
            id: newId(),
            name: `${source.name} kopia`,
            points: source.points.map((point) => ({
              x: point.x + 12,
              y: point.y + 6,
            })),
            style: { ...source.style },
          })) ?? [];
      if (!copies.length) return state;
      const copyIds = copies.map((copy) => copy.id);
      return {
        ...snapshot(
          state,
          updateActiveTile(state.project, (activeTile) => ({
            ...activeTile,
            objects: [...activeTile.objects, ...copies],
          })),
        ),
        selectedObjectId: copyIds.at(-1) ?? null,
        selectedObjectIds: copyIds,
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
        selectedObjectIds: copies[0]?.id ? [copies[0].id] : [],
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
  setTileGuideMode: (guideMode) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          guideMode,
        })),
      ),
    ),
  selectTile: (id) =>
    set((state) => {
      const tile = state.project.tiles.find((item) => item.id === id);
      if (!tile) return state;
      return {
        project: { ...state.project, activeTileId: id },
        selectedObjectId: tile.objects[0]?.id ?? null,
        selectedObjectIds: tile.objects[0]?.id ? [tile.objects[0].id] : [],
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
        guideMode: "floor",
      };
      return {
        ...snapshot(state, {
          ...state.project,
          activeTileId: tile.id,
          tiles: [...state.project.tiles, tile],
          updatedAt: now(),
        }),
        selectedObjectId: null,
        selectedObjectIds: [],
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
        selectedObjectIds: tile.objects[0]?.id ? [tile.objects[0].id] : [],
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
        selectedObjectIds: active.objects[0]?.id ? [active.objects[0].id] : [],
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
        guideMode: normalizeGuideMode(
          tile.guideMode as TileGuideMode | "wall" | undefined,
        ),
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
        selectedObjectIds: imported[0].objects[0]?.id
          ? [imported[0].objects[0].id]
          : [],
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
