"use client";

import {
  AlertTriangle,
  Link2,
  Magnet,
  MoveDown,
  Paintbrush,
  RotateCw,
  ScanLine,
  SlidersHorizontal,
} from "lucide-react";
import {
  TILED_ISOMETRIC_TILT,
  validateProject,
} from "@/features/drawing/geometry";
import { useEditorStore } from "@/stores/editor-store";

export function Inspector() {
  const {
    project,
    selectedObjectId,
    autoAngle,
    autoTilt,
    updateObject,
    setObjectAngle,
    setAutoAngle,
    setAutoTilt,
    setObjectTilt,
    setWorkspaceMode,
    setAnchorPoint,
    setBaseline,
  } = useEditorStore();
  const tile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const selected = tile.objects.find((object) => object.id === selectedObjectId);
  const issues = validateProject(project);

  if (!selected) {
    return (
      <section className="inspector-card">
        <div className="inspector-heading"><SlidersHorizontal size={15} /> Egenskaper</div>
        <p className="empty-copy">Markera ett objekt för att redigera dess vektoregenskaper.</p>
      </section>
    );
  }

  return (
    <section className="inspector-card">
      <div className="inspector-heading">
        <span><SlidersHorizontal size={15} /> Egenskaper</span>
        <button className="painter-open-button" onClick={() => setWorkspaceMode("painter")} title="Öppna markerat objekt i Painter">
          <Paintbrush size={12} /> Painter
        </button>
        <span className="linked"><Link2 size={12} /> Länkad stil</span>
      </div>
      <label className="field-row">
        <span>Namn</span>
        <input
          value={selected.name}
          onChange={(event) => updateObject(selected.id, { name: event.target.value })}
        />
      </label>
      <div className="field-pair">
        <label>
          <span>Fyllning</span>
          <div className="color-field">
            <input
              type="color"
              value={selected.style.fill}
              onChange={(event) =>
                updateObject(selected.id, {
                  style: { ...selected.style, fill: event.target.value },
                })
              }
            />
            <code>{selected.style.fill}</code>
          </div>
        </label>
        <label>
          <span>Linje</span>
          <div className="color-field">
            <input
              type="color"
              value={selected.style.stroke}
              onChange={(event) =>
                updateObject(selected.id, {
                  style: { ...selected.style, stroke: event.target.value },
                })
              }
            />
            <code>{selected.style.stroke}</code>
          </div>
        </label>
      </div>
      <label className="range-field">
        <span>Linjetjocklek <b>{selected.style.strokeWidth}px</b></span>
        <input
          type="range"
          min="0"
          max="8"
          step="0.5"
          value={selected.style.strokeWidth}
          onChange={(event) =>
            updateObject(selected.id, {
              style: { ...selected.style, strokeWidth: Number(event.target.value) },
            })
          }
        />
      </label>
      <label className="range-field">
        <span>Transparens <b>{Math.round(selected.style.opacity * 100)}%</b></span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={selected.style.opacity}
          onChange={(event) =>
            updateObject(selected.id, {
              style: { ...selected.style, opacity: Number(event.target.value) },
            })
          }
        />
      </label>
      <div className="angle-editor">
        <div className="angle-editor-heading">
          <span><RotateCw size={13} /> Rotation i tileplanet</span>
          <button
            className={autoAngle ? "active" : ""}
            onClick={() => setAutoAngle(!autoAngle)}
            title="Snäpp till isometriska standardvinklar"
          >
            <Magnet size={12} />
            Auto {autoAngle ? "på" : "av"}
          </button>
        </div>
        <div className="angle-input-row">
          <input
            type="number"
            min="-180"
            max="180"
            step={autoAngle ? "0.001" : "1"}
            value={Number((selected.rotation ?? 0).toFixed(3))}
            onChange={(event) =>
              setObjectAngle(selected.id, Number(event.target.value))
            }
            aria-label="Objektets rotation"
          />
          <span>°</span>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={selected.rotation ?? 0}
            onChange={(event) =>
              setObjectAngle(selected.id, Number(event.target.value))
            }
            aria-label="Justera objektets rotation"
          />
        </div>
        <div className="angle-presets">
          {[-90, -26.565, 0, 26.565, 90].map((angle) => (
            <button
              key={angle}
              className={Math.abs((selected.rotation ?? 0) - angle) < 0.01 ? "active" : ""}
              onClick={() => setObjectAngle(selected.id, angle)}
            >
              {angle > 0 ? "+" : ""}{angle}°
            </button>
          ))}
        </div>
        <small>
          {autoAngle
            ? "Snappar till horisontell, vertikal och isometriska riktningar."
            : "Fri rotation i valfri vinkel."}
        </small>
      </div>
      <div className="angle-editor tilt-editor">
        <div className="angle-editor-heading">
          <span><MoveDown size={13} /> Tilt framåt</span>
          <button
            className={autoTilt ? "active" : ""}
            onClick={() => setAutoTilt(!autoTilt)}
            title="Anpassa framåttiltningen till Tiled 2:1-isometri"
          >
            <Magnet size={12} />
            Tiled {autoTilt ? "på" : "av"}
          </button>
        </div>
        <div className="angle-input-row">
          <input
            type="number"
            min="0"
            max="75"
            step={autoTilt ? "0.001" : "0.5"}
            value={Number((selected.tilt ?? 0).toFixed(3))}
            onChange={(event) =>
              setObjectTilt(selected.id, Number(event.target.value))
            }
            aria-label="Objektets framåttiltning"
          />
          <span>°</span>
          <input
            type="range"
            min="0"
            max="75"
            step="0.5"
            value={selected.tilt ?? 0}
            onChange={(event) =>
              setObjectTilt(selected.id, Number(event.target.value))
            }
            aria-label="Justera objektets framåttiltning"
          />
        </div>
        <div className="angle-presets tilt-presets">
          {[0, TILED_ISOMETRIC_TILT, 45, 63.435].map((tilt) => (
            <button
              key={tilt}
              className={Math.abs((selected.tilt ?? 0) - tilt) < 0.01 ? "active" : ""}
              onClick={() => setObjectTilt(selected.id, tilt)}
            >
              {tilt === TILED_ISOMETRIC_TILT ? "Tiled " : ""}{tilt}°
            </button>
          ))}
        </div>
        <small>
          Tilt är en framåtlutning med vertikal förkortning runt objektets bas,
          inte en rotation. Tiled 2:1 använder {TILED_ISOMETRIC_TILT}°.
        </small>
      </div>
      <div className="depth-editor">
        <div className="depth-editor-heading">
          <ScanLine size={13} />
          Sortering och baslinje
        </div>
        <div className="depth-fields">
          <label>
            <span>Sort X</span>
            <input
              type="number"
              value={Math.round(tile.anchor.sort.x)}
              onChange={(event) =>
                setAnchorPoint("sort", {
                  ...tile.anchor.sort,
                  x: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            <span>Sort Y</span>
            <input
              type="number"
              value={Math.round(tile.anchor.sort.y)}
              onChange={(event) =>
                setAnchorPoint("sort", {
                  ...tile.anchor.sort,
                  y: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="baseline-field">
            <span>Baslinje</span>
            <input
              type="number"
              value={Math.round(tile.anchor.baseline)}
              onChange={(event) => setBaseline(Number(event.target.value))}
            />
          </label>
        </div>
        <small>Den orange testfiguren växlar automatiskt mellan bakom och framför vid sorteringspunkten.</small>
      </div>
      <div className={issues.length ? "validation-mini warning" : "validation-mini"}>
        <AlertTriangle size={14} />
        <span>{issues.length ? `${issues.length} varning att kontrollera` : "Redo för export"}</span>
      </div>
    </section>
  );
}
