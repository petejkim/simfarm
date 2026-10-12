import { readBitmap, type Palette, type Raster } from './graphics';

/** Launcher geometry in cntlbtnh.bmp: 32px pitch, 1px black frame + 2px bevel, then a 26×26 picture face.
 * The native toolbar draws frame/bevel with CSS and uses only the faces as a sprite sheet. */
export const CONTROL_BAR_LAUNCHER = { size: 32, inset: 3, face: 26 } as const;

/** Lettering in cntlbtnh.bmp, in source pixels. Live captions are React text.
 * Launcher captions occupy face rows 21..27 only, so the bevel and picture above stay source pixels.
 * See docs/control-bar.md. Keep the imported preservation bitmap untouched. */
export const CONTROL_BAR_TEXT = [
  { x: 3, y: 21, width: 26, height: 7 },
  { x: 35, y: 21, width: 26, height: 7 },
  { x: 227, y: 21, width: 26, height: 7 },
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
