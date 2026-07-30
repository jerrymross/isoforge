import { describe, expect, it } from "vitest";
import { projectToSvg, projectToTsx } from "./exporters";
import { createDefaultProject } from "@/stores/editor-store";

function createProjectWithBox() {
  const project = createDefaultProject();
  const tile = project.tiles[0];
  tile.objects.push({
    id: "test-box",
    name: "Testbox",
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
  });
  tile.collisions.push({
    id: "test-collision",
    name: "Bas",
    kind: "diamond",
    points: [
      { x: 320, y: 261 },
      { x: 390, y: 296 },
      { x: 320, y: 331 },
      { x: 250, y: 296 },
    ],
    enabled: true,
  });
  return project;
}

describe("Tiled-export", () => {
  it("skapar deterministisk SVG med tre boxytor", () => {
    const project = createProjectWithBox();
    const tile = project.tiles[0];
    const svg = projectToSvg(project, tile);
    expect(svg.match(/<polygon/g)).toHaveLength(3);
    expect(svg).toContain('viewBox="0 0 640 480"');
  });

  it("skapar TSX med korrekta mått och properties", () => {
    const project = createProjectWithBox();
    const tile = project.tiles[0];
    const tsx = projectToTsx(project, tile);
    expect(tsx).toContain('tilewidth="128"');
    expect(tsx).toContain('tileheight="64"');
    expect(tsx).toContain('name="anchorX"');
    expect(tsx).toContain('<tileoffset');
    expect(tsx).toContain('<objectgroup name="collision">');
    expect(tsx).toContain('name="collisionCount" type="int" value="1"');
    expect(tsx).toContain("<polygon");
  });

  it("preserves edited object rotation in SVG export", () => {
    const project = createProjectWithBox();
    project.tiles[0].objects[0] = {
      ...project.tiles[0].objects[0],
      rotation: 26.565,
    };
    const svg = projectToSvg(project, project.tiles[0]);
    expect(svg).toContain('transform="rotate(26.565');
  });

  it("exports forward tilt as a separate SVG transform", () => {
    const project = createProjectWithBox();
    project.tiles[0].objects[0] = {
      ...project.tiles[0].objects[0],
      tilt: 26.565,
    };
    const svg = projectToSvg(project, project.tiles[0]);
    expect(svg).toContain("scale(1 0.894428)");
    expect(svg).not.toContain('transform="rotate(');
  });

  it("exports objects in layer order with effective layer opacity", () => {
    const project = createProjectWithBox();
    const tile = project.tiles[0];
    tile.layers.find((layer) => layer.id === "base")!.opacity = 0.5;
    tile.objects.push({
      ...tile.objects[0],
      id: "shadow-copy",
      name: "Shadow",
      layerId: "shadow",
      style: { ...tile.objects[0].style, fill: "#111111" },
    });
    const svg = projectToSvg(project, tile);
    expect(svg.indexOf("#111111")).toBeLessThan(svg.indexOf("#e9a85d"));
    expect(svg).toContain('opacity="0.5"');
  });
});
