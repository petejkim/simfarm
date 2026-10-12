import { invertedTiles } from '../assets/inverted-tiles';
import { clipPlacementOutline } from './placement-outline';
import { harvestWorkerTile } from './harvest-workers';
import { maskedTile, terrainTile, worldPosition, worldIndex, WORLD_SIZE, type Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';

export interface MapPreview { x: number; y: number; width: number; height: number; valid: boolean; originalOutline?: boolean }

/** Native render pass, independent of React and UI state management. */
export function drawWorld(context: CanvasRenderingContext2D, scenario: Scenario, tiles: CanvasImageSource,
  maskedTiles: CanvasImageSource, field?: FieldRecord, selection: number | null = null, preview?: MapPreview, workerPhase=0, townEventTiles?: CanvasImageSource): void {
  context.imageSmoothingEnabled = false;
  const paintCell=(i:number,base:CanvasImageSource,mask:CanvasImageSource,events?:CanvasImageSource)=>{
    const cell = scenario.cells[i], tile = terrainTile(cell), { x, y } = worldPosition(i);
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
  for(let i=0;i<scenario.cells.length;i++)paintCell(i,tiles,maskedTiles,townEventTiles);
  context.strokeStyle = '#fff6a2';
  if (field && !preview?.originalOutline) {
    context.lineWidth = 2;
    context.strokeRect(field.x * 16 + 1, field.y * 16 + 1, field.width * 16 - 2, field.height * 16 - 2);
  }
  if (selection !== null && !preview?.originalOutline) {
    const { x, y } = worldPosition(selection);
    context.lineWidth = 1;
    context.strokeRect(x * 16 + 0.5, y * 16 + 0.5, 15, 15);
  }
  if (preview?.originalOutline) {
    context.save();
    clipPlacementOutline(context,preview);
    const base=invertedTiles(tiles),mask=invertedTiles(maskedTiles),events=townEventTiles?invertedTiles(townEventTiles):undefined;
    // Only cells touching the footprint can intersect the clipped border.
    for(let y=Math.max(0,preview.y-1);y<Math.min(WORLD_SIZE,preview.y+preview.height);y++)
      for(let x=Math.max(0,preview.x-1);x<Math.min(WORLD_SIZE,preview.x+preview.width);x++)
        paintCell(worldIndex(x,y),base,mask,events);
    context.restore();
  } else if (preview) {
    context.fillStyle = preview.valid ? '#a4e98633' : '#f4898933';
    context.strokeStyle = preview.valid ? '#b3f898' : '#ff9a9a';
    context.lineWidth = 2;
    context.fillRect(preview.x * 16, preview.y * 16, preview.width * 16, preview.height * 16);
    context.strokeRect(preview.x * 16 + 1, preview.y * 16 + 1, preview.width * 16 - 2, preview.height * 16 - 2);
  }
}
