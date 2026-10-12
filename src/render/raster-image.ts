import type { Raster } from '../formats/graphics';

/** Canvas conversion stays in render; asset loading supplies decoded pixels. */
export async function rasterImage(raster: Raster, signal: AbortSignal): Promise<HTMLImageElement> {
  signal.throwIfAborted();
  const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas rendering unavailable');
  context.putImageData(new ImageData(Uint8ClampedArray.from(raster.rgba), raster.width, raster.height), 0, 0);
  const image = new Image(); image.src = canvas.toDataURL(); await image.decode();
  signal.throwIfAborted(); return image;
}

/** Synchronous PNG data URL of a decoded raster, for CSS sprites of generated artwork. */
export function rasterDataUrl(raster: Raster): string {
  const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas rendering unavailable');
  context.putImageData(new ImageData(Uint8ClampedArray.from(raster.rgba), raster.width, raster.height), 0, 0);
  return canvas.toDataURL();
}
