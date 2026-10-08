import type { Scenario } from '../formats/scenario';
import type { FinancialState } from '../formats/finance';
import type { WeatherState } from './weather';
import type { MovingDisasterState } from './moving-disasters';
import type { FarmRandom } from './random';
import { adjustMarketForDisaster, type MarketState } from './market';
import { refreshShorelines } from './terrain-removal';
import { removeField } from './field-removal';
import { findBuilding } from './building-storage';
import { prepareDisasterBuilding } from './disaster-building';

export type WaterDisasterKind = 'drought' | 'flood';
/** DS6997, DS69b7 and2d9f:ff68..ff6e. The last two words are reset at
 * flood start; their semantics remain unknown and their bytes are retained. */
export interface WaterDisasterState {
  counter: number; scanning: boolean; scanX: number; scanY: number;
  rawFF6C: number; rawFF6E: number;
}
export function createWaterDisasters(): WaterDisasterState {
  return { counter: 0, scanning: false, scanX: 0, scanY: 0, rawFF6C: 0, rawFF6E: 0 };
}
export function validateWaterDisasters(state: WaterDisasterState): void {
  const integer = (n: number, a: number, b: number) => Number.isInteger(n) && n >= a && n <= b;
  if (!integer(state.counter, -128, 127) || typeof state.scanning !== 'boolean' ||
    !integer(state.scanX, 0, 94) || !integer(state.scanY, 0, 93) || (state.scanning && state.scanX === 94) ||
    !integer(state.rawFF6C, 0, 65535) || !integer(state.rawFF6E, 0, 65535)) throw new Error('Invalid water disaster state');
}
const protectedWaterTile = (tile: number) => tile === 120 || tile === 121 || tile === 172 || tile === 173;

/** 0x16ac0: number of dry entries in a3x3 neighborhood. Clamp COPIES so
 * edges are deliberately counted more than once; this is not water depth. */
export function countDryNeighbors(world: Scenario, x: number, y: number): number {
  let dry = 0;
  for (let nx = x - 1; nx <= x + 1; nx++) for (let ny = y - 1; ny <= y + 1; ny++) {
    const index = Math.max(0, Math.min(95, nx)) * 96 + Math.max(0, Math.min(95, ny));
    if (!(world.cells[index].terrain & 0x3000)) dry++;
  }
  return dry;
}

/** 0x369be/0x36b12. The callback reprices even a rejected repeated start.
 * Native presentation/audio is left to the caller; no host RNG is used. */
export function beginWaterDisaster(world: Scenario, crops: readonly (readonly number[])[], market: MarketState, weather: WeatherState,
  shared: MovingDisasterState, state: WaterDisasterState, kind: WaterDisasterKind, tick: number, random: FarmRandom): boolean {
  validateWaterDisasters(state);
  if (!shared.enabled) return false;
  const flag = kind === 'drought' ? 2 : 4;
  adjustMarketForDisaster(market, crops, kind === 'drought' ? 2 : 3);
  if (shared.flags & flag) return false;
  shared.flags |= flag;
  if (kind === 'drought') {
    for (let x = 0; x < 96; x++) for (let y = 0; y < 96; y++) {
      const cell = world.cells[x * 96 + y];
      if ((cell.terrain & 0x3000) && countDryNeighbors(world, x, y) >= 3 && !protectedWaterTile(cell.terrain & 2047))
        cell.terrain = ((cell.terrain & 0xf800) | 28) & ~0x2000;
    }
    refreshShorelines(world, random);
  } else {
    Object.assign(state, { counter: 0, scanning: true, scanX: 0, scanY: 0, rawFF6C: 0, rawFF6E: 0 });
    weather.precipitationBonus = 4; // Source DS6994, already owned by WeatherState.
  }
  shared.lastStartTick = tick;
  return true;
}

/** Stop0x36e08/0x36f38. Preserve the source's asymmetric high-bit policy. */
export function stopWaterDisaster(world: Scenario, weather: WeatherState, shared: MovingDisasterState,
  state: WaterDisasterState, kind: WaterDisasterKind, random: FarmRandom): boolean {
  validateWaterDisasters(state);
  const flag = kind === 'drought' ? 2 : 4;
  if (!(shared.flags & flag)) return false;
  shared.flags &= ~flag;
  for (const cell of world.cells) {
    if (kind === 'drought') {
      if ((cell.terrain & 0x3000) !== 0x1000) continue;
      if (!protectedWaterTile(cell.terrain & 2047)) cell.terrain = (cell.terrain & 0xf800) | 54;
      cell.terrain |= 0x2000;
    } else {
      if ((cell.terrain & 0x3000) !== 0x2000) continue;
      if (!protectedWaterTile(cell.terrain & 2047)) cell.terrain = 28; // Original drops ALL high flags here.
      cell.terrain &= ~0x2000;
    }
  }
  refreshShorelines(world, random);
  if (kind === 'flood') { state.counter = -8; weather.precipitationBonus = 0; } // SF-132; scanning/cursors survive stop.
  return true;
}

/** Weekly0x37924 before natural triggers. SF-132: no inactive countdown. */
export function advanceFloodCounter(shared: MovingDisasterState, state: WaterDisasterState): void {
  if (shared.flags & 4) state.counter = (state.counter + 1) << 24 >> 24;
}

export interface FloodStep { scanned: number; fields: number[]; buildings: number[]; ended: boolean }

/** Dispatcher0x37677..0x378f5, after moving effects; no tick/delay gate.
 * The source scans0..93 and floods x−1..x,y−1..y+1 (SF-131). */
export function advanceFlood(world: Scenario, finances: FinancialState, weather: WeatherState, shared: MovingDisasterState,
  state: WaterDisasterState, random: FarmRandom): FloodStep {
  validateWaterDisasters(state);
  const result: FloodStep = { scanned: 0, fields: [], buildings: [], ended: false };
  if (!(shared.flags & 4)) return result;
  if (state.counter > 8) { result.ended = stopWaterDisaster(world, weather, shared, state, 'flood', random); return result; }
  for (let n = 0; n < 64; n++) {
    if (!state.scanning) continue;
    const { scanX, scanY } = state; result.scanned++;
    if (world.cells[scanX * 96 + scanY].terrain & 0x1000) {
      // In this caller the clamp mutates the loop counters; clipped negative
      // entries are visited once, unlike countDryNeighbors' copied counters.
      for (let x = Math.max(0, scanX - 1); x <= scanX; x++) for (let y = Math.max(0, scanY - 1); y <= scanY + 1; y++) {
        const field = world.fields.find(f => f.slot && f.contains(x, y));
        if (field && (field.state === 0 || field.state === 4) && removeField(world, field.slot, finances.clearing, weather.soilMoisture))
          result.fields.push(field.slot);
        const building = findBuilding(world, x, y);
        if (building) { prepareDisasterBuilding(world, finances, building.slot, weather.soilMoisture)(); result.buildings.push(building.slot); }
        const cell = world.cells[x * 96 + y], tile = cell.terrain & 2047;
        if (tile !== 172 && tile !== 173) cell.terrain |= 0x2000;
      }
    }
    if (++state.scanY >= 94) { state.scanY = 0; if (++state.scanX >= 94) state.scanning = false; }
  }
  refreshShorelines(world, random); // Even after scanning has finished, while flag4 remains active.
  return result;
}
