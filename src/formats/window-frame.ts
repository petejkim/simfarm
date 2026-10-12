import type { Raster } from './graphics';

/** Wooden window frame 9-slice (docs/ui-components.md), cut from the Sell bitmap (sellwndo.bmp), whose
 * client never touches its frame. Layout of the 24×16 image: columns 0..7 left edge, 8..15 a middle
 * column, 16..23 right edge; rows 0..7 a run of the uniform sides, rows 8..15 the 8-row bottom with its
 * mitred corners. Used as `border-image-slice: 0 8 8` (the shared title bar supplies the top). */
export const WINDOW_FRAME = { edge: 8, width: 24, height: 16 } as const;
const SIDE_ROWS = 16; // first 8-row grain period below the title bar (sides repeat every 8 rows)

export function readWindowFrame(sell: Raster): Raster {
  if (sell.width !== 192 || sell.height !== 256) throw new Error('Invalid Sell artwork for the window frame');
  const { edge, width, height } = WINDOW_FRAME, rgba = new Uint8Array(width * height * 4);
  const copy = (sx: number, sy: number, dx: number, dy: number) => {
    for (let y = 0; y < edge; y++) rgba.set(sell.rgba.subarray(((sy + y) * sell.width + sx) * 4, ((sy + y) * sell.width + sx + edge) * 4), ((dy + y) * width + dx) * 4);
  };
  const right = sell.width - edge, bottom = sell.height - edge, middle = sell.width / 2;
  copy(0, SIDE_ROWS, 0, 0); copy(middle, SIDE_ROWS, edge, 0); copy(right, SIDE_ROWS, 2 * edge, 0);
  copy(0, bottom, 0, edge); copy(middle, bottom, edge, edge); copy(right, bottom, 2 * edge, edge);
  return { width, height, rgba };
}
