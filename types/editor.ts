export type Point = { x: number; y: number };

export type PenNode = {
  point: Point;
  inHandle?: Point;
  outHandle?: Point;
};

export type Tool =
  | "select"
  | "scale"
  | "node"
  | "pen"
  | "line"
  | "polygon"
  | "iso-box";

export type WorkspaceMode = "draw" | "convert" | "objects" | "collision";
export type TileGuideMode =
  | "floor"
  | "wall-left"
  | "wall-right"
  | "floor-object";

export type VectorKind = "line" | "polygon" | "iso-box" | "iso-cylinder";

export type VectorStyle = {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  shadow: boolean;
};

export type VectorObject = {
  id: string;
  name: string;
  kind: VectorKind;
  layerId: string;
  points: Point[];
  height: number;
  rotation?: number;
  tilt?: number;
  style: VectorStyle;
  locked: boolean;
};

export type CollisionKind = "rectangle" | "polygon" | "ellipse" | "diamond";

export type CollisionShape = {
  id: string;
  name: string;
  kind: CollisionKind;
  points: Point[];
  enabled: boolean;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
};

export type Anchor = {
  image: Point;
  tile: Point;
  sort: Point;
  baseline: number;
};

export type StyleSettings = {
  strokeWidth: number;
  strokeColor: string;
  fillColor: string;
  lightDirection: "top-left" | "top-right";
};

export type Tile = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  collectionId: string;
  objects: VectorObject[];
  collisions: CollisionShape[];
  layers: Layer[];
  anchor: Anchor;
  guideMode?: TileGuideMode;
};

export type TileCollection = {
  id: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  tileWidth: number;
  tileHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  projection: "isometric-2-1";
  style: StyleSettings;
  collections: TileCollection[];
  tiles: Tile[];
  activeTileId: string;
  updatedAt: string;
};

export type ExportSettings = {
  filename: string;
  scale: number;
  transparent: boolean;
  margin: number;
  spacing: number;
};

export type ValidationIssue = {
  id: string;
  level: "warning" | "error";
  message: string;
};
