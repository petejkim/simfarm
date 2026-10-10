import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import type { FarmRandom } from './random';

export type TreePlacementResult = { ok: true; price: number; clearingCost: number }
  | { ok: false; reason: 'outside-map' | 'town-land' | 'blocked-terrain' | 'not-owned' | 'insufficient-cash' };

/** Palette291 ->24a98 grass gate ->1cb42 purchase ->1ce04 final placement.
 * Preflight keeps rejected clearing/payment/RNG atomic (SF-083/095). */
export function checkTreePlacement(world: Scenario, finances: FinancialState, x: number, y: number,
  soilMoisture: number): TreePlacementResult {
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) return { ok: false, reason: 'outside-map' };
  const def = finances.accounts.otherDefinitions[3];
  if (!def || def.type !== 291 || def.graphic !== 62 || def.width !== 1 || def.height !== 1)
    throw new Error('Invalid tree definition');
  if (![world.farm.cash, world.farm.workerExpenses].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)
    || !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid tree placement state');
  const cell = world.cells[worldIndex(x, y)];
  if (cell.overlay & 0x4000) return { ok: false, reason: 'town-land' };
  if (cell.terrain & 0x800) return { ok: false, reason: 'blocked-terrain' };
  let tile = terrainTile(cell), clearingCost = 0;
  if (world.farm.autoClear && ((tile >= 535 && tile <= 538) || (tile >= 131 && tile <= 146))) {
    if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
    clearingCost = tile >= 535 ? 25 : 0;
    tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
  }
  // Click accepts31, but the final generic guard excludes it. Roads fail the click guard.
  if (tile < 15 || tile >= 31) return { ok: false, reason: 'blocked-terrain' };
  if (!(cell.overlay & 0x800)) return { ok: false, reason: 'not-owned' };
  const price = (def.price << 16 >> 16) >>> 0;
  if (world.farm.cash < price + clearingCost) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, price, clearingCost };
}

export function placeTree(world: Scenario, finances: FinancialState, random: FarmRandom,
  x: number, y: number, soilMoisture: number): TreePlacementResult {
  const result = checkTreePlacement(world, finances, x, y, soilMoisture);
  if (!result.ok) return result;
  // Generic debit291 matches no expense category. Generic add3a518 increments
  // only the definition count: trees allocate no inventory/building record.
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  const def = finances.accounts.otherDefinitions[3]; def.count = (def.count + 1) & 65535;
  const cell = world.cells[worldIndex(x, y)];
  cell.terrain = (cell.terrain & 0xf800) | (131 + (random.nextVisual() & 15)); //1d07f..1d0a6
  return result;
}
