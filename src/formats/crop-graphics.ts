/** Crop tile uploads at EXE file 0x468c2–0x46a13. */
export function cropTilePatches(slot: number): { sourceOffset: number; tile: number }[] {
  if (!Number.isInteger(slot) || slot < 0 || slot >= 16) throw new Error('Invalid crop slot');
  return [
    ...Array.from({ length: 8 }, (_, stage) => ({ sourceOffset: stage * 128, tile: 688 + slot * 8 + stage })),
    ...Array.from({ length: 4 }, (_, part) => ({ sourceOffset: 0x1200 + part * 128, tile: 539 + slot * 4 + part })),
    { sourceOffset: 0x1400, tile: 816 + slot },
    { sourceOffset: 0x1480, tile: 832 + slot },
  ];
}
/** Apply original runtime uploads to a copy, preserving the reusable unmodified atlas. */
export function patchCropGraphics(base: Uint8Array, crops: readonly Uint8Array[]): Uint8Array {
  if (base.length !== 880 * 128 || crops.length !== 16) throw new Error('Expected original atlas and sixteen crop slots');
  const result = Uint8Array.from(base);
  crops.forEach((crop, slot) => {
    if (crop.length !== 5890) throw new Error('Invalid crop graphic source');
    for (const patch of cropTilePatches(slot)) result.set(crop.subarray(patch.sourceOffset, patch.sourceOffset + 128), patch.tile * 128);
  });
  return result;
}
