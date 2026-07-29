"use client";

import { useMemo, useRef, useState } from "react";
import {
  Box,
  Check,
  Copy,
  FileUp,
  Folder,
  FolderPlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { VectorShape } from "@/components/editor/VectorScene";
import { useEditorStore } from "@/stores/editor-store";
import type { Tile } from "@/types/editor";

type LibraryDialog = "tile" | "collection" | "delete" | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function importedTiles(value: unknown): Tile[] {
  if (!isRecord(value)) return [];
  if (Array.isArray(value.tiles)) return value.tiles as Tile[];
  if (
    typeof value.name === "string" &&
    Array.isArray(value.layers) &&
    Array.isArray(value.objects)
  ) {
    return [value as unknown as Tile];
  }
  return [];
}

export function TileLibrary() {
  const {
    project,
    selectTile,
    createTile,
    duplicateTile,
    deleteTile,
    createCollection,
    moveTileToCollection,
    importTiles,
  } = useEditorStore();
  const activeTile = project.tiles.find((item) => item.id === project.activeTileId)!;
  const fileInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [dialog, setDialog] = useState<LibraryDialog>(null);
  const [name, setName] = useState("");
  const [newTileCollection, setNewTileCollection] = useState(activeTile.collectionId);
  const [notice, setNotice] = useState<string | null>(null);

  const visibleTiles = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("sv");
    return project.tiles.filter((tile) => {
      const inCollection =
        collectionFilter === "all" || tile.collectionId === collectionFilter;
      const matches =
        !normalized ||
        `${tile.name} ${tile.category} ${tile.tags.join(" ")}`
          .toLocaleLowerCase("sv")
          .includes(normalized);
      return inCollection && matches;
    });
  }, [collectionFilter, project.tiles, query]);

  function openDialog(next: Exclude<LibraryDialog, null>) {
    setName("");
    setNewTileCollection(activeTile.collectionId);
    setDialog(next);
  }

  function confirmDialog() {
    if (dialog === "tile") {
      createTile(name, newTileCollection);
    } else if (dialog === "collection") {
      createCollection(name);
    } else if (dialog === "delete") {
      deleteTile(activeTile.id);
    }
    setDialog(null);
  }

  async function importFile(file: File) {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const tiles = importedTiles(parsed);
      if (!tiles.length) throw new Error("Filen innehåller inga Isoforge-tiles.");
      const collectionName = isRecord(parsed) && typeof parsed.name === "string"
        ? parsed.name
        : file.name.replace(/\.[^.]+$/, "");
      importTiles(tiles, collectionName);
      setNotice(`${tiles.length} tile${tiles.length === 1 ? "" : "s"} importerades`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Filen kunde inte importeras.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
      window.setTimeout(() => setNotice(null), 3200);
    }
  }

  return (
    <section className="bottom-section library-section">
      <div className="bottom-heading">
        <span><Box size={15} /> Tilebibliotek <b>{project.tiles.length}</b></span>
        <div className="library-actions">
          <label className="mini-search">
            <Search size={13} />
            <input
              aria-label="Sök tiles"
              placeholder="Sök tiles…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button title="Importera projekt eller tile" aria-label="Importera fil" onClick={() => fileInput.current?.click()}>
            <FileUp size={14} />
          </button>
          <button title="Ny samling" aria-label="Skapa samling" onClick={() => openDialog("collection")}>
            <FolderPlus size={14} />
          </button>
          <button title="Duplicera aktiv tile" aria-label="Duplicera tile" onClick={() => duplicateTile(activeTile.id)}>
            <Copy size={14} />
          </button>
          <button
            className="danger-action"
            title="Ta bort aktiv tile"
            aria-label="Ta bort tile"
            disabled={project.tiles.length <= 1}
            onClick={() => openDialog("delete")}
          >
            <Trash2 size={14} />
          </button>
          <button className="new-tile-button" onClick={() => openDialog("tile")}>
            <Plus size={14} /> Ny
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,.isoforge,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
            }}
          />
        </div>
      </div>

      <div className="collection-bar">
        <button
          className={collectionFilter === "all" ? "active" : ""}
          onClick={() => setCollectionFilter("all")}
        >
          Alla <span>{project.tiles.length}</span>
        </button>
        {project.collections.map((collection) => (
          <button
            key={collection.id}
            className={collectionFilter === collection.id ? "active" : ""}
            onClick={() => setCollectionFilter(collection.id)}
          >
            <Folder size={11} />
            {collection.name}
            <span>{project.tiles.filter((tile) => tile.collectionId === collection.id).length}</span>
          </button>
        ))}
        <label className="move-collection">
          Aktiv tile:
          <select
            aria-label="Flytta aktiv tile till samling"
            value={activeTile.collectionId}
            onChange={(event) => moveTileToCollection(activeTile.id, event.target.value)}
          >
            {project.collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tile-strip">
        {visibleTiles.map((tile) => (
          <button
            className={tile.id === activeTile.id ? "tile-card active" : "tile-card"}
            key={tile.id}
            onClick={() => selectTile(tile.id)}
          >
            <div className="tile-thumb">
              {tile.objects.length ? (
                <svg viewBox="180 130 280 250">
                  {tile.objects.map((object) => (
                    <VectorShape key={object.id} object={object} />
                  ))}
                </svg>
              ) : (
                <div className="empty-tile-thumb"><Plus size={18} /></div>
              )}
              {tile.id === activeTile.id && <span className="active-check"><Check size={11} /></span>}
            </div>
            <span>{tile.name}</span>
            <small>{tile.category}</small>
          </button>
        ))}
        <button className="tile-card add-tile" onClick={() => openDialog("tile")}>
          <i>+</i>
          <span>Ny tile</span>
        </button>
        {!visibleTiles.length && (
          <div className="library-empty">
            <Search size={18} />
            <span>Inga tiles matchar filtret.</span>
          </div>
        )}
      </div>

      {notice && <div className="library-notice">{notice}</div>}

      {dialog && (
        <div className="library-dialog-backdrop" onMouseDown={() => setDialog(null)}>
          <div className="library-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="library-dialog-heading">
              <div>
                {dialog === "tile" ? <Plus size={16} /> : dialog === "collection" ? <FolderPlus size={16} /> : <Trash2 size={16} />}
                <strong>
                  {dialog === "tile" ? "Skapa ny tile" : dialog === "collection" ? "Skapa samling" : "Ta bort tile?"}
                </strong>
              </div>
              <button aria-label="Stäng" onClick={() => setDialog(null)}><X size={16} /></button>
            </div>
            {dialog === "delete" ? (
              <p><b>{activeTile.name}</b> tas bort från projektet. Du kan ångra åtgärden via historiken.</p>
            ) : (
              <>
                <label>
                  Namn
                  <input
                    autoFocus
                    value={name}
                    placeholder={dialog === "tile" ? "Exempel: Hörnvägg" : "Exempel: Industrikök"}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && name.trim()) confirmDialog();
                    }}
                  />
                </label>
                {dialog === "tile" && (
                  <label>
                    Samling
                    <select value={newTileCollection} onChange={(event) => setNewTileCollection(event.target.value)}>
                      {project.collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>{collection.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <div className="library-dialog-actions">
              <button onClick={() => setDialog(null)}>Avbryt</button>
              <button
                className={dialog === "delete" ? "danger-confirm" : "primary-confirm"}
                disabled={dialog !== "delete" && !name.trim()}
                onClick={confirmDialog}
              >
                {dialog === "tile" ? "Skapa tile" : dialog === "collection" ? "Skapa samling" : "Ta bort"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
