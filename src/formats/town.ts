import { Binary } from './binary';

export const TOWN_LAYOUT_BYTES = 1920;
/** townly0.cmp: 40x24 little-endian words; five districts per row, three rows.
 * Loader 0x4a366 reads 960 words into 6190:952c. */
export class TownLayouts {
  readonly bytes: Uint8Array;
  private readonly data: Binary;
  constructor(bytes: Uint8Array) {
    if (bytes.length !== TOWN_LAYOUT_BYTES) throw new Error('Invalid town layout size');
    this.bytes = Uint8Array.from(bytes);
    this.data = new Binary(this.bytes);
  }
  tile(type: number, x: number, y: number): number {
    if (!Number.isInteger(type) || type < 0 || type >= 15 ||
      ![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 8)) throw new Error('Invalid town layout position');
    return this.data.u16(2 * (Math.floor(type / 5) * 320 + type % 5 * 8 + y * 40 + x));
  }
}

export interface TownConstructionState {
  airportCount: number;
  recreationCount: number;
  /** Original eight interleaved coordinate pairs, including unused bytes. */
  recreationCoordinates: Uint8Array;
}
/** SSM loader 0x45b88..0x45be3 (coordinates/count), 0x460f6..0x4610b (airports). */
export function readTownConstructionState(bytes: Uint8Array): TownConstructionState {
  const b = new Binary(bytes);
  return { recreationCoordinates: Uint8Array.from(b.slice(0x21663, 16)),
    recreationCount: b.slice(0x21673, 1)[0], airportCount: b.slice(0x21712, 1)[0] };
}
