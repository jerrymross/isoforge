"use client";

import { useMemo, useState } from "react";
import { Box, Circle, Grid3X3, Layers3, Plus, SlidersHorizontal } from "lucide-react";
import { VectorShape } from "@/components/editor/VectorScene";
import {
  finalizeGeneratedObjects,
  primitiveObjects,
  templateObjects,
  type GeneratorParams,
  type ObjectTemplate,
  type PrimitiveKind,
} from "@/features/drawing/generators";
import { useEditorStore } from "@/stores/editor-store";
import type { WorkspaceMode } from "@/types/editor";

type Props = {
  mode: Exclude<WorkspaceMode, "draw">;
};

const materials = [
  { id: "steel", name: "Rostfritt", color: "#a9b4b1" },
  { id: "wood", name: "Trä", color: "#b9794f" },
  { id: "paint", name: "Lackerat", color: "#5f8c87" },
  { id: "brick", name: "Tegel", color: "#a65f4b" },
];

const primitives: Array<{ id: PrimitiveKind; name: string; icon: typeof Box }> = [
  { id: "floor", name: "Golv", icon: Grid3X3 },
  { id: "box", name: "Låda", icon: Box },
  { id: "cylinder", name: "Cylinder", icon: Circle },
];

const templates: Array<{ id: ObjectTemplate; name: string; marker: string }> = [
  { id: "workbench", name: "Arbetsbänk", marker: "WB" },
  { id: "shelf", name: "Hylla", marker: "HY" },
  { id: "cabinet", name: "Skåp", marker: "SK" },
  { id: "wall", name: "Vägg", marker: "VG" },
];

export function GeneratorPanel({ mode }: Props) {
  const { project, addObjects } = useEditorStore();
  const [primitive, setPrimitive] = useState<PrimitiveKind>("box");
  const [template, setTemplate] = useState<ObjectTemplate>("workbench");
  const [materialId, setMaterialId] = useState("steel");
  const [params, setParams] = useState<GeneratorParams>({
    width: 128,
    depth: 64,
    height: 72,
    shelves: 3,
  });
  const [added, setAdded] = useState(false);
  const material = materials.find((item) => item.id === materialId)!;
  const isConvert = mode === "convert";
  const objects = useMemo(
    () =>
      isConvert
        ? primitiveObjects(
            primitive,
            params,
            material.color,
            project.style.strokeColor,
          )
        : templateObjects(
            template,
            params,
            material.color,
            project.style.strokeColor,
          ),
    [
      isConvert,
      material.color,
      params,
      primitive,
      project.style.strokeColor,
      template,
    ],
  );

  function setNumber(field: keyof GeneratorParams, value: number) {
    setParams((current) => ({ ...current, [field]: value }));
    setAdded(false);
  }

  function addToCanvas() {
    addObjects(finalizeGeneratedObjects(objects, () => crypto.randomUUID()));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <aside className="generator-rail" aria-label={isConvert ? "2D till isometriskt" : "Objektbyggare"}>
      <div className="generator-heading">
        <span>{isConvert ? "2D → ISO" : "OBJEKTBYGGARE"}</span>
        <strong>{isConvert ? "Omvandla form" : "Parametrisk mall"}</strong>
      </div>

      <div className="generator-preview">
        <svg viewBox="190 125 260 245" role="img" aria-label="Genererad förhandsvisning">
          <polygon points="320,272 384,304 320,336 256,304" className="generator-floor" />
          {objects.map((object) => <VectorShape key={object.id} object={object} />)}
        </svg>
        <span>Uppdateras direkt</span>
      </div>

      {isConvert ? (
        <div className="generator-choice-grid">
          {primitives.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={primitive === item.id ? "active" : ""}
                onClick={() => {
                  setPrimitive(item.id);
                  setAdded(false);
                }}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="template-grid">
          {templates.map((item) => (
            <button
              key={item.id}
              className={template === item.id ? "active" : ""}
              onClick={() => {
                setTemplate(item.id);
                setAdded(false);
              }}
            >
              <i>{item.marker}</i>
              <span>{item.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="generator-section-label"><SlidersHorizontal size={12} /> Mått</div>
      <div className="generator-fields">
        <label>
          Bredd
          <span><input type="number" min="16" max="256" value={params.width} onChange={(event) => setNumber("width", Number(event.target.value))} /> px</span>
        </label>
        <label>
          Djup
          <span><input type="number" min="8" max="192" value={params.depth} onChange={(event) => setNumber("depth", Number(event.target.value))} /> px</span>
        </label>
        {(!isConvert || primitive !== "floor") && (
          <label>
            Höjd
            <span><input type="number" min="8" max="192" value={params.height} onChange={(event) => setNumber("height", Number(event.target.value))} /> px</span>
          </label>
        )}
        {!isConvert && template === "shelf" && (
          <label>
            Hyllplan
            <span><input type="number" min="2" max="5" value={params.shelves} onChange={(event) => setNumber("shelves", Number(event.target.value))} /> st</span>
          </label>
        )}
      </div>

      <div className="generator-section-label"><Layers3 size={12} /> Material</div>
      <div className="material-list">
        {materials.map((item) => (
          <button
            key={item.id}
            className={materialId === item.id ? "active" : ""}
            onClick={() => {
              setMaterialId(item.id);
              setAdded(false);
            }}
          >
            <i style={{ background: item.color }} />
            {item.name}
          </button>
        ))}
      </div>

      <button className={added ? "generator-add success" : "generator-add"} onClick={addToCanvas}>
        {added ? "Tillagd på ritytan" : <><Plus size={15} /> Lägg till som vektorer</>}
      </button>
      <p className="generator-note">
        {isConvert
          ? "Formen omvandlas till redigerbara isometriska vektorer."
          : "Alla delar skapas separat och kan redigeras efteråt."}
      </p>
    </aside>
  );
}
