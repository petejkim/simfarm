import { harvestWorkerTile } from './harvest-workers';
import { maskedTile, terrainTile, worldPosition, type Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';

export interface MapPreview { x: number; y: number; width: number; height: number; valid: boolean }

/** Native render pass, independent of React and UI state management. */
export function drawWorld(context: CanvasRenderingContext2D, scenario: Scenario, tiles: CanvasImageSource,
  maskedTiles: CanvasImageSource, field?: FieldRecord, selection: number | null = null, preview?: MapPreview, workerPhase=0): void {
  context.imageSmoothingEnabled = false;
  for (let i = 0; i < scenario.cells.length; i++) {
    const cell = scenario.cells[i], tile = terrainTile(cell), { x, y } = worldPosition(i);
    context.drawImage(tiles, tile % 32 * 16, Math.floor(tile / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
    const storedOverlay = maskedTile(cell);
    const overlay = storedOverlay===null?null:harvestWorkerTile(storedOverlay,workerPhase);
    if (overlay !== null && overlay >= 0 && overlay < 200) {
      context.drawImage(maskedTiles, overlay % 32 * 16, Math.floor(overlay / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
    }
  }
  context.strokeStyle = '#fff6a2';
  if (field) {
    context.lineWidth = 2;
    context.strokeRect(field.x * 16 + 1, field.y * 16 + 1, field.width * 16 - 2, field.height * 16 - 2);
  }
  if (selection !== null) {
    const { x, y } = worldPosition(selection);
    context.lineWidth = 1;
    context.strokeRect(x * 16 + 0.5, y * 16 + 0.5, 15, 15);
  }
  if (preview) {
    context.fillStyle = preview.valid ? '#a4e98633' : '#f4898933';
    context.strokeStyle = preview.valid ? '#b3f898' : '#ff9a9a';
    context.lineWidth = 2;
    context.fillRect(preview.x * 16, preview.y * 16, preview.width * 16, preview.height * 16);
    context.strokeRect(preview.x * 16 + 1, preview.y * 16 + 1, preview.width * 16 - 2, preview.height * 16 - 2);
  }
}
