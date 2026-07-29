"use client";

import { create } from "zustand";
import type { Layer, Point, Project, Tool, VectorObject } from "@/types/editor";
import { saveProject } from "@/lib/project-db";

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();

export function createDefaultProject(): Project {
  const layers: Layer[] = [
    { id: "shadow", name: "Skugga", visible: true, locked: false, opacity: 0.6 },
    { id: "base", name: "Bas", visible: true, locked: false, opacity: 1 },
    { id: "details", name: "Detaljer", visible: true, locked: false, opacity: 1 },
    { id: "outlines", name: "Konturer", visible: true, locked: false, opacity: 1 },
    { id: "highlights", name: "Highlights", visible: true, locked: false, opacity: 1 },
  ];
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
    tiles: [
      {
        id: "tile-workbench",
        name: "Arbetsbänk",
        category: "Möbler",
        tags: ["bageri", "metall"],
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
        anchor: {
          image: { x: 320, y: 336 },
          tile: { x: 320, y: 336 },
          sort: { x: 320, y: 328 },
          baseline: 336,
        },
      },
    ],
    activeTileId: "tile-workbench",
    updatedAt: now(),
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
