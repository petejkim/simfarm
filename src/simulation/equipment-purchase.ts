import type { FinancialState } from '../formats/finance';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, findStorageSpace, storeEquipment } from './building-storage';
import { createEquipment } from './equipment-rental';
import { drawEquipment, EQUIPMENT_GRAPHICS } from './equipment-world';

export const PURCHASABLE_EQUIPMENT = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export type EquipmentPurchaseResult = { ok: true; slot: number; price: number; clearingCost: number; buildingSlot: number | null }
  | { ok: false; reason: 'unsupported-equipment' | 'outside-map' | 'not-owned' | 'blocked-terrain'
    | 'no-equipment-slots' | 'no-storage-space' | 'insufficient-cash' };

/** Shop0x24196/0x22445 → purchase0x1cb42 → placement0x1ccea.
 * Check the complete transaction before changing records, terrain or accounts
 * (SF-083/095). The source checks ownership only at the origin (SF-085). */
export function checkEquipmentPurchase(world: Scenario, type: number, x: number, y: number,
  soilMoisture: number): EquipmentPurchaseResult {
  if (!PURCHASABLE_EQUIPMENT.some(t => t === type)) return { ok: false, reason: 'unsupported-equipment' };
  const def = world.equipmentDefinitions[type];
  if (!def || def.type !== type || def.width !== 1 || ![1, 2].includes(def.height) ||
    EQUIPMENT_GRAPHICS[def.graphic] === undefined) throw new Error('Invalid ground equipment definition');
  if (![x, y].every(n => Number.isInteger(n) && n >= 0) || x + def.width > 96 || y + def.height > 96)
    return { ok: false, reason: 'outside-map' };
  if (!Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127 ||
    !Number.isInteger(world.farm.cash) || world.farm.cash < 0 || world.farm.cash > 0xffffffff)
    throw new Error('Invalid equipment purchase state');
  const single = def.width * def.height === 1, origin = world.cells[worldIndex(x, y)];
  if (!(origin.overlay & 0x800) || (single && (origin.overlay & 0x4000))) return { ok: false, reason: 'not-owned' };
  if (single && (origin.terrain & 0x800)) return { ok: false, reason: 'blocked-terrain' };
  const free = world.equipment.find(e => e.slot > 0 && e.slot < 127 && !e.active);
  if (!free) return { ok: false, reason: 'no-equipment-slots' };
  const price = (def.price << 16 >> 16) >>> 0;
  if (world.farm.cash < price || (!single && world.farm.cash === price)) return { ok: false, reason: 'insufficient-cash' };
  const found = findBuilding(world, x, y), building = found && found.type < 70 ? found : undefined;
  if (building && (building.type < 66 || !findStorageSpace(building, def.width, def.height, world)))
    return { ok: false, reason: 'no-storage-space' };
  let remaining = world.farm.cash - price, clearingCost = 0;
  for (let dy = 0; dy < def.height; dy++) for (let dx = 0; dx < def.width; dx++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)];
    let tile = terrainTile(cell);
    const paid = tile >= 535 && tile < 539, freeTree = tile >= 131 && tile < 147;
    if (world.farm.autoClear && (paid || freeTree)) {
      // One-cell click clears BEFORE debit; generic multi-cell purchase clears AFTER it.
      if ((single ? world.farm.cash : remaining) < 25) return { ok: false, reason: 'insufficient-cash' };
      if (paid) { remaining -= 25; clearingCost += 25; }
      if (remaining < 0) return { ok: false, reason: 'insufficient-cash' };
      tile = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 0x7ff;
    }
    // Storage dispatch precedes generic ground eligibility0x1cde3.
    if (!building && ((cell.terrain & 0x800) || !((tile >= 15 && tile < 31) || (tile >= 150 && tile < 172))))
      return { ok: false, reason: 'blocked-terrain' };
  }
  return { ok: true, slot: free.slot, price, clearingCost, buildingSlot: building?.slot ?? null };
}

/** Allocation0xf8be/0x3a2ca; expense DS3e7c and unsigned book value DS3e50.
 * Direct storage uses the same first-fit/orientation helper as returning equipment. */
export function purchaseEquipment(world: Scenario, finances: FinancialState, type: number, x: number, y: number,
  soilMoisture: number): EquipmentPurchaseResult {
  const result = checkEquipmentPurchase(world, type, x, y, soilMoisture);
  if (!result.ok) return result;
  if (![world.farm.workerExpenses, finances.accounts.equipmentExpenses, finances.accounts.assets.equipmentBookValue]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) throw new Error('Invalid equipment purchase accounts');
  const def = world.equipmentDefinitions[type];
  const e = createEquipment(world, type, x, y, world.farm.timerTicks)!;
  def.ownedCount++;
  world.farm.cash -= result.price + result.clearingCost;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  finances.accounts.equipmentExpenses = (finances.accounts.equipmentExpenses + result.price) >>> 0;
  finances.accounts.assets.equipmentBookValue = (finances.accounts.assets.equipmentBookValue + def.price) >>> 0;
  for (let dy = 0; dy < def.height; dy++) for (let dx = 0; dx < def.width; dx++) {
    const cell = world.cells[worldIndex(x + dx, y + dy)], tile = terrainTile(cell);
    if (world.farm.autoClear && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147)))
      cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  }
  if (result.buildingSlot !== null) storeEquipment(world.buildings[result.buildingSlot], e, world);
  else drawEquipment(e, world);
  return result;
}
