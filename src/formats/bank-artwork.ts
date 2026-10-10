import { readBitmap, type Palette, type Raster } from './graphics';

/** DS:b314..b19e button chain, bitmap coordinates (window y minus 16).
 * See docs/bank-dialog.md. IDs select the switch at file4768c. */
export const BANK_BUTTONS = [
  { id: 1, label: 'C', x: 96, y: 152, width: 16, height: 16 },
  { id: 2, label: '0', x: 96, y: 184, width: 16, height: 16 },
  { id: 3, label: '?', x: 96, y: 168, width: 16, height: 16 },
  ...Array.from({ length: 9 }, (_, i) => ({ id: i + 4, label: String(i + 1), x: 48 + i % 3 * 16, y: 184 - Math.floor(i / 3) * 16, width: 16, height: 16 })),
  { id: 13, label: 'OK', x: 144, y: 176, width: 40, height: 24 },
  { id: 17, label: 'CLOSE', x: 184, y: 176, width: 48, height: 24 },
  { id: 18, label: 'REPAY', x: 144, y: 152, width: 88, height: 24 },
] as const;

/** Replace caption interiors only, preserving the terminal/key artwork. */
export const BANK_TEXT_MASKS = [
  ...[24, 40, 56].map(y => ({ x: 40, y, width: 152, height: 8, color: 14 })),
  ...[72, 88].map(y => ({ x: 48, y, width: 144, height: 8, color: 14 })),
  { x: 40, y: 112, width: 216, height: 8, color: 14 },
  { x: 80, y: 128, width: 88, height: 8, color: 14 },
  ...BANK_BUTTONS.map(b => ({ x: b.x + 3, y: b.y + 3, width: b.width - 6, height: b.height - 6, color: 12 })),
];
export function readBankArtwork(bytes: Uint8Array, palette: Palette): Raster {
  const raster = readBitmap(bytes, palette);
  if (raster.width !== 288 || raster.height !== 224) throw new Error('Invalid Bank artwork dimensions');
  for (const r of BANK_TEXT_MASKS) for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++)
    raster.rgba.set([...palette[r.color], 255], (y * raster.width + x) * 4);
  return raster;
}
