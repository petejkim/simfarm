import type { Raster } from '../formats/graphics';
import type { TerrainWorld } from '../simulation/terrain-generation';

/**33ca6 miniature map at screen(264,72),192×192: each column-major farm
 * tile contributes its original2×2 MBM image. No resampling of16×16 tiles. */
export function renderTerrainPreview(world: Pick<TerrainWorld, 'cells'>, atlas: Raster): Raster {
  if (world.cells.length !== 9216 || atlas.width !== 64 || atlas.height !== 60 || atlas.rgba.length !== 64 * 60 * 4)
    throw new Error('Invalid terrain preview dimensions');
  const rgba = new Uint8Array(192 * 192 * 4);
  for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
    const terrain = world.cells[x * 96 + y].terrain;
    if (!Number.isInteger(terrain) || terrain < 0 || terrain > 65535 || (terrain & 2047) >= 960)
      throw new Error('Terrain preview tile is outside the original miniature atlas');
    const tile = terrain & 2047, sx = (tile & 31) * 2, sy = (tile >> 5) * 2;
    for (let row = 0; row < 2; row++) {
      const offset = ((sy + row) * 64 + sx) * 4;
      rgba.set(atlas.rgba.subarray(offset, offset + 8), ((y * 2 + row) * 192 + x * 2) * 4);
    }
  }
  return { width: 192, height: 192, rgba };
}
