import { invertedTiles } from '../assets/inverted-tiles';
import { clipPlacementOutline, type PlacementFootprint } from './placement-outline';
import { harvestWorkerTile } from './harvest-workers';
import { maskedTile, terrainTile, worldPosition, worldIndex, WORLD_SIZE, type Scenario } from '../formats/scenario';

export type MapPreview = PlacementFootprint;

/** Native render pass, independent of React and UI state management. */
export function drawWorld(context: CanvasRenderingContext2D, scenario: Scenario, tiles: CanvasImageSource,
  maskedTiles: CanvasImageSource, preview?: MapPreview, workerPhase=0, townEventTiles?: CanvasImageSource): void {
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
  if (preview) {
    context.save();
    clipPlacementOutline(context,preview);
    const base=invertedTiles(tiles),mask=invertedTiles(maskedTiles),events=townEventTiles?invertedTiles(townEventTiles):undefined;
    // Only cells touching the footprint can intersect the clipped border.
    for(let y=Math.max(0,preview.y-1);y<Math.min(WORLD_SIZE,preview.y+preview.height);y++)
      for(let x=Math.max(0,preview.x-1);x<Math.min(WORLD_SIZE,preview.x+preview.width);x++)
        paintCell(worldIndex(x,y),base,mask,events);
    context.restore();
  }
}
