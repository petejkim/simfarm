import { decodePlanar, tileAtlas, type Palette, type Raster } from './graphics';
import { SHIPPED_CROP_IDS, cropStageTile, cropBadgeTile, cropHarvestTile, cropPlantTile } from './crop-slots';

export const CROP_CARD_WIDTH = 112;
export const CROP_CARD_HEIGHT = 64;
export const CROP_CARD_COLUMNS = 8;
export const CROP_CARD_SHEET_WIDTH = CROP_CARD_COLUMNS * CROP_CARD_WIDTH;
export const CROP_CARD_SHEET_HEIGHT = Math.ceil(SHIPPED_CROP_IDS.length / CROP_CARD_COLUMNS) * CROP_CARD_HEIGHT;

/** Native fixed-ID packing; a farm's saved crop slots retain their own order. */
export function cropCardFrame(id: string): { x: number; y: number; width: number; height: number } {
  const index = SHIPPED_CROP_IDS.findIndex(crop => crop === id);
  if (index < 0) throw new Error(`Unknown crop illustration: ${id}`);
  return { x: index % CROP_CARD_COLUMNS * CROP_CARD_WIDTH, y: Math.floor(index / CROP_CARD_COLUMNS) * CROP_CARD_HEIGHT,
    width: CROP_CARD_WIDTH, height: CROP_CARD_HEIGHT };
}

/** Original CRP0x0000..0x03ff growth tiles and0x0400..0x11ff photographs, packed without resampling. */
export function cropSpriteSheets(crops: ReadonlyMap<string, Uint8Array>, palette: Palette): { tiles: Raster; cards: Raster } {
  const tileBytes = new Uint8Array(SHIPPED_CROP_IDS.length * 0x400);
  const cards: Raster = { width: CROP_CARD_SHEET_WIDTH, height: CROP_CARD_SHEET_HEIGHT,
    rgba: new Uint8Array(CROP_CARD_SHEET_WIDTH * CROP_CARD_SHEET_HEIGHT * 4) };
  for (const [index, id] of SHIPPED_CROP_IDS.entries()) {
    const crop = crops.get(`${id}.crp`);
    if (!crop || crop.length !== 5890) throw new Error(`Invalid crop sprite source: ${id}`);
    tileBytes.set(crop.subarray(0, 0x400), index * 0x400);
    const card = decodePlanar(crop.subarray(0x400, 0x1200), CROP_CARD_WIDTH, CROP_CARD_HEIGHT, palette), frame = cropCardFrame(id);
    for (let y = 0; y < card.height; y++) cards.rgba.set(card.rgba.subarray(y * card.width * 4, (y + 1) * card.width * 4),
      ((frame.y + y) * cards.width + frame.x) * 4);
  }
  return { tiles: tileAtlas(tileBytes, palette, 32), cards };
}
/** Crop tile uploads at EXE file 0x468c2–0x46a13. */
export function cropTilePatches(slot: number, cropCount = 16): { sourceOffset: number; tile: number }[] {
  if (!Number.isInteger(slot) || slot < 0 || ![16, 24].includes(cropCount) || slot >= cropCount) throw new Error('Invalid crop slot');
  return [
    ...Array.from({ length: 8 }, (_, stage) => ({ sourceOffset: stage * 128, tile: cropStageTile(slot, stage) })),
    ...Array.from({ length: 4 }, (_, part) => ({ sourceOffset: 0x1200 + part * 128, tile: cropBadgeTile(slot, part) })),
    { sourceOffset: 0x1400, tile: cropHarvestTile(slot) },
    { sourceOffset: 0x1480, tile: cropPlantTile(slot) },
  ];
}
/** Apply original runtime uploads to a copy, preserving the reusable unmodified atlas. */
export function patchCropGraphics(base: Uint8Array, crops: readonly Uint8Array[]): Uint8Array {
  if (base.length !== 880 * 128 || ![16, 24].includes(crops.length)) throw new Error('Expected original atlas and sixteen or twenty-four crop slots');
  const result = new Uint8Array((crops.length === 24 ? 1392 : 880) * 128); result.set(base);
  crops.forEach((crop, slot) => {
    if (crop.length !== 5890) throw new Error('Invalid crop graphic source');
    for (const patch of cropTilePatches(slot, crops.length)) result.set(crop.subarray(patch.sourceOffset, patch.sourceOffset + 128), patch.tile * 128);
  });
  return result;
}

/** Crop file icons as standalone rasters (same sources as cropTilePatches): the 16×16 Edit plant tile at
 * 0x1480 and the 32×32 badge from the four tiles at 0x1200, part = row * 2 + column (as field-status.ts). */
export function readCropIcons(crop: Uint8Array, palette: Palette): { plant: Raster; badge: Raster } {
  if (crop.length !== 5890) throw new Error('Invalid crop graphic source');
  const tile = (offset: number) => decodePlanar(crop.subarray(offset, offset + 128), 16, 16, palette);
  const rgba = new Uint8Array(32 * 32 * 4);
  for (let part = 0; part < 4; part++) {
    const t = tile(0x1200 + part * 128), x = part % 2 * 16, y = (part >> 1) * 16;
    for (let row = 0; row < 16; row++) rgba.set(t.rgba.subarray(row * 64, row * 64 + 64), ((y + row) * 32 + x) * 4);
  }
  return { plant: tile(0x1480), badge: { width: 32, height: 32, rgba } };
}
