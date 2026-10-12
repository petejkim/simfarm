// Presentation assets only. Pair each decoded atlas with the same source indices
// mapped through palette[index ^ 15]; RGB inversion is not equivalent.
const inverted = new WeakMap<CanvasImageSource, CanvasImageSource>();
export function registerInvertedTiles<T extends CanvasImageSource>(normal: T, inverse: CanvasImageSource): T {
  inverted.set(normal, inverse);
  return normal;
}
export function invertedTiles(normal: CanvasImageSource): CanvasImageSource {
  const image = inverted.get(normal);
  if (!image) throw new Error('Missing original outline atlas');
  return image;
}
