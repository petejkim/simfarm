import type { InventoryRecord } from '../formats/inventory';
import { worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, toggleBuildingInterior } from './building-storage';
import { creditHarvest } from './harvest-income';
import { harvestValue } from './harvest-value';

export type HarvestSaleResult = { ok: true; slot: number; value: number }
  | { ok: false; reason: 'invalid-item' | 'inconsistent-inventory' };

/** Harvested-goods branch of inventory valuation 0x1c3f2..0x1c47f.
 * Price comes from the crop trade table, not the stored-goods definition. */
export function storedHarvestValue(item: InventoryRecord, world: Scenario): number {
  const cropSlot = item.type - 168;
  if (!item.active || cropSlot < 0 || cropSlot >= 16) throw new Error('Invalid harvested inventory');
  return harvestValue(item.quantity, item.loss, Math.floor(world.cropDefinitions[cropSlot].price / 10));
}

/** Stored-crop sale 0x4c43c..0x4c4d3; immediate sale without a transport order.
 * SF-027: validate removal before payment. SF-026: retain duplicate income posting. */
export function sellStoredHarvest(world: Scenario, slot: number, soilMoisture: number): HarvestSaleResult {
  const item = world.inventory[slot];
  if (!Number.isInteger(slot) || slot <= 0 || !item?.active || item.type < 168 || item.type >= 184) {
    return { ok: false, reason: 'invalid-item' };
  }
  const definition = world.harvestDefinitions[item.type - 168];
  if (!definition.count || item.x >= 96 || item.y >= 96 || definition.width !== 1 || definition.height !== 1) {
    return { ok: false, reason: 'inconsistent-inventory' };
  }
  const building = findBuilding(world, item.x, item.y);
  const index = building ? (item.x - building.x) * 3 + item.y - building.y : 0;
  if (building) {
    const content = building.content(index);
    if (content.type !== item.type || content.slot !== slot) return { ok: false, reason: 'inconsistent-inventory' };
  }
  const value = storedHarvestValue(item, world);
  creditHarvest(world, value);
  world.farm.cropIncome = (world.farm.cropIncome + value) >>> 0; // Original second posting at 0x4c496.
  if (building) {
    building.clearContent(index);
    toggleBuildingInterior(building, world); toggleBuildingInterior(building, world);
  } else {
    // 0x1d1fa..0x1d233 retains terrain flags (unlike the seed-consumption path).
    const cell = world.cells[worldIndex(item.x, item.y)];
    cell.terrain = (cell.terrain & 0xf800) | ((15 + soilMoisture + (cell.attribute >> 2)) & 0xffff);
  }
  definition.count--; item.bytes[10] &= ~32; // 0x3a19f..0x3a1aa -> 0x152b0.
  return { ok: true, slot, value };
}
