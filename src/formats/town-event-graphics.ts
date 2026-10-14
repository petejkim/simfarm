import { tileAtlas, type Palette, type Raster } from './graphics';

/** twnevent.til loader0xdb51..0xdbe3:35 planar16×16 tiles per bank.
 * 2be7:0984 (initialized file0x4f5e4) selects atlas destination483.
 * Other bytes in the resource are retained without invented semantics. */
export type TownEventMode = 0 | 1 | 2;
export const TOWN_EVENT_FIRST_TILE = 483;
export const TOWN_EVENT_TILE_COUNT = 35;
export const TOWN_EVENT_BANK_BYTES = 0x1180;
export const TOWN_EVENT_RESOURCE_BYTES = 20480;
// Native packing: banks across columns, normal/rain/frost palettes down rows.
export const TOWN_EVENT_BANK_WIDTH = 112;
export const TOWN_EVENT_BANK_HEIGHT = 80;
export const TOWN_EVENT_SHEET_WIDTH = TOWN_EVENT_BANK_WIDTH * 3;
export const TOWN_EVENT_SHEET_HEIGHT = TOWN_EVENT_BANK_HEIGHT * 3;

export function townEventSpriteSheet(bytes: Uint8Array, palettes: readonly [Palette, Palette, Palette]): Raster {
  if (palettes.length !== 3) throw new Error('Expected three town event palettes');
  const rgba = new Uint8Array(TOWN_EVENT_SHEET_WIDTH * TOWN_EVENT_SHEET_HEIGHT * 4);
  for (const [row, palette] of palettes.entries()) for (const mode of [0, 1, 2] as const) {
    const bank = tileAtlas(townEventTileBank(bytes, mode), palette, 7);
    for (let y = 0; y < bank.height; y++) {
      const destination = ((row * TOWN_EVENT_BANK_HEIGHT + y) * TOWN_EVENT_SHEET_WIDTH + mode * TOWN_EVENT_BANK_WIDTH) * 4;
      rgba.set(bank.rgba.subarray(y * bank.width * 4, (y + 1) * bank.width * 4), destination);
    }
  }
  return { width: TOWN_EVENT_SHEET_WIDTH, height: TOWN_EVENT_SHEET_HEIGHT, rgba };
}

export function townEventTileBank(bytes: Uint8Array, mode: TownEventMode): Uint8Array {
  if (bytes.length !== TOWN_EVENT_RESOURCE_BYTES) throw new Error('Invalid town event resource');
  if (mode !== 0 && mode !== 1 && mode !== 2) throw new Error('Invalid town event mode');
  return Uint8Array.from(bytes.subarray(mode * TOWN_EVENT_BANK_BYTES, (mode + 1) * TOWN_EVENT_BANK_BYTES));
}

/** Apply the source upload to a detached original or crop-expanded terrain atlas. */
export function patchTownEventGraphics(atlas: Uint8Array, bytes: Uint8Array, mode: TownEventMode): Uint8Array {
  if (atlas.length % 128 || atlas.length < (TOWN_EVENT_FIRST_TILE + TOWN_EVENT_TILE_COUNT) * 128)
    throw new Error('Invalid terrain atlas');
  const bank = townEventTileBank(bytes, mode);
  const result = Uint8Array.from(atlas);
  result.set(bank, TOWN_EVENT_FIRST_TILE * 128);
  return result;
}
