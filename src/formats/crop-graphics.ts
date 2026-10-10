import { cropStageTile, cropBadgeTile, cropHarvestTile, cropPlantTile } from './crop-slots';
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
