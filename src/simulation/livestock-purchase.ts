import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { checkAnimalPurchase, purchaseAnimal, type AnimalPurchaseResult } from './animal-purchase';
import { findBuilding } from './building-storage';
import type { FarmRandom } from './random';

export const LIVESTOCK_PRODUCTS = [
  { type: 160, name: 'Horse' }, { type: 161, name: 'Cow' }, { type: 162, name: 'Pig' }, { type: 163, name: 'Sheep' },
  { type: 299, name: 'Water trough' }, { type: 300, name: 'Feed' },
] as const;
export type SupplyPurchaseResult = { ok: true; slot: number; price: number; clearingCost: number }
  | { ok: false; reason: 'unsupported-supply' | 'outside-map' | 'not-owned' | 'occupied'
    | 'blocked-terrain' | 'no-inventory-slots' | 'insufficient-cash' };
export type LivestockPurchaseResult = AnimalPurchaseResult | SupplyPurchaseResult;

/** Ground-shop branches0x242ba..0x244d0, generic placement0x1ce04.
 * Grass must be owned; roads have the original ownership exception. Atomic
 * preparation avoids the click caller's destructive early clearing (SF-095). */
export function checkSupplyPurchase(world: Scenario, finances: FinancialState, type: number,
  x: number, y: number, soilMoisture: number): SupplyPurchaseResult {
  if (type !== 299 && type !== 300) return { ok: false, reason: 'unsupported-supply' };
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) return { ok: false, reason: 'outside-map' };
  const def = finances.accounts.otherDefinitions[type - 288];
  if (!def || def.type !== type || def.width !== 1 || def.height !== 1 || def.graphic !== (type === 299 ? 79 : 81))
    throw new Error('Invalid livestock supply definition');
  if (![world.farm.cash, world.farm.workerExpenses].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) ||
    !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) throw new Error('Invalid livestock supply state');
  const cell = world.cells[worldIndex(x, y)];
  if (cell.overlay & 0x4000) return { ok: false, reason: 'not-owned' };
  if (findBuilding(world, x, y) || world.animals.some(a => a.active && a.x === x && a.y === y) ||
    world.inventory.some(i => i.active && i.x === x && i.y === y)) return { ok: false, reason: 'occupied' };
  if (cell.terrain & 0x800) return { ok: false, reason: 'blocked-terrain' };
  let tile = terrainTile(cell), clearingCost = 0;
  if (world.farm.autoClear && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147))) {
    if (world.farm.cash < 25) return { ok: false, reason: 'insufficient-cash' };
    clearingCost = tile >= 535 ? 25 : 0;
    tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
  }
  // Click allows31/172, but generic placement rejects them and refunds. Use
  // the intersection, without changing records/accounts on failed placement.
  if (tile >= 15 && tile < 31) {
    if (!(cell.overlay & 0x800)) return { ok: false, reason: 'not-owned' };
  } else if (!(tile >= 150 && tile < 172)) return { ok: false, reason: 'blocked-terrain' };
  const free = world.inventory.find(i => i.slot > 0 && i.slot < 512 && !i.active);
  if (!free) return { ok: false, reason: 'no-inventory-slots' };
  const price = (def.price << 16 >> 16) >>> 0;
  if (world.farm.cash < price + clearingCost) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, slot: free.slot, price, clearingCost };
}

/** Allocator0x15234 /0x3a468, click painting0x24385 /0x244a6.
 * Debit0x1c88e has no expense-category match for299/300: cash only. */
export function purchaseSupply(world: Scenario, finances: FinancialState, type: number,
  x: number, y: number, soilMoisture: number): SupplyPurchaseResult {
  const result = checkSupplyPurchase(world, finances, type, x, y, soilMoisture);
  if (!result.ok) return result;
  const bytes = world.inventory[result.slot].bytes, view = new Binary(bytes).view;
  view.setUint16(0, type, true); view.setUint16(2, type === 299 ? 256 : 512, true);
  view.setUint16(4, 0, true); view.setUint16(6, 0, true);
  bytes[8] = x; bytes[9] = y; bytes[10] = 32; // Byte11 survives reuse.
  const def = finances.accounts.otherDefinitions[type - 288];
  def.count = (def.count + 1) & 65535;
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
  if (world.farm.autoClear && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147)))
    cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  if (type === 299) cell.terrain = (cell.terrain & 0xf800) | 176;
  else { cell.terrain |= 0x800; cell.overlay = (cell.overlay & 0xf800) | 1020; }
  return result;
}

export function checkLivestockPurchase(world: Scenario, finances: FinancialState, type: number,
  x: number, y: number, soilMoisture: number): LivestockPurchaseResult {
  return type === 299 || type === 300 ? checkSupplyPurchase(world, finances, type, x, y, soilMoisture)
    : checkAnimalPurchase(world, finances, type, x, y, soilMoisture);
}

export function purchaseLivestock(world: Scenario, finances: FinancialState, random: FarmRandom, type: number,
  x: number, y: number, soilMoisture: number): LivestockPurchaseResult {
  return type === 299 || type === 300 ? purchaseSupply(world, finances, type, x, y, soilMoisture)
    : purchaseAnimal(world, finances, random, type, x, y, soilMoisture);
}
