import { readBitmap, type Palette, type Raster } from './graphics';

/** Lettering in cntlbtnh.bmp, in source pixels. Live captions are React text.
 * See docs/control-bar.md. Keep the imported preservation bitmap untouched. */
export const CONTROL_BAR_TEXT = [
  { x: 3, y: 20, width: 26, height: 10 },
  { x: 35, y: 20, width: 26, height: 10 },
  { x: 225, y: 19, width: 30, height: 12 },
  { x: 416, y: 2, width: 44, height: 12 },
  { x: 416, y: 18, width: 44, height: 12 },
] as const;

export function readControlBar(bytes: Uint8Array, palette: Palette): Raster {
  const raster = readBitmap(bytes, palette);
  if (raster.width !== 640 || raster.height !== 32) throw new Error('Invalid control-bar dimensions');
  for (const { x, y, width, height } of CONTROL_BAR_TEXT) {
    for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) {
      raster.rgba.set([...palette[12], 255], (row * raster.width + column) * 4);
    }
  }
  return raster;
}
