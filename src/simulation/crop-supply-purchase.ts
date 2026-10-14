import { cropPlantTile } from '../formats/crop-slots';
import type { Scenario } from '../formats/scenario';
import { worldIndex, terrainTile } from '../formats/scenario';
import { BUILDING_GRAPHICS, findBuilding, findStorageSpace, toggleBuildingInterior } from './building-storage';

export const CROP_SUPPLY_TYPES = [...Array.from({ length: 16 }, (_, i) => 192 + i), 220, 221, 222, 223] as const;
export type CropSupplyPurchaseResult = { ok: true; slot: number; price: number; clearingCost: number; buildingSlot: number; x: number; y: number }
  | { ok: false; reason: 'unsupported-supply' | 'outside-map' | 'not-owned' | 'blocked-terrain' | 'storage-required'
    | 'incompatible-storage' | 'no-storage-space' | 'no-inventory-slots' | 'no-chemical-slots' | 'storage-slot-overflow' | 'insufficient-cash' };

/** One-cell shop0x24196 → generic purchase0x1cb42 → storage0x1cde3.
 * Ground path0x1cf28 explicitly rejects seeds/chemicals. Unlike manual movement,
 * purchasing excludes buildings70..72 before generic insertion (SF-117).
 * Preflight preserves SF-021/083/095 native transaction corrections. */
export function checkCropSupplyPurchase(world: Scenario, type: number, x: number, y: number, soilMoisture: number): CropSupplyPurchaseResult {
  if (!Number.isInteger(type) || !(type >= 192 && type < 192 + world.cropFiles.length || type >= 220 && type <= 223)) return { ok: false, reason: 'unsupported-supply' };
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) return { ok: false, reason: 'outside-map' };
  const chemical = type >= 220, def = chemical ? world.chemicalDefinitions[type - 220] : world.seedDefinitions[type - 192];
  if (!def || def.type !== type || def.width !== 1 || def.height !== 1 || def.graphic !== (chemical ? 74 + type - 220 : 87 + type - 192))
    throw new Error('Invalid crop supply definition');
  if (![world.farm.cash, world.farm.seedExpenses, world.farm.chemicalExpenses, world.farm.workerExpenses]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) || !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127)
    throw new Error('Invalid crop supply purchase state');
  const cell = world.cells[worldIndex(x, y)];
  if (!(cell.overlay & 0x800) || (cell.overlay & 0x4000)) return { ok: false, reason: 'not-owned' };
  if (cell.terrain & 0x800) return { ok: false, reason: 'blocked-terrain' }; // Source click gate, even in an open building.
  const b = findBuilding(world, x, y);
  if (!b || b.type >= 70) return { ok: false, reason: 'storage-required' };
  if (chemical && b.type < 66) return { ok: false, reason: 'incompatible-storage' };
  if (BUILDING_GRAPHICS[world.buildingDefinitions[b.type - 64].graphic] === undefined) throw new Error('Invalid storage graphic');
  const item = chemical ? world.chemicals.find(c => c.slot > 0 && c.slot < 127 && !c.active)
    : world.inventory.find(i => i.slot > 0 && i.slot < 512 && !i.active);
  if (!item) return { ok: false, reason: chemical ? 'no-chemical-slots' : 'no-inventory-slots' };
  if (item.slot > 255) return { ok: false, reason: 'storage-slot-overflow' };
  const space = findStorageSpace(b, 1, 1, world);
  if (!space) return { ok: false, reason: 'no-storage-space' };
  const tile = terrainTile(cell), clearing = world.farm.autoClear && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147));
  const clearingCost = clearing && tile >= 535 ? 25 : 0;
  const price = (def.price << 16 >> 16) >>> 0; // 0x1cb5c sign extension, unsigned debit comparison.
  if ((clearing && world.farm.cash < 25) || world.farm.cash < price + clearingCost) return { ok: false, reason: 'insufficient-cash' };
  return { ok: true, slot: item.slot, price, clearingCost, buildingSlot: b.slot, x: b.x + space.x, y: b.y + space.y };
}

/** Seed constructor0x15234 receives quantity10/value0 from0x3a43a.
 * Chemical constructor0x14590 resets only its named source bytes; full-table
 * rejection is bounded explicitly (SF-134). Both charge the definition price,
 * without the automatic seed+20 / chemical275 consumption surcharges. */
export function purchaseCropSupply(world: Scenario, type: number, x: number, y: number, soilMoisture: number): CropSupplyPurchaseResult {
  const result = checkCropSupplyPurchase(world, type, x, y, soilMoisture);
  if (!result.ok) return result;
  const chemical = type >= 220, def = chemical ? world.chemicalDefinitions[type - 220] : world.seedDefinitions[type - 192];
  const item = chemical ? world.chemicals[result.slot] : world.inventory[result.slot];
  const bytes = item.bytes, view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint16(0, type, true);
  if (chemical) {
    view.setUint16(2, 36, true); bytes[4] = 0; bytes[5] = result.x; bytes[6] = result.y;
    for (const offset of [8, 14, 16]) view.setUint16(offset, 0, true);
    view.setUint16(18, 24, true);
  } else {
    view.setUint16(2, 10, true); view.setUint16(4, 0, true); view.setUint16(6, 0, true);
    bytes[8] = result.x; bytes[9] = result.y; bytes[10] = 36; // SF-119: stored seeds; byte11 survives reuse.
  }
  def.count = (def.count + 1) & 65535;
  world.farm.cash -= result.price + result.clearingCost;
  const account = chemical ? 'chemicalExpenses' : 'seedExpenses';
  world.farm[account] = (world.farm[account] + result.price) >>> 0;
  world.farm.workerExpenses = (world.farm.workerExpenses + result.clearingCost) >>> 0;
  const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
  if (world.farm.autoClear && ((tile >= 535 && tile < 539) || (tile >= 131 && tile < 147)))
    cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
  const b = world.buildings[result.buildingSlot];
  b.setContent((result.x - b.x) * 3 + result.y - b.y, chemical ? 915 - type + 220 : cropPlantTile(type - 192), type, result.slot);
  toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
  return result;
}
