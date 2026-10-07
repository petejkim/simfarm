import { Binary } from './binary';
export const WORLD_SIZE = 96;
export const WORLD_OFFSET = 0x152c4;
export interface WorldCell { terrain: number; overlay: number; attribute: number }
export interface Scenario { version: number; cells: WorldCell[] }
/** Recovered from overlay 22:283c (file 0x4543c), especially 0x45782–0x457fa. */
export function readScenario(bytes: Uint8Array): Scenario {
  if (bytes.length !== 139072 || bytes[0] !== 0x18) throw new Error('Unsupported scenario version or size');
  const b = new Binary(bytes);
  const cells = Array.from({ length: WORLD_SIZE * WORLD_SIZE }, (_, i) => {
    const pos = WORLD_OFFSET + i * 5;
    return { terrain: b.u16(pos), overlay: b.u16(pos + 2), attribute: bytes[pos + 4] };
  });
  return { version: bytes[0], cells };
}
/** The original masks AH with 7 after reading terrain; see file 0x9536–0x9556. */
export function terrainTile(cell: WorldCell): number { return cell.terrain & 0x7ff; }
