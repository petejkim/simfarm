import { Binary } from '../formats/binary';
import type { AnimalRecord } from '../formats/animal';
import type { BuildingRecord } from '../formats/building';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findStorageSpace, toggleBuildingInterior } from './building-storage';
import type { FarmRandom } from './random';

export const ANIMAL_STEPS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;
export const ANIMAL_GRAPHICS: Readonly<Record<number, number>> = { 37: 946, 34: 962, 35: 978, 36: 994 };
export const inAnimalMap = (x: number, y: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96);

export function validateMovingAnimal(a: AnimalRecord): void {
  if (!a.active || a.slot < 1 || a.slot > 255 || a.type < 160 || a.type > 163 || !inAnimalMap(a.x, a.y) || a.bytes[4] > 7)
    throw new Error('Invalid animal movement state');
}

/** Original 0x13256. Upper flags do not change terrain eligibility. The
 * masked-image interval collapses to962 in this build (SF-098), preserved. */
export function animalCanWalk(world: Scenario, x: number, y: number): boolean {
  if (!inAnimalMap(x, y)) return false;
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
  const accepted = (tile >= 175 && tile < 177) || (tile >= 15 && tile <= 31) ||
    (tile >= 150 && tile <= 172) || (tile >= 535 && tile <= 539) || (tile >= 131 && tile <= 147) ||
    (tile >= 680 && tile <= 840) || [189, 191, 192, 193, 36, 12].includes(tile);
  return accepted && (!(cell.terrain & 0x800) || (cell.overlay & 0x7ff) === 962);
}

/** 0x128b8 returns the direction of (origin-target). Equal coordinates
 * return8. Native equality selects0, avoiding the source away-table read of
 * the low frame-timestamp byte outside the eight directions (SF-100). */
export function animalDirection(x: number, y: number, targetX: number, targetY: number, away = false): number {
  const dx = Math.sign(((x & 255) - targetX) << 16 >> 16), dy = Math.sign(((y & 255) - targetY) << 16 >> 16);
  const index = ANIMAL_STEPS.findIndex(([sx, sy]) => sx === dx && sy === dy);
  return index < 0 ? 0 : away ? index : (index + 4) & 7;
}

function animalDefinition(a: AnimalRecord, finances: FinancialState) {
  const definition = finances.accounts.assets.animalDefinitions[a.type - 160];
  if (!definition || definition.type !== a.type || definition.width !== 1 || definition.height !== 1 ||
    ANIMAL_GRAPHICS[definition.graphic] === undefined) throw new Error('Invalid animal movement definition');
  return definition;
}

/** Animal branch0x1a779, called by movement0x12323. Native preflight keeps
 * occupancy on failure instead of hiding the animal before a full-store rejection. */
export function storeMovingAnimal(world: Scenario, finances: FinancialState, a: AnimalRecord, b: BuildingRecord): boolean {
  validateMovingAnimal(a);
  if (!b.active || (b.type !== 68 && b.type !== 69) || (a.flags & 4)) return false;
  const definition = animalDefinition(a, finances), d = world.buildingDefinitions[b.type - 64];
  if (!d || !inAnimalMap(b.x, b.y) || b.x + d.width > 96 || b.y + d.height > 96) throw new Error('Invalid animal storage building');
  const space = findStorageSpace(b, 1, 1, world);
  if (!space) return false;
  world.cells[worldIndex(a.x, a.y)].terrain &= 0xf7ff;
  a.bytes[0] = b.x + space.x; a.bytes[1] = b.y + space.y; a.flags |= 4;
  new Binary(a.bytes).view.setUint16(16, b.slot, true);
  b.setContent(space.x * 3 + space.y, ANIMAL_GRAPHICS[definition.graphic], a.type, a.slot);
  toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
  return true;
}

/** Stored frame branch0xe0e2..0xe215. It skips ordinary movement/care,
 * clears thirst, then on visual RNG&7==5 tries the three left-side exits. */
export function stepStoredAnimal(world: Scenario, a: AnimalRecord, random: FarmRandom): boolean {
  validateMovingAnimal(a);
  const b = world.buildings[a.buildingSlot], d = b && world.buildingDefinitions[b.type - 64];
  if (!(a.flags & 4) || !b?.active || (b.type !== 68 && b.type !== 69) || !d ||
    a.x < b.x || a.y < b.y || a.x >= b.x + d.width || a.y >= b.y + d.height ||
    b.x + d.width > 96 || b.y + d.height > 96) throw new Error('Invalid stored animal');
  const index = (a.x - b.x) * 3 + a.y - b.y, content = b.content(index);
  if (content.slot !== a.slot || content.type !== a.type) throw new Error('Invalid stored animal content');
  a.bytes[14] = 0;
  if ((random.nextVisual() & 7) !== 5) return false;
  for (let dy = 0; dy < 3; dy++) if (animalCanWalk(world, b.x - 1, b.y + dy)) {
    b.clearContent(index); toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
    a.flags &= ~4; a.bytes[0] = b.x - 1; a.bytes[1] = b.y + dy;
    // The source does not paint or set occupancy until the next ordinary frame.
    return true;
  }
  return false;
}

export interface AnimalFrameState {
  lastCentreTick: number;
  lastMoveTick: number;
  /** DS22f7..230b: retain original overlap of counters and sums (SF-097). */
  herd: Uint8Array;
}
export const createAnimalFrameState = (): AnimalFrameState => ({ lastCentreTick: 0, lastMoveTick: 0, herd: new Uint8Array(21) });
export function validateAnimalFrameState(state: AnimalFrameState): void {
  if (!(state.herd instanceof Uint8Array) || state.herd.length !== 21 ||
    ![state.lastCentreTick, state.lastMoveTick].every(n => Number.isInteger(n) && n >= 0 && n <= 65535))
    throw new Error('Invalid animal frame state');
}

/** Herd refresh0xdf6a..0xe091, bounded native scan, exact source byte/word
 * overlap, signed count test and two visual RNG draws per positive divisor. */
export function refreshAnimalHerd(world: Scenario, state: AnimalFrameState, random: FarmRandom, tick: number): boolean {
  validateAnimalFrameState(state);
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535) throw new Error('Invalid animal tick');
  const animals = world.animals.filter(a => a.active);
  if (!animals.length || ((tick - state.lastCentreTick) & 65535) <= 320) return false;
  animals.forEach(validateMovingAnimal);
  const bytes = state.herd, view = new Binary(bytes).view;
  bytes.fill(0, 1);
  for (const a of animals) {
    const type = a.type - 160, offset = 1 + type * 4;
    view.setUint16(offset, (view.getUint16(offset, true) + a.x) & 65535, true);
    view.setUint16(offset + 2, (view.getUint16(offset + 2, true) + a.y) & 65535, true);
    bytes[type]++;
  }
  for (let type = 0; type < 4; type++) {
    const count = bytes[1 + type] << 24 >> 24, offset = 5 + type * 4;
    if (count <= 0) continue;
    view.setUint16(offset, Math.floor(view.getUint16(offset, true) / count), true);
    view.setUint16(offset + 2, Math.floor(view.getUint16(offset + 2, true) / count), true);
    view.setUint16(offset, (view.getUint16(offset, true) + (random.nextVisual() & 3)) & 65535, true);
    view.setUint16(offset + 2, (view.getUint16(offset + 2, true) + (random.nextVisual() & 3)) & 65535, true);
  }
  state.lastCentreTick = tick;
  return true;
}

/** Consumer switch0x12080, deliberately not an idealized type-index lookup. */
export function animalHerdTarget(state: AnimalFrameState, type: number): { x: number; y: number } {
  validateAnimalFrameState(state);
  if (!Number.isInteger(type) || type < 160 || type > 163) throw new Error('Invalid animal herd type');
  const offset = 5 + [2, 0, 1, 3][type - 160] * 4, view = new Binary(state.herd).view;
  return { x: view.getUint16(offset, true), y: view.getUint16(offset + 2, true) };
}
