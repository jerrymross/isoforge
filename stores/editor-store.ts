"use client";

import { create } from "zustand";
import type {
  Layer,
  Point,
  Project,
  Tile,
  Tool,
  VectorObject,
} from "@/types/editor";
import { saveProject } from "@/lib/project-db";

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
    tiles: Array<Tile & { collectionId?: string }>;
  };
  if (legacy.collections?.length) {
    return {
      ...project,
      tiles: legacy.tiles.map((tile) => ({
        ...tile,
        collectionId: tile.collectionId ?? legacy.collections![0].id,
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
      })),
      ...fallback.tiles.filter((tile) => !existingIds.has(tile.id)),
    ],
  };
}

type EditorState = {
  project: Project;
  tool: Tool;
  selectedObjectId: string | null;
  selectedLayerId: string;
  zoom: number;
  previewMode: "single" | "grid";
  showGuides: boolean;
  history: Project[];
  future: Project[];
  autosaveState: "saved" | "saving";
  setTool: (tool: Tool) => void;
  selectObject: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPreviewMode: (mode: "single" | "grid") => void;
  toggleGuides: () => void;
  addObject: (object: VectorObject) => void;
  updateObject: (id: string, patch: Partial<VectorObject>) => void;
  moveObject: (id: string, points: Point[]) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  toggleLayer: (id: string, field: "visible" | "locked") => void;
  setSelectedLayer: (id: string) => void;
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
  selectedObjectId: "starter-box",
  selectedLayerId: "base",
  zoom: 1,
  previewMode: "single",
  showGuides: true,
  history: [],
  future: [],
  autosaveState: "saved",
  setTool: (tool) => set({ tool }),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  setZoom: (zoom) => set({ zoom }),
  setPreviewMode: (previewMode) => set({ previewMode }),
  toggleGuides: () => set((state) => ({ showGuides: !state.showGuides })),
  addObject: (object) =>
    set((state) =>
      snapshot(
        state,
        updateActiveTile(state.project, (tile) => ({
          ...tile,
          objects: [...tile.objects, object],
        })),
      ),
    ),
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
  setSelectedLayer: (selectedLayerId) => set({ selectedLayerId }),
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
