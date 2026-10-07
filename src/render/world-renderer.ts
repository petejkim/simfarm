import { maskedTile, terrainTile, worldPosition, type Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';

/** Native render pass, independent of React and UI state management. */
export function drawWorld(context: CanvasRenderingContext2D, scenario: Scenario, tiles: CanvasImageSource,
  maskedTiles: CanvasImageSource, field?: FieldRecord, selection: number | null = null): void {
  context.imageSmoothingEnabled = false;
  for (let i = 0; i < scenario.cells.length; i++) {
    const cell = scenario.cells[i], tile = terrainTile(cell), { x, y } = worldPosition(i);
    context.drawImage(tiles, tile % 32 * 16, Math.floor(tile / 32) * 16, 16, 16, x * 16, y * 16, 16, 16);
    const overlay = maskedTile(cell);
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
}
