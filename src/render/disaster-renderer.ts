import type { MovingDisasterState } from '../simulation/moving-disasters';
export interface DisasterSprites { tornado: CanvasImageSource; swarm: CanvasImageSource }

/** Original0x37386/0x37601: frames at world tile origin, using actual SPR
 * dimensions. Canvas clipping replaces DOS window clipping/dirty rectangles. */
export function drawDisasters(context: CanvasRenderingContext2D, d: MovingDisasterState, sprites: DisasterSprites): void {
  for (const [kind, flag, width, height] of [['swarm', 32, 64, 40], ['tornado', 1, 48, 48]] as const) if (d.flags & flag) {
    const e = d[kind]; context.drawImage(sprites[kind], e.frame * width, 0, width, height, e.x * 16, e.y * 16, width, height);
  }
}
