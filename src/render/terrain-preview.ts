import type { Raster } from '../formats/graphics';
import type { TerrainWorld } from '../simulation/terrain-generation';
import type { PreviewMarkers } from '../formats/preview-markers';
import type { StartingLocations } from '../simulation/starting-property';

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

/** Source33d6e..33dd5 draws black8×8 font glyphs over the miniature. */
export function renderLocatedTerrainPreview(world: Pick<TerrainWorld, 'cells'>, atlas: Raster, markers: PreviewMarkers, sites: StartingLocations): Raster {
  const raster = renderTerrainPreview(world, atlas);
  for (const [name, site] of [['town', sites.town], ['home', sites.player]] as const) {
    const glyph = markers[name];
    if (glyph.width !== 8 || glyph.height !== 8 || glyph.rgba.length !== 256 ||
      ![site.regionX, site.regionY].every(n => Number.isInteger(n) && n >= 0 && n < 12)) throw new Error('Invalid preview marker');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const from = (y * 8 + x) * 4, to = ((site.regionY * 16 + y) * 192 + site.regionX * 16 + x) * 4;
      if (glyph.rgba[from + 3]) raster.rgba.set(glyph.rgba.subarray(from, from + 4), to);
    }
  }
  return raster;
}

export function paintTerrainPreview(canvas: HTMLCanvasElement, raster: Raster): void {
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable');
  canvas.width = raster.width; canvas.height = raster.height;
  context.putImageData(new ImageData(Uint8ClampedArray.from(raster.rgba), raster.width, raster.height), 0, 0);
}
