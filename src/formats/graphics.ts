import { Binary } from './binary';
export type Palette = readonly (readonly number[])[];
export interface Raster { width: number; height: number; rgba: Uint8Array }
export function readPalette(bytes: Uint8Array): Palette {
  if (bytes.length !== 48 || bytes.some(v => v > 63)) throw new Error('Expected sixteen VGA DAC colors');
  return Array.from({ length: 16 }, (_, i) => Array.from(bytes.slice(i * 3, i * 3 + 3), v => Math.round(v * 255 / 63)));
}
/** Four contiguous bitplanes, low significance first, most significant bit at left. */
export function decodePlanar(bytes: Uint8Array, width: number, height: number, palette: Palette, transparentIndex?: number): Raster {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width % 8 || bytes.length !== width * height / 2 || palette.length !== 16) throw new Error('Invalid planar image');
  const stride = width / 8, planeSize = stride * height;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let color = 0;
    for (let plane = 0; plane < 4; plane++) color |= ((bytes[plane * planeSize + y * stride + (x >> 3)] >> (7 - (x & 7))) & 1) << plane;
    const p = (y * width + x) * 4;
    rgba.set([...palette[color], color === transparentIndex ? 0 : 255], p);
  }
  return { width, height, rgba };
}
export function readBitmap(bytes: Uint8Array, palette: Palette): Raster {
  const b = new Binary(bytes);
  if (b.u16(4) !== 4 || b.u16(6) !== 1) throw new Error('Unsupported SimFarm bitmap header');
  return decodePlanar(bytes.subarray(8), b.u16(0) * 8, b.u16(2), palette);
}

/** Headerless640×480 INT screens: four80-byte planes per scanline.
 * 0416:002c (file0x638c) uploads ten rows from each3200-byte read. */
export function readInterleavedScreen(bytes: Uint8Array, palette: Palette): Raster {
  if (bytes.length !== 153600) throw new Error('Invalid interleaved screen size');
  const planar = new Uint8Array(bytes.length);
  for (let y = 0; y < 480; y++) for (let plane = 0; plane < 4; plane++) {
    const start = y * 320 + plane * 80;
    planar.set(bytes.subarray(start, start + 80), plane * 38400 + y * 80);
  }
  return decodePlanar(planar, 640, 480, palette);
}
export function tileAtlas(bytes: Uint8Array, palette: Palette, columns = 32, transparentIndex?: number): Raster {
  if (!bytes.length || bytes.length % 128 || !Number.isInteger(columns) || columns <= 0) throw new Error('Invalid tile atlas');
  const count = bytes.length / 128, width = columns * 16, height = Math.ceil(count / columns) * 16;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < count; i++) {
    const tile = decodePlanar(bytes.subarray(i * 128, (i + 1) * 128), 16, 16, palette, transparentIndex);
    for (let y = 0; y < 16; y++) rgba.set(tile.rgba.subarray(y * 64, (y + 1) * 64), ((Math.floor(i / columns) * 16 + y) * width + i % columns * 16) * 4);
  }
  return { width, height, rgba };
}
