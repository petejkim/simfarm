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
