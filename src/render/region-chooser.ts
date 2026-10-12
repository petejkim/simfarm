import type { Raster } from '../formats/graphics';
import type { RegionArtwork } from '../formats/region-artwork';
import type { ScenarioChooser, SetupLocation } from '../formats/new-farm';

export const REGION_PANEL = { x: 80, y: 16, width: 472, height: 328 } as const;

/** Reference rendering of the whole source panel (tests compare the native chooser against it).
 * 31dc5 draws yellow rectangles through ad62;31e24 XORs the selection through
 * acd0. Horizontal masks exclude the right endpoint, vertical lines include
 * both ends. Preserve the resulting double-XOR left corners. */
export function renderRegionChooser(artwork: RegionArtwork, farms: ScenarioChooser['farms'], selected: SetupLocation): Raster {
  const { indices, palette } = artwork;
  const coordinate = (p: { x: number; y: number }) => [p.x, p.y].every(n => Number.isInteger(n) && n >= 0 && n < 18);
  if (indices.length !== 640 * 480 || indices.some(i => i > 15) || palette.length !== 16 ||
    palette.some(c => c.length !== 3 || c.some(v => !Number.isInteger(v) || v < 0 || v > 255)) ||
    farms.length !== 8 || farms.some(p => !coordinate(p)) || !coordinate(selected) || !selected.selectable ||
    [selected.precipitation, selected.temperature, selected.wind].some(n => !Number.isInteger(n) || n < 0 || n > 3))
    throw new Error('Invalid region chooser artwork or selection');
  const pixels = indices.slice();
  for (const farm of farms) rectangle(pixels, farm.x, farm.y, false);
  rectangle(pixels, selected.x, selected.y, true);
  // 31f53..31f98: bar(x120,y101/149/197,width96,value=32*level,
  // background12,foreground6,height10). All edges here are byte aligned.
  for (const [i, level] of [selected.precipitation, selected.temperature, selected.wind].entries()) {
    for (let y = 101 + i * 48; y < 111 + i * 48; y++) for (let x = 0; x < 96; x++)
      pixels[y * 640 + 120 + x] = x < level * 32 ? 6 : 12;
  }
  const { x, y, width, height } = REGION_PANEL, rgba = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++)
    rgba.set([...palette[pixels[(y + row) * 640 + x + col]], 255], (row * width + col) * 4);
  return { width, height, rgba };
}

function rectangle(pixels: Uint8Array, x: number, y: number, xor: boolean) {
  const pixel = (px: number, py: number) => {
    const offset = py * 640 + px; pixels[offset] = xor ? pixels[offset] ^ 15 : 1;
  };
  x = 248 + x * 16; y = 40 + y * 16;
  for (let px = x; px < x + 16; px++) { pixel(px, y); pixel(px, y + 16); }
  for (let py = y; py <= y + 16; py++) { pixel(x, py); pixel(x + 16, py); }
}

/** The 289×289 map area (source 248..536, 40..328) with the eight yellow farm rectangles, and the same
 * pixels XORed with 15. The UI draws the XOR selection outline from strips of the inverted map, which
 * reproduces 31e24 exactly, including the double-XOR left corners. */
export const REGION_MAP = { x: 248, y: 40, size: 289 } as const;
export function renderRegionMaps(artwork: RegionArtwork, farms: ScenarioChooser['farms']): { map: Raster; inverted: Raster } {
  const pixels = artwork.indices.slice();
  for (const farm of farms) rectangle(pixels, farm.x, farm.y, false);
  const crop = (xor: number) => {
    const { x, y, size } = REGION_MAP, rgba = new Uint8Array(size * size * 4);
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++)
      rgba.set([...artwork.palette[pixels[(y + row) * 640 + x + col] ^ xor], 255], (row * size + col) * 4);
    return { width: size, height: size, rgba };
  };
  return { map: crop(0), inverted: crop(15) };
}
