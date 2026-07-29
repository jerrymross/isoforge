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
  });
});
