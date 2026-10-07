import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding } from './building-storage';
import type { FarmRandom } from './random';

// Four ordinary definitions. The fifth saved definition repeats type163 and
// is deliberately not reinterpreted as a new purchasable species (SF-056).
export const PURCHASABLE_ANIMALS = [160, 161, 162, 163] as const;
const graphics: Readonly<Record<number, number>> = { 37: 946, 34: 962, 35: 978, 36: 994 };
const initialCounter = [48, 40, 44, 24]; // DS6190:2294, indexed at0x11b1d.
export type AnimalPurchaseResult = { ok: true; slot: number; price: number; clearingCost: number }
  | { ok: false; reason: 'unsupported-animal' | 'outside-map' | 'not-owned' | 'occupied'
    | 'blocked-terrain' | 'no-animal-slots' | 'insufficient-cash' };

/** One-cell click guards0x24266 /0x24295 /0x24ac8, generic purchase0x1cb42
 * and placement0x1ce04. Native preparation is atomic, including random state. */
export function checkAnimalPurchase(world: Scenario, finances: FinancialState, type: number, x: number, y: number,
  soilMoisture: number): AnimalPurchaseResult {
  if (!PURCHASABLE_ANIMALS.some(t => t === type)) return { ok: false, reason: 'unsupported-animal' };
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) return { ok: false, reason: 'outside-map' };
  const definition = finances.accounts.assets.animalDefinitions[type - 160];
  if (!definition || definition.type !== type || definition.width !== 1 || definition.height !== 1 ||
    graphics[definition.graphic] === undefined) throw new Error('Invalid animal purchase definition');
  if (![world.farm.cash, world.farm.workerExpenses, finances.annual.livestockExpenses, finances.statistics.ds3e5c]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
    !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid animal purchase state');
  const cell = world.cells[worldIndex(x, y)];
  if (!(cell.overlay & 0x800) || (cell.overlay & 0x4000)) return { ok: false, reason: 'not-owned' };
  if (findBuilding(world, x, y) || world.animals.some(a => a.active && a.x === x && a.y === y)) return { ok: false, reason: 'occupied' };
  if (cell.terrain & 0x800) return { ok: false, reason: 'blocked-terrain' };
  const free = world.animals.find(a => a.slot > 0 && a.slot < 256 && !a.active);
  if (!free) return { ok: false, reason: 'no-animal-slots' };
  const price = (definition.price << 16 >> 16) >>> 0;
  let tile = terrainTile(cell), clearingCost = 0;
  // Single-cell click auto-clears BEFORE its generic purchase debit (SF-095).
  if (world.farm.autoClear && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147))) {
    if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
    clearingCost = tile >= 535 ? 25 : 0;
    tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
  }
  if (!((tile >= 15 && tile < 31) || (tile >= 150 && tile < 172))) return { ok: false, reason: 'blocked-terrain' };
  if (world.farm.cash < price + clearingCost) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, slot: free.slot, price, clearingCost };
}

/** Allocation0x11a76, count/asset posting0x3a37a, debit0x1c962 and masked
 * painting0x1cfd4. Retain every original byte not explicitly initialized. */
export function purchaseAnimal(world: Scenario, finances: FinancialState, random: FarmRandom, type: number,
  x: number, y: number, soilMoisture: number): AnimalPurchaseResult {
  const result = checkAnimalPurchase(world, finances, type, x, y, soilMoisture);
  if (!result.ok) return result;
  const definition = finances.accounts.assets.animalDefinitions[type - 160];
  const animal = world.animals[result.slot], bytes = animal.bytes, v = new Binary(bytes).view;
  bytes[0] = x; bytes[1] = y; v.setUint16(6, type, true);
  bytes[4] = random.nextVisual() & 7; bytes[5] = 1; bytes[8] = 255;
  bytes[14] = bytes[13] = 0; v.setUint16(10, 0, true); bytes[12] = 1;
  v.setUint16(16, 0, true); v.setUint16(20, 0, true); bytes[18] = 0;
  animal.flags = 0x20; v.setUint16(26, initialCounter[type - 160], true); bytes[28] = 0;
  if (random.nextSimulation() & 1) animal.flags |= 2;
  definition.count = (definition.count + 1) & 65535;
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  finances.annual.livestockExpenses = (finances.annual.livestockExpenses + result.price) >>> 0;
  finances.statistics.ds3e5c = (finances.statistics.ds3e5c + result.price) >>> 0;
  const cell = world.cells[worldIndex(x, y)];
  // Auto-clear restores the ground before the animal is painted over it.
  const oldTile = terrainTile(cell);
  if (world.farm.autoClear && ((oldTile >= 535 && oldTile < 539) || (oldTile >= 131 && oldTile < 147)))
    cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  cell.terrain |= 0x800;
  cell.overlay = (cell.overlay & 0xf800) | graphics[definition.graphic];
  return result;
}
