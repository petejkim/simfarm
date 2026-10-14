import type { PlacementFootprint } from './placement-outline';
import { harvestWorkerTile } from './harvest-workers';
import { drawFieldBadgeStacks, fieldBadgeStacks } from './field-badges';
import { fixedCropTiles } from '../formats/crop-slots';
import { maskedTile, terrainTile, worldPosition, worldIndex, type Scenario } from '../formats/scenario';

export type MapPreview = PlacementFootprint;

/** Paints one world cell (terrain tile, then its masked overlay) from the given tile sheets. Crop tiles of the
 * farm's slots are drawn from their crops' fixed places in the imported terrain sheets (fixedCropTiles). */
function cellPainter(context: CanvasRenderingContext2D, scenario: Scenario, workerPhase: number) {
  const crops = fixedCropTiles(scenario.cropFiles);
  return (i: number, base: CanvasImageSource, mask: CanvasImageSource, events?: CanvasImageSource) => {
    const cell = scenario.cells[i], tile = crops[terrainTile(cell)], { x, y } = worldPosition(i);
    if (events && tile >= 483 && tile < 518) {
      const eventTile = tile - 483;
      context.drawImage(events, eventTile % 7 * 16, Math.floor(eventTile / 7) * 16, 16, 16, x * 16, y * 16, 16, 16);
    } else context.drawImage(base, tile % 32 * 16, Math.floor(tile / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
    const storedOverlay = maskedTile(cell);
    const overlay = storedOverlay===null?null:harvestWorkerTile(storedOverlay,workerPhase);
    if (overlay !== null && overlay >= 0 && overlay < 200) {
      context.drawImage(mask, overlay % 32 * 16, Math.floor(overlay / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
    }
  };
}

/** Every cell and the field badges: the world without a placement preview. FarmMap overlays its requested
 * CSS border separately, so highlight changes never repaint all9,216 cells. */
export function drawWorldBase(context: CanvasRenderingContext2D, scenario: Scenario, tiles: CanvasImageSource,
  maskedTiles: CanvasImageSource, workerPhase=0, townEventTiles?: CanvasImageSource): void {
  context.imageSmoothingEnabled = false;
  const paintCell = cellPainter(context, scenario, workerPhase);
  for(let i=0;i<scenario.cells.length;i++)paintCell(i,tiles,maskedTiles,townEventTiles);
  drawFieldBadgeStacks(context,fieldBadgeStacks(scenario),tiles);
}

/** Repaints only the world cells whose drawn look changed since its last paint (native performance work: every
 * published snapshot changed a few cells but repainted all 9,216). A cell's look is its terrain or town-event tile,
 * its masked overlay after the harvest-worker phase, and the field badge part drawn over it; a changed cell is
 * repainted in that order. New tile sheets, or a forced paint (sprites such as aircraft drawn over the world),
 * repaint everything. */
export class WorldPainter {
  private drawn: Int32Array | null = null;
  private sheets: readonly (CanvasImageSource | undefined)[] = [];

  paint(context: CanvasRenderingContext2D, scenario: Scenario, tiles: CanvasImageSource, maskedTiles: CanvasImageSource,
    workerPhase = 0, townEventTiles?: CanvasImageSource, full = false): number {
    const looks = cellLooks(scenario, workerPhase, townEventTiles !== undefined), sheets = [tiles, maskedTiles, townEventTiles];
    const previous = this.drawn;
    if (full || !previous || previous.length !== looks.length || sheets.some((sheet, i) => sheet !== this.sheets[i])) {
      drawWorldBase(context, scenario, tiles, maskedTiles, workerPhase, townEventTiles);
      this.drawn = looks; this.sheets = sheets; return scenario.cells.length;
    }
    context.imageSmoothingEnabled = false;
    let repainted = 0;
    for (let i = 0; i < scenario.cells.length; i++) {
      const at = i * 3;
      if (looks[at] === previous[at] && looks[at + 1] === previous[at + 1] && looks[at + 2] === previous[at + 2]) continue;
      const { x, y } = worldPosition(i), tile = looks[at], overlay = looks[at + 1], badge = looks[at + 2];
      if (tile < 0) { const event = -tile - 1; context.drawImage(townEventTiles!, event % 7 * 16, Math.floor(event / 7) * 16, 16, 16, x * 16, y * 16, 16, 16); }
      else context.drawImage(tiles, tile % 32 * 16, Math.floor(tile / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
      if (overlay >= 0) context.drawImage(maskedTiles, overlay % 32 * 16, Math.floor(overlay / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
      if (badge >= 0) context.drawImage(tiles, badge % 32 * 16, Math.floor(badge / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
      repainted++;
    }
    this.drawn = looks; return repainted;
  }
}

/** Three values per cell, as drawWorldBase paints it: terrain tile (or -1 - town-event tile), overlay (or -1),
 * and the field-badge tile drawn over it (or -1). */
function cellLooks(scenario: Scenario, workerPhase: number, events: boolean): Int32Array {
  const looks = new Int32Array(scenario.cells.length * 3), crops = fixedCropTiles(scenario.cropFiles);
  for (let i = 0; i < scenario.cells.length; i++) {
    const cell = scenario.cells[i], tile = crops[terrainTile(cell)], stored = maskedTile(cell);
    const overlay = stored === null ? null : harvestWorkerTile(stored, workerPhase);
    looks[i * 3] = events && tile >= 483 && tile < 518 ? -(tile - 483) - 1 : tile;
    looks[i * 3 + 1] = overlay !== null && overlay >= 0 && overlay < 200 ? overlay : -1;
    looks[i * 3 + 2] = -1;
  }
  for (const { x, y, badges } of fieldBadgeStacks(scenario)) badges.forEach((badge, row) => {
    for (let part = 0; part < 4; part++) looks[worldIndex(x + part % 2, y + row * 2 + (part >> 1)) * 3 + 2] = 539 + badge * 4 + part;
  });
  return looks;
}
