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

/** Buy window "next item" up-arrow face in buywndo.bmp (BuyWindow spriteFace 179,75): 22×22 inside its 28px button. */
export const BUY_ARROW_FACE = { x: 179, y: 75, size: 22 } as const;
/** Native pause/resume launcher faces (user request), as a 52×26 sheet: pause at x0, resume at x26.
 * Resume is the Buy up-arrow face rotated 90° clockwise and centred in the 26×26 launcher face. Pause is two
 * engraved bars drawn only in that arrow's four sampled colours (face, outline, fill, highlight) with its
 * lighting: dark top/left edges, white bottom/right edges and a fill-coloured lip outside the dark edges. */
export function timeToggleFaces(buy: Raster): Raster {
  const { x: fx, y: fy, size } = BUY_ARROW_FACE;
  const pixel = (x: number, y: number) => Array.from(buy.rgba.subarray((y * buy.width + x) * 4, (y * buy.width + x) * 4 + 4));
  // Sampled on the arrow's left slope: outline, fill and highlight; face from the face corner.
  const face = pixel(fx, fy), dark = pixel(fx + 10, fy + 4), fill = pixel(fx + 9, fy + 4), light = pixel(fx + 12, fy + 4);
  const luma = (c: number[]) => c[0] + c[1] + c[2];
  if (!(luma(dark) < luma(fill) && luma(fill) < luma(face) && luma(face) < luma(light))) throw new Error('Unexpected Buy arrow colours');
  const out: Raster = { width: 52, height: 26, rgba: new Uint8Array(52 * 26 * 4) };
  const put = (x: number, y: number, c: number[]) => out.rgba.set(c, (y * 52 + x) * 4);
  for (let y = 0; y < 26; y++) for (let x = 0; x < 52; x++) put(x, y, face);
  // Resume: dest(x, y) = src(y, size-1-x), offset by 2 to centre 22 in 26.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(26 + 2 + x, 2 + y, pixel(fx + y, fy + size - 1 - x));
  const bar = (x0: number, y0: number, w: number, h: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, fill);
    for (let y = y0; y < y0 + h; y++) { put(x0, y, dark); put(x0 + w - 1, y, light); }
    for (let x = x0; x < x0 + w; x++) { put(x, y0, dark); put(x, y0 + h - 1, light); }
    put(x0 + w - 1, y0, light); put(x0, y0 + h - 1, dark);
    for (let y = y0; y < y0 + h; y++) put(x0 - 1, y, fill);
    for (let x = x0 - 1; x < x0 + w - 1; x++) put(x, y0 - 1, fill);
  };
  bar(7, 5, 5, 16); bar(15, 5, 5, 16);
  return out;
}
