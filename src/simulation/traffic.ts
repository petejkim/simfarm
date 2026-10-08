import { worldIndex, type Scenario } from '../formats/scenario';
import { validateTraffic, type TrafficState } from '../formats/traffic';
import type { FarmRandom } from './random';
import { hitAnimal, type EquipmentRuntime } from './equipment-world';

type TrafficWorld = Pick<Scenario, 'cells' | 'animals'>;
type TrafficRandom = Pick<FarmRandom, 'nextVisual'>;
type CollisionRuntime = Pick<EquipmentRuntime, 'animationTick' | 'notices'>;
export interface TrafficRoute { x: number; y: number; heading: number }
export interface TrafficUpdate extends TrafficRoute { slot: number; kind: 'painted' | 'hidden' | 'removed' }
// DS2274, DS1eda, DS1eea and DS1ef2. Verified against initialized EXE bytes.
const steps = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]] as const;
const counts = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
const bits = [1, 2, 4, 8], reverseBits = [4, 8, 1, 2];
const validPosition = (x: number, y: number, heading: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)
  && Number.isInteger(heading) && heading >= 0 && heading <= 7;

function roadMask(world: Pick<Scenario, 'cells'>, x: number, y: number): number {
  let mask = 0;
  for (let side = 0; side < 4; side++) {
    const [dx, dy] = steps[side * 2], nx = x + dx, ny = y + dy;
    if (nx < 0 || nx > 95 || ny < 0 || ny > 95) continue;
    const tile = world.cells[worldIndex(nx, ny)].terrain & 2047;
    // DS5696: paved150..160, crossing172..173, dirt161..171.
    if (tile >= 150 && tile < 174) mask |= bits[side];
  }
  return mask;
}

/**0xd61a: visual RNG is consumed on every attempt, including no-road masks.
 * The random branch can reset the reference heading; at most FIVE attempts.
 * Map edges clamp to0..95, so an accepted step can stay on the same tile. */
export function planTrafficStep(world: Pick<Scenario, 'cells'>, x: number, y: number, heading: number,
  random: TrafficRandom): TrafficRoute | null {
  if (world.cells.length !== 9216 || !validPosition(x, y, heading)) throw new Error('Invalid traffic route');
  const neighbors = roadMask(world, x, y);
  let candidate = heading, reference = heading;
  for (let attempt = 0; attempt < 5; attempt++) {
    const mask = counts[neighbors] > 1 ? neighbors & ~reverseBits[reference >> 1] : neighbors;
    const choice = random.nextVisual();
    if ((choice & 1) && counts[mask] >= 1) {
      let side = random.nextVisual() & 3;
      while (!(mask & bits[side])) side = (side + 1) & 3;
      candidate = reference = side * 2;
    }
    const [dx, dy] = steps[candidate];
    const nx = Math.max(0, Math.min(95, x + dx)), ny = Math.max(0, Math.min(95, y + dy));
    const cell = world.cells[worldIndex(nx, ny)], tile = cell.terrain & 2047;
    if ((tile >= 150 && tile < 161) || (tile >= 172 && tile < 174) ||
      (tile >= 161 && tile < 172 && !(cell.overlay & 0x800))) return { x: nx, y: ny, heading: candidate };
    candidate = (candidate + 2) & 7;
    if (candidate === reference) return null;
  }
  return null;
}

/**0xd29c: clear active bit only, preserving drawn/unknown flags and payload. */
export function removeTraffic(state: TrafficState, slot: number): boolean {
  validateTraffic(state);
  if (!Number.isInteger(slot) || slot < 0 || slot >= 16) throw new Error('Invalid traffic slot');
  const record = state.records[slot];
  if (!record.active) return false;
  record.bytes[0] &= ~1; state.activeCount--; return true;
}

/**0xd356: erase a drawn origin, route, then update position even if hidden.
 * Only a previously drawn vehicle calls livestock collision at its destination.
 * Original viewport blits are represented by the changed canonical map cells. */
export function advanceTrafficVehicle(world: TrafficWorld, state: TrafficState, slot: number,
  random: TrafficRandom, runtime: CollisionRuntime): TrafficUpdate | null {
  validateTraffic(state);
  if (world.cells.length !== 9216 || !Number.isInteger(slot) || slot < 0 || slot >= 16 ||
    !Number.isInteger(runtime.animationTick) || runtime.animationTick < 0 || runtime.animationTick > 65535) throw new Error('Invalid traffic update');
  const record = state.records[slot]; if (!record.active) return null;
  const drawn = Boolean(record.flags & 2);
  if (drawn) {
    const origin = world.cells[worldIndex(record.x, record.y)]; origin.terrain &= ~0x800; origin.overlay &= 0xf800;
  }
  const route = planTrafficStep(world, record.x, record.y, record.heading, random);
  if (!route) {
    removeTraffic(state, slot);
    return { slot, kind: 'removed', x: record.x, y: record.y, heading: record.heading };
  }
  const target = world.cells[worldIndex(route.x, route.y)], occupied = Boolean(target.terrain & 0x800);
  if (occupied) {
    if (drawn) hitAnimal(route.x, route.y, world, runtime);
    record.bytes[0] &= ~2;
  } else {
    record.bytes[0] |= 2; target.terrain |= 0x800;
    target.overlay = (target.overlay & 0xf800) | (916 + record.variant * 4 + (route.heading >> 1));
  }
  const view = new DataView(record.bytes.buffer, record.bytes.byteOffset, record.bytes.byteLength);
  view.setUint16(2, route.x, true); view.setUint16(4, route.y, true); record.bytes[6] = route.heading;
  return { ...route, slot, kind: occupied ? 'hidden' : 'painted' };
}

/**0xd7f4: unsigned wrapped animation elapsed, delay1 bypass, one ordered
 * slot scan per call. A late call never catches up multiple movement rounds. */
export function advanceTraffic(world: TrafficWorld, state: TrafficState, random: TrafficRandom,
  runtime: CollisionRuntime): TrafficUpdate[] {
  validateTraffic(state);
  const tick = runtime.animationTick;
  if (world.cells.length !== 9216 || !Number.isInteger(tick) || tick < 0 || tick > 65535) throw new Error('Invalid traffic update');
  if (state.delay !== 1 && ((tick - state.lastTick) & 65535) < state.delay) return [];
  const updates: TrafficUpdate[] = [];
  for (let slot = 0; slot < 16; slot++) {
    const result = advanceTrafficVehicle(world, state, slot, random, runtime);
    if (result) updates.push(result);
  }
  state.lastTick = tick;
  return updates;
}
