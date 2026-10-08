import type { Raster } from '../formats/graphics';
import type { RegionArtwork } from '../formats/region-artwork';
import type { ScenarioChooser, SetupLocation } from '../formats/new-farm';

export const REGION_PANEL = { x: 80, y: 16, width: 472, height: 328 } as const;

/** 31dc5 draws yellow rectangles through ad62;31e24 XORs the selection through
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
  function rectangle(x: number, y: number, xor: boolean) {
    const pixel = (px: number, py: number) => {
      const offset = py * 640 + px; pixels[offset] = xor ? pixels[offset] ^ 15 : 1;
    };
    x = 248 + x * 16; y = 40 + y * 16;
    for (let px = x; px < x + 16; px++) { pixel(px, y); pixel(px, y + 16); }
    for (let py = y; py <= y + 16; py++) { pixel(x, py); pixel(x + 16, py); }
  }
  for (const farm of farms) rectangle(farm.x, farm.y, false);
  rectangle(selected.x, selected.y, true);
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

export function paintRegionChooser(canvas: HTMLCanvasElement, raster: Raster): void {
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable');
  canvas.width = raster.width; canvas.height = raster.height;
  context.putImageData(new ImageData(Uint8ClampedArray.from(raster.rgba), raster.width, raster.height), 0, 0);
}
