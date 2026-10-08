import { Binary } from '../formats/binary';
import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { BUILDING_GRAPHICS, findBuilding } from './building-storage';
import { addIrrigationSource, validateIrrigation } from '../formats/irrigation';

export const PURCHASABLE_BUILDINGS = [64, 65, 66, 67, 68, 69, 70, 71, 72] as const;
export type BuildingPlacementResult = { ok: true; slot: number; price: number; clearingCost: number }
  | { ok: false; reason: 'unsupported-building' | 'outside-map' | 'not-owned' | 'occupied'
    | 'blocked-terrain' | 'no-building-slots' | 'no-water-source-slots' | 'insufficient-cash' };

/** Purchase 0x1cb42, placement 0x1ce04, auto-clear 0x26faa. Preflight is
 * read-only: SF-081/082/083 protection precedes all cash and terrain writes. */
export function checkBuildingPlacement(world: Scenario, type: number, x: number, y: number,
  soilMoisture: number): BuildingPlacementResult {
  if (!PURCHASABLE_BUILDINGS.some(t => t === type)) return { ok: false, reason: 'unsupported-building' };
  const def = world.buildingDefinitions[type - 64];
  if (!def || def.type !== type || def.width < 1 || def.width > 4 || def.height < 1 || def.height > 3 ||
    BUILDING_GRAPHICS[def.graphic] === undefined) throw new Error('Invalid construction definition');
  if (![x, y].every(n => Number.isInteger(n) && n >= 0) || x + def.width > 96 || y + def.height > 96)
    return { ok: false, reason: 'outside-map' };
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127 ||
    !Number.isInteger(world.farm.cash) || world.farm.cash < 0 || world.farm.cash > 0xffffffff)
    throw new Error('Invalid construction state');
  // The original checks only the origin, even for a multi-cell footprint (SF-085).
  if (type !== 70 && !(world.cells[worldIndex(x, y)].overlay & 0x800)) return { ok: false, reason: 'not-owned' };
  if (type === 72 && (world.cells[worldIndex(x, y)].overlay & 0x4000)) return { ok: false, reason: 'not-owned' }; // One-cell click0x24266.
  if (findBuilding(world, x, y, def.width, def.height)) return { ok: false, reason: 'occupied' };
  const free = world.buildings.find(b => b.slot > 0 && b.slot <= 126 && !b.active);
  if (!free) return { ok: false, reason: 'no-building-slots' };
  if (type === 70 || type === 71) {
    validateIrrigation(world.irrigation);
    if (world.irrigation.sourceCount === 64) return { ok: false, reason: 'no-water-source-slots' };
  }
  const price = (def.price << 16 >> 16) >>> 0;
  // Multi-cell ghost UI 0x22445..0x22464 requires strictly more than price;
  // the one-cell click/debit path allows equality (SF-084).
  if (world.farm.cash < price || (def.width * def.height > 1 && world.farm.cash === price))
    return { ok: false, reason: 'insufficient-cash' };
  let remaining = world.farm.cash - price, clearingCost = 0;
  for (let dy = 0; dy < def.height; dy++) for (let dx = 0; dx < def.width; dx++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)];
    let tile = terrainTile(cell);
    if (cell.terrain & 0x800) return { ok: false, reason: 'blocked-terrain' };
    const paidTree = tile >= 535 && tile < 539, freeTree = tile >= 131 && tile < 147;
    if (world.farm.autoClear && (paidTree || freeTree)) {
      // Both families require $25 remaining; only 535..538 debit it.
      // Type72 uses the one-cell click's initial clear BEFORE its purchase.
      if ((type === 72 ? world.farm.cash : remaining) < 25) return { ok: false, reason: 'insufficient-cash' };
      if (paidTree) { remaining -= 25; clearingCost += 25; }
      if (remaining < 0) return { ok: false, reason: 'insufficient-cash' };
      tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
    }
    if (!((tile >= 15 && tile < 31) || (tile >= 150 && tile < 172)))
      return { ok: false, reason: 'blocked-terrain' };
  }
  return { ok: true, slot: free.slot, price, clearingCost };
}

/** Successful original allocation/ledger/painting, with atomic rejection.
 * The saved building/definition bytes and existing ledgers already persist this.
 * No source record member or runtime account is inferred from its neighbors. */
export function purchaseBuilding(world: Scenario, finances: FinancialState, type: number, x: number, y: number,
  soilMoisture: number): BuildingPlacementResult {
  const result = checkBuildingPlacement(world, type, x, y, soilMoisture);
  if (!result.ok) return result;
  if (![finances.accounts.buildingBookValue, finances.annual.ds3e90, world.farm.workerExpenses]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) throw new Error('Invalid construction accounts');
  const b = world.buildings[result.slot], def = world.buildingDefinitions[type - 64], v = new Binary(b.bytes).view;
  if (type === 70 || type === 71) addIrrigationSource(world.irrigation, x, y, type === 70 ? 64 : 48);
  v.setUint16(0, type, true); b.flags = 0x20; b.bytes[4] = x; b.bytes[5] = y; b.bytes[6] = 0;
  v.setUint16(8, 0, true); // +7 deliberately survives slot reuse, as in 0x1a0a8.
  for (let i = 0; i < 12; i++) b.clearContent(i);
  def.count++;
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  finances.annual.ds3e90 = (finances.annual.ds3e90 + result.price) >>> 0;
  finances.accounts.buildingBookValue = (finances.accounts.buildingBookValue + def.price) >>> 0;
  const base = BUILDING_GRAPHICS[def.graphic];
  for (let dy = 0; dy < def.height; dy++) for (let dx = 0; dx < def.width; dx++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)];
    const tile = base + dy * def.width + dx;
    if (base >= 848) { cell.terrain |= 0x800; cell.overlay = (cell.overlay & 0xf800) | tile; }
    else cell.terrain = (cell.terrain & 0xf800) | tile;
  }
  return result;
}
