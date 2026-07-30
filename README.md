# Isoforge Tile Studio

En webbaserad isometrisk vektoreditor för att skapa tiles och objekt för Tiled.

## Funktioner

- SVG-baserad isometrisk rityta
- 2D-till-isometrisk konvertering och parametriska objekt
- Tilebibliotek och samlingar
- Lager, kollisionsformer, ankare och sorteringspunkt
- Isometrisk live-preview
- Export till PNG, SVG, TSX, JSON och ZIP
- Lokal autosave via IndexedDB
- Ljust och mörkt läge

## Lokal utveckling

Node.js 22 eller senare rekommenderas.

```bash
npm install
npm run dev
```

Öppna sedan `http://localhost:3000`.

## Kontroll

```bash
npm test
npm run build
```

Projektet är ett vanligt Next.js-projekt och kan driftsättas direkt på Vercel.
