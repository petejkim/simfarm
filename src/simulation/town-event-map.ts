import { worldIndex, type Scenario } from '../formats/scenario';
import type { TownConstructionState } from '../formats/town';
import type { TownEventMode } from '../formats/town-event-graphics';
import type { FarmRandom } from './random';

/** Source DS1ed2,1ed4,1ed6..1ed8. Clock ownership stays with the simulation. */
export interface TownEventAnimation {
  mode: TownEventMode;
  lastTick: number;
  rodeoFrame: number;
  rodeoX: number;
  rodeoY: number;
}
type World = Pick<Scenario, 'cells'>;
type Recreation = Pick<TownConstructionState, 'recreationCount' | 'recreationCoordinates'>;
const positions = [[3, 2], [2, 1], [1, 3], [1, 5], [3, 3], [5, 2]] as const;
function validate(world: World, recreation: Recreation, state: TownEventAnimation): void {
  if (world.cells.length !== 96 * 96 || !Number.isInteger(recreation.recreationCount) ||
    recreation.recreationCount < 0 || recreation.recreationCount > 7 || recreation.recreationCoordinates.length !== 16 ||
    ![0, 1, 2].includes(state.mode) || !Number.isInteger(state.lastTick) || state.lastTick < 0 || state.lastTick > 65535 ||
    !Number.isInteger(state.rodeoFrame) || state.rodeoFrame < 0 || state.rodeoFrame > 3 ||
    ![0, 1].includes(state.rodeoX) || ![0, 1].includes(state.rodeoY)) throw new Error('Invalid town event map state');
  for (let i = 0; i < recreation.recreationCount * 2; i++)
    if (recreation.recreationCoordinates[i] > 90) throw new Error('Invalid recreation footprint');
}
function eachDistrict(recreation: Recreation, apply: (x: number, y: number) => void): void {
  for (let i = 0; i < recreation.recreationCount; i++)
    apply(recreation.recreationCoordinates[i * 2], recreation.recreationCoordinates[i * 2 + 1]);
}
function clearRodeo(world: World, x: number, y: number): void {
  for (let dx = 2; dx < 4; dx++) for (let dy = 3; dy < 5; dy++)
    world.cells[worldIndex(x + dx, y + dy)].terrain &= 0xf7ff;
}
function paintFair(world: World, x: number, y: number, tiles: readonly number[]): void {
  positions.forEach(([dx, dy], i) => { world.cells[worldIndex(x + dx, y + dy)].terrain = tiles[i]; });
}
const restored = [492, 484, 497, 511, 499, 494];

/** 0xd9b2..0xdb51: restore outgoing mode before selecting the new artwork bank.
 * Zero recreation returns before any state change. Bank upload is separate. */
export function changeTownEventMap(world: World, recreation: Recreation, state: TownEventAnimation,
  mode: TownEventMode): boolean {
  validate(world, recreation, state);
  if (![0, 1, 2].includes(mode)) throw new Error('Invalid town event mode');
  if (!recreation.recreationCount) return false;
  eachDistrict(recreation, (x, y) => {
    if (state.mode === 1) clearRodeo(world, x, y);
    if (state.mode === 2) paintFair(world, x, y, restored);
  });
  if (mode === 0) eachDistrict(recreation, (x, y) => paintFair(world, x, y, restored));
  state.mode = mode;
  return true;
}

/** 0xdd3e..0xdf46: eight-tick unsigned elapsed gate; shared rodeo phase advances
 * once per district, and draws from the original simulation RNG stream. */
export function animateTownEventMap(world: World, recreation: Recreation, state: TownEventAnimation,
  tick: number, random: Pick<FarmRandom, 'nextSimulation'>): boolean {
  validate(world, recreation, state);
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535) throw new Error('Invalid town event tick');
  if (!recreation.recreationCount || state.mode === 0 || ((tick - state.lastTick) & 65535) < 8) return false;
  eachDistrict(recreation, (x, y) => {
    if (state.mode === 1) {
      clearRodeo(world, x, y);
      state.rodeoFrame = (state.rodeoFrame + 1) & 3;
      if (state.rodeoFrame === 0) {
        state.rodeoX = random.nextSimulation() & 1;
        state.rodeoY = random.nextSimulation() & 1;
      }
      const tile = 937 + (random.nextSimulation() & 7);
      const cell = world.cells[worldIndex(x + 2 + state.rodeoX, y + 3 + state.rodeoY)];
      cell.overlay = (cell.overlay & 0xf800) | tile;
      cell.terrain |= 0x0800;
    } else {
      // Fair's ordinary animation swaps the final two offsets relative to cleanup.
      paintFair(world, x, y, random.nextSimulation() & 1
        ? [526, 527, 528, 528, 529, 529] : [492, 484, 497, 511, 494, 499]);
    }
  });
  state.lastTick = tick;
  return true;
}
