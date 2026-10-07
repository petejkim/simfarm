import { Binary } from './binary';
import { readFields, type FieldRecord } from './field';
import { readFarmState, type SavedFarmState } from './scenario-state';
import { readClimateTables, type ClimateTables } from './weather';
export const WORLD_SIZE = 96;
export const WORLD_OFFSET = 0x152c4;
export const CROP_NAMES_OFFSET = 0x21193;
export interface WorldCell { terrain: number; overlay: number; attribute: number }
export interface Scenario {
  version: number; cells: WorldCell[]; cropFiles: string[]; fields: FieldRecord[]; farm: SavedFarmState;
  /** Seven interleaved condition bytes per 12×12 region, also column-major. */
  regionalConditions: Uint8Array;
  climate: ClimateTables;
}
/** Recovered from overlay 22:283c (file 0x4543c), especially 0x45782–0x457fa. */
export function readScenario(bytes: Uint8Array): Scenario {
  if (bytes.length !== 139072 || bytes[0] !== 0x18) throw new Error('Unsupported scenario version or size');
  const b = new Binary(bytes);
  const cells = Array.from({ length: WORLD_SIZE * WORLD_SIZE }, (_, i) => {
    const pos = WORLD_OFFSET + i * 5;
    return { terrain: b.u16(pos), overlay: b.u16(pos + 2), attribute: bytes[pos + 4] };
  });
  const cropFiles = Array.from({ length: 16 }, (_, slot) => {
    const name = b.text(CROP_NAMES_OFFSET + slot * 14, 14).toLowerCase();
    if (!/^[a-z0-9_]{1,8}\.crp$/.test(name)) throw new Error('Invalid scenario crop filename');
    return name;
  });
  return { version: bytes[0], cells, cropFiles, fields: readFields(bytes), farm: readFarmState(bytes),
    regionalConditions: Uint8Array.from(b.slice(0x21273, 12 * 12 * 7)), climate: readClimateTables(bytes) };
}
/** The original masks AH with 7 after reading terrain; see file 0x9536–0x9556. */
export function terrainTile(cell: WorldCell): number { return cell.terrain & 0x7ff; }

/** The original screen-X loop multiplies its coordinate by 96 (file 0x1fb73). */
export function worldIndex(x: number, y: number): number {
  if (![x, y].every(v => Number.isInteger(v) && v >= 0 && v < WORLD_SIZE)) throw new Error('World coordinate outside map');
  return x * WORLD_SIZE + y;
}
export function worldPosition(index: number): { x: number; y: number } {
  if (!Number.isInteger(index) || index < 0 || index >= WORLD_SIZE * WORLD_SIZE) throw new Error('Invalid world index');
  return { x: Math.floor(index / WORLD_SIZE), y: index % WORLD_SIZE };
}
/** Terrain bit 11 enables a color-7-transparent tile from the second word, base 848. */
export function maskedTile(cell: WorldCell): number | null {
  return cell.terrain & 0x0800 ? (cell.overlay & 0x07ff) - 848 : null;
}
