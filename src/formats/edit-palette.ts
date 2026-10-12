import { readBitmap, type Palette, type Raster } from './graphics';

/** Bounded LZSS bitmap stream. editeasy.lzs expands to an eight-byte BMP header
 * and 48×208 four-plane pixels. See docs/edit-workspace.md for confidence. */
export function decodeEditPalette(bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(5000), ring = new Uint8Array(4096);
  let cursor = 4078, input = 0, output = 0;
  const emit = (value: number) => {
    if (output === result.length) throw new Error('Edit palette output overflow');
    result[output++] = value; ring[cursor] = value; cursor = (cursor + 1) & 4095;
  };
  while (input < bytes.length && output < result.length) {
    const flags = bytes[input++];
    for (let bit = 0; bit < 8 && output < result.length; bit++) {
      if (input >= bytes.length) throw new Error('Truncated edit palette');
      if (flags & (1 << bit)) emit(bytes[input++]);
      else {
        if (input + 1 >= bytes.length) throw new Error('Truncated edit palette reference');
        const low = bytes[input++], high = bytes[input++], offset = low | ((high & 240) << 4);
        for (let i = 0; i < (high & 15) + 3; i++) emit(ring[(offset + i) & 4095]);
      }
    }
  }
  if (output !== result.length || input !== bytes.length) throw new Error('Invalid edit palette length');
  return result;
}
/** Tool cell geometry: 24px pitch, 1px black top/left, 2px bevel, then a 19×19 face. */
export const EDIT_PALETTE_CELL = { size: 24, inset: 3, face: 19 } as const;
/** Caption interiors replaced by HTML text, kept inside each 43px-wide face (rows 147..163, 169..185, 191..201). */
export const EDIT_PALETTE_TEXT = [{ y: 148, height: 12 }, { y: 172, height: 12 }, { y: 191, height: 11 }] as const;

export function readEditPalette(bytes: Uint8Array, palette: Palette): Raster {
  const raster = readBitmap(decodeEditPalette(bytes), palette);
  if (raster.width !== 48 || raster.height !== 208) throw new Error('Invalid edit palette dimensions');
  // Keep icon art and bevels; all three button captions are HTML.
  for (const { y: y0, height } of EDIT_PALETTE_TEXT) for (let y = y0; y < y0 + height; y++) for (let x = 4; x < 44; x++)
    raster.rgba.set([...palette[12], 255], (y * 48 + x) * 4);
  return raster;
}
