/** Native extension: retain original slots 0..15 and append the eight missing
 * shipped crops. These IDs/tiles are browser policy, not recovered DOS slots. */
export const SHIPPED_CROP_IDS = ['almonds', 'apples', 'barley', 'carrots', 'corn', 'cotton', 'gladiolu', 'grapes',
  'lettuce', 'oats', 'onions', 'oranges', 'peanuts', 'potatoes', 'rice', 'sorghum', 'soybeans', 'strawber',
  'sugar', 'sunflowe', 'sweet', 'tobacco', 'tomatoes', 'wheat'] as const;
export function allCropFiles(files: readonly string[]): string[] {
  if (![16, 24].includes(files.length) || new Set(files).size !== files.length ||
    files.some(file => !SHIPPED_CROP_IDS.some(id => file === `${id}.crp`))) throw new Error('Invalid supplied crop catalog');
  return [...files, ...SHIPPED_CROP_IDS.map(id => `${id}.crp`).filter(file => !files.includes(file))];
}
// Separate from original terrain0..879 and masked graphics848..1047; all
// native terrain IDs still fit the world's eleven-bit tile field.
export const nativeCropTile = (tile: number) => tile >= 1280 && tile < 1392;
export const nativeCropBadge = (tile: number) => tile >= 1344 && tile < 1376;
export const cropStageTile = (slot: number, stage = 0) => (slot < 16 ? 688 + slot * 8 : 1280 + (slot - 16) * 8) + stage;
export const cropBadgeTile = (slot: number, part = 0) => (slot < 16 ? 539 + slot * 4 : 1344 + (slot - 16) * 4) + part;
export const cropHarvestTile = (slot: number) => slot < 16 ? 816 + slot : 1376 + slot - 16;
export const cropPlantTile = (slot: number) => slot < 16 ? 832 + slot : 1384 + slot - 16;
export const cropPlantSlot = (tile: number, count = 24) => tile >= 832 && tile < 848 ? tile - 832
  : count === 24 && tile >= 1384 && tile < 1392 ? tile - 1384 + 16 : -1;
export const cropHarvestSlot = (tile: number) => tile >= 816 && tile < 832 ? tile - 816
  : tile >= 1376 && tile < 1384 ? tile - 1376 + 16 : -1;
export const isCropStageTile = (tile: number) => tile >= 688 && tile < 816 || tile >= 1280 && tile < 1344;

/** Native sprite sheets (user request): the imported terrain atlases hold all twenty-four shipped crops at fixed
 * positions, crop SHIPPED_CROP_IDS[i] in the tiles of slot i. A farm's own slot order (its scenario's sixteen
 * slots, then the rest) is unchanged in the simulation and saves, which depend on it (the market draws random
 * numbers slot by slot). Drawing maps each crop tile of a farm slot to its crop's fixed tile. */
export const FIXED_CROP_FILES: readonly string[] = SHIPPED_CROP_IDS.map(id => `${id}.crp`);
const fixedMaps = new Map<string, Uint16Array>();
/** Tile number → fixed-atlas tile for a farm's crop files; non-crop tiles map to themselves. */
export function fixedCropTiles(cropFiles: readonly string[]): Uint16Array {
  const key = cropFiles.join();
  let map = fixedMaps.get(key);
  if (map) return map;
  const files = allCropFiles(cropFiles);
  map = Uint16Array.from({ length: 2048 }, (_, tile) => tile);
  files.forEach((file, slot) => {
    const fixed = FIXED_CROP_FILES.indexOf(file);
    for (let stage = 0; stage < 8; stage++) map![cropStageTile(slot, stage)] = cropStageTile(fixed, stage);
    for (let part = 0; part < 4; part++) map![cropBadgeTile(slot, part)] = cropBadgeTile(fixed, part);
    map![cropHarvestTile(slot)] = cropHarvestTile(fixed); map![cropPlantTile(slot)] = cropPlantTile(fixed);
  });
  fixedMaps.set(key, map);
  return map;
}
