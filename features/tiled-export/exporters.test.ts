import { describe, expect, it } from "vitest";
import { projectToSvg, projectToTsx } from "./exporters";
import { createDefaultProject } from "@/stores/editor-store";

describe("Tiled-export", () => {
  it("skapar deterministisk SVG med tre boxytor", () => {
    const project = createDefaultProject();
    const tile = project.tiles[0];
    const svg = projectToSvg(project, tile);
    expect(svg.match(/<polygon/g)).toHaveLength(3);
    expect(svg).toContain('viewBox="0 0 640 480"');
  });

  it("skapar TSX med korrekta mått och properties", () => {
    const project = createDefaultProject();
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
    const project = createDefaultProject();
    project.tiles[0].objects[0] = {
      ...project.tiles[0].objects[0],
      rotation: 26.565,
    };
    const svg = projectToSvg(project, project.tiles[0]);
    expect(svg).toContain('transform="rotate(26.565');
  });

  it("exports objects in layer order with effective layer opacity", () => {
    const project = createDefaultProject();
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
