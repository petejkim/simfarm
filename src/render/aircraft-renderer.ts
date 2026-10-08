import type { AircraftFlight } from '../simulation/aircraft-flight';

export interface FlightSprites { airplane: CanvasImageSource; shadow: CanvasImageSource; dust: CanvasImageSource }
export function flightPixelPosition(f: AircraftFlight): { x: number; y: number } {
  // Original drawing uses half the pixel viewport; hit tests round to whole ground cells.
  return { x: (f.cameraX + f.columns / 2 + f.offsetX) * 16, y: (f.cameraY + f.rows / 2 + f.offsetY) * 16 };
}
/** 0x31533..0x31645: airplane, displaced shadow, then heading-relative dust. */
export function drawAircraft(context: CanvasRenderingContext2D, f: AircraftFlight, sprites: FlightSprites): void {
  const frame = (f.heading + f.spin) & 7, { x, y } = flightPixelPosition(f);
  const draw = (image: CanvasImageSource, frame: number, x: number, y: number) =>
    context.drawImage(image, frame * 32, 0, 32, 32, x, y, 32, 32);
  context.imageSmoothingEnabled = false;
  draw(sprites.airplane, frame, x, y);
  draw(sprites.shadow, frame, x - f.altitude * 2, y + f.altitude * 2);
  if (f.spraying) draw(sprites.dust, frame & 1, x + [0, -24, -24, -24, 0, 24, 24, 24][frame],
    y + [24, 24, 0, -24, -24, -24, 0, 24][frame]);
}
