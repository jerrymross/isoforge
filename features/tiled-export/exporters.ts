import JSZip from "jszip";
import type { Project, Tile, VectorObject } from "@/types/editor";
import { pointsToString, TILE_CENTER, tileDiamond } from "@/features/drawing/geometry";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderObject(object: VectorObject): string {
  const style = `fill="${object.style.fill}" stroke="${object.style.stroke}" stroke-width="${object.style.strokeWidth}" opacity="${object.style.opacity}" stroke-linejoin="round"`;
  if (object.kind === "line") {
    const [start, end] = object.points;
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" ${style} fill="none"/>`;
  }
  if (object.kind === "iso-box" && object.points.length >= 7) {
    const [top, rightTop, bottomTop, leftTop, rightBottom, bottom, leftBottom] =
      object.points;
    const topFace = pointsToString([top, rightTop, bottomTop, leftTop]);
    const rightFace = pointsToString([rightTop, rightBottom, bottom, bottomTop]);
    const leftFace = pointsToString([leftTop, bottomTop, bottom, leftBottom]);
    return [
      `<polygon points="${leftFace}" ${style} fill="${shade(object.style.fill, -18)}"/>`,
      `<polygon points="${rightFace}" ${style} fill="${shade(object.style.fill, -32)}"/>`,
      `<polygon points="${topFace}" ${style} fill="${shade(object.style.fill, 12)}"/>`,
    ].join("");
  }
  return `<polygon points="${pointsToString(object.points)}" ${style}/>`;
}

function shade(hex: string, amount: number): string {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return hex;
  const value = Number.parseInt(normalized, 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (value & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function projectToSvg(
  project: Project,
  tile: Tile,
  includeGuides = false,
): string {
  const visibleLayers = new Set(
    tile.layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );
  const guides = includeGuides
    ? `<polygon points="${pointsToString(tileDiamond(project.tileWidth, project.tileHeight))}" fill="none" stroke="#65a3a8" stroke-width="1" stroke-dasharray="5 5"/>
       <line x1="${TILE_CENTER.x - project.tileWidth / 2}" y1="${tile.anchor.baseline}" x2="${TILE_CENTER.x + project.tileWidth / 2}" y2="${tile.anchor.baseline}" stroke="#e86a48" stroke-width="1"/>
       <circle cx="${tile.anchor.image.x}" cy="${tile.anchor.image.y}" r="4" fill="#e86a48"/>`
    : "";
  const objects = tile.objects
    .filter((object) => visibleLayers.has(object.layerId))
    .map(renderObject)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" width="640" height="480">
    ${guides}${objects}
  </svg>`;
}

export function projectToTsx(project: Project, tile: Tile): string {
  const name = escapeXml(project.name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.11" tiledversion="1.11.2" name="${name}" tilewidth="${project.tileWidth}" tileheight="${project.tileHeight}" tilecount="1" columns="1">
 <tileoffset x="${Math.round(tile.anchor.image.x - 320)}" y="${Math.round(tile.anchor.image.y - 336)}"/>
 <image source="tileset.png" width="${project.tileWidth}" height="${project.canvasHeight}"/>
 <tile id="0">
  <properties>
   <property name="category" value="${escapeXml(tile.category)}"/>
   <property name="anchorX" type="int" value="${Math.round(tile.anchor.image.x)}"/>
   <property name="anchorY" type="int" value="${Math.round(tile.anchor.image.y)}"/>
   <property name="sortX" type="int" value="${Math.round(tile.anchor.sort.x)}"/>
   <property name="sortY" type="int" value="${Math.round(tile.anchor.sort.y)}"/>
   <property name="height" type="int" value="${project.canvasHeight}"/>
   <property name="material" value="default"/>
  </properties>
 </tile>
</tileset>`;
}

function download(blob: Blob, filename: string): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadText(content: string, filename: string, type: string): void {
  download(new Blob([content], { type }), filename);
}

async function svgToPngBlob(svg: string, scale = 2): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("SVG kunde inte rastreras"));
  });
  image.src = url;
  await loaded;
  const canvas = document.createElement("canvas");
  canvas.width = 640 * scale;
  canvas.height = 480 * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas saknar 2D-kontext");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0);
  URL.revokeObjectURL(url);
  const png = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("PNG-export misslyckades"))),
      "image/png",
    ),
  );
  return png;
}

export async function svgToPng(svg: string, filename: string, scale = 2): Promise<Blob> {
  const png = await svgToPngBlob(svg, scale);
  download(png, filename);
  return png;
}

export async function downloadExportZip(project: Project, tile: Tile): Promise<void> {
  const svg = projectToSvg(project, tile);
  const png = await svgToPngBlob(svg);
  const zip = new JSZip();
  zip.file("tile.svg", svg);
  zip.file("tileset.png", png);
  zip.file("tileset.tsx", projectToTsx(project, tile));
  zip.file("project.json", JSON.stringify(project, null, 2));
  const archive = await zip.generateAsync({ type: "blob" });
  download(archive, `${project.name.toLowerCase().replaceAll(/\s+/g, "-")}.zip`);
}

export { shade };
