import type { Layer, VectorObject } from "@/types/editor";

export function sortObjectsByLayer(
  objects: VectorObject[],
  layers: Layer[],
): VectorObject[] {
  const order = new Map(layers.map((layer, index) => [layer.id, index]));
  return objects
    .map((object, index) => ({ object, index }))
    .sort(
      (a, b) =>
        (order.get(a.object.layerId) ?? -1) -
          (order.get(b.object.layerId) ?? -1) ||
        a.index - b.index,
    )
    .map(({ object }) => object);
}

export function effectiveObjectOpacity(
  object: VectorObject,
  layers: Layer[],
): number {
  const layerOpacity =
    layers.find((layer) => layer.id === object.layerId)?.opacity ?? 1;
  return Math.max(0, Math.min(1, object.style.opacity * layerOpacity));
}
