import type { AnimalRecord } from '../formats/animal';
import type { AssetSaleState } from '../formats/asset-sale';
import type { EquipmentRecord, EquipmentDefinition } from '../formats/equipment';
import type { GoodsDefinition } from '../formats/inventory';
import { worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, toggleBuildingInterior } from './building-storage';
import { equipmentFootprint } from './equipment-world';

export interface AssetQuote { value: number; conditionBand: number }
export type AssetSaleResult = { ok: true; slot: number; value: number }
  | { ok: false; reason: 'invalid-asset' | 'asset-busy' | 'inconsistent-asset' };

/** 0x1192e: wear band increases depreciation; the unsigned word quote is
 * sign-extended by the sale caller at 0x4c502 (SF-055). */
export function equipmentSaleQuote(e: EquipmentRecord, definitions: readonly EquipmentDefinition[]): AssetQuote {
  const definition = definitions[e.type];
  if (!e.active || !definition) throw new Error('Invalid equipment quote');
  const band = e.condition >>> 6;
  return { value: definition.price >>> band, conditionBand: 3 - band };
}

/** 0x12958..0x12a4d: byte-wrapped type lookup, word-truncated multiplier,
 * unsigned dword addition/shift, then a word returned to the signed sale caller.
 * Only the five loaded definitions are accepted natively (SF-056). */
export function animalSaleQuote(a: AnimalRecord, definitions: readonly GoodsDefinition[]): AssetQuote {
  const definition = definitions[a.type - 160];
  if (!a.active || a.type < 160 || a.type > 164 || !definition) throw new Error('Invalid animal quote');
  const multiplier = [3, 5, 3, 2, 0][a.type - 160], band = a.conditionByte >>> 6;
  const increment = (a.valuationWord * multiplier) & 65535;
  return { value: ((definition.price + increment) >>> (3 - band)) & 65535, conditionBand: band };
}

const wordSigned = (n: number) => n << 16 >> 16;
const inMap = (n: number) => Number.isInteger(n) && n >= 0 && n < 96;
function validAccounts(world: Scenario, state: AssetSaleState): boolean {
  return [world.farm.cash, world.farm.salesAccumulator, state.equipmentBookValue, state.equipmentIncome, state.livestockIncome]
    .every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff);
}
function credit(world: Scenario, state: AssetSaleState, quoted: number, kind: 'equipmentIncome' | 'livestockIncome'): number {
  const amount = wordSigned(quoted);
  world.farm.cash = Math.min(9_999_999, (world.farm.cash + amount) >>> 0);
  world.farm.salesAccumulator = (world.farm.salesAccumulator + amount) >>> 0;
  state[kind] = (state[kind] + amount) >>> 0;
  return amount;
}

/** Prevalidate 0x1d0e8 -> 0x1aeb0 before payment (SF-027). */
function prepareRemoval(world: Scenario, x: number, y: number, width: number, height: number, type: number, slot: number,
  overlay: boolean, soilMoisture: number): (() => void) | undefined {
  if (![x, y].every(inMap) || ![width, height].every(n => Number.isInteger(n) && n >= 1 && n <= 127) ||
    x + width > 96 || y + height > 96) return;
  const building = findBuilding(world, x, y);
  if (building) {
    const dx = x - building.x, dy = y - building.y, def = world.buildingDefinitions[building.type - 64];
    if (dx + width > def.width || dy + height > def.height) return;
    for (let ix = dx; ix < dx + width; ix++) for (let iy = dy; iy < dy + height; iy++) {
      const item = building.content(ix * 3 + iy);
      if (item.slot !== slot || item.type !== type) return;
    }
    return () => {
      for (let ix = dx; ix < dx + width; ix++) for (let iy = dy; iy < dy + height; iy++) building.clearContent(ix * 3 + iy);
      toggleBuildingInterior(building, world); toggleBuildingInterior(building, world);
    };
  }
  return () => {
    for (let ix = x; ix < x + width; ix++) for (let iy = y; iy < y + height; iy++) {
      const cell = world.cells[worldIndex(ix, iy)];
      if (overlay) cell.terrain &= 0xf7ff;
      else cell.terrain = ((cell.terrain & 0xf800) | (15 + soilMoisture + (cell.attribute >>> 2))) & 65535;
    }
  };
}

/** Livestock branch of 0x4c41c. Does not rename or reset unrelated animal bytes. */
export function sellAnimal(world: Scenario, state: AssetSaleState, slot: number): AssetSaleResult {
  const animal = world.animals[slot], definition = animal && state.animalDefinitions[animal.type - 160];
  if (!Number.isInteger(slot) || slot <= 0 || !animal?.active || animal.type < 160 || animal.type > 164 || !definition) return { ok: false, reason: 'invalid-asset' };
  if (!validAccounts(world, state) || !definition.count) return { ok: false, reason: 'inconsistent-asset' };
  const building = findBuilding(world, animal.x, animal.y);
  if ((animal.flags & 4) && (!building || animal.buildingSlot !== building.slot)) return { ok: false, reason: 'inconsistent-asset' };
  const remove = prepareRemoval(world, animal.x, animal.y, definition.width, definition.height, animal.type, slot, true, 0);
  if (!remove) return { ok: false, reason: 'inconsistent-asset' };
  const value = credit(world, state, animalSaleQuote(animal, state.animalDefinitions).value, 'livestockIncome');
  remove(); definition.count--; animal.flags &= ~0x20;
  return { ok: true, slot, value };
}

/** Equipment branch of 0x4c41c, including plane-home cleanup 0x319ee.
 * The generic sale permits rentals; default selection separately excludes them. */
export function sellEquipment(world: Scenario, state: AssetSaleState, slot: number, soilMoisture: number): AssetSaleResult {
  const e = world.equipment[slot], definition = e && world.equipmentDefinitions[e.type];
  if (!Number.isInteger(slot) || slot <= 0 || !e?.active || e.type > 8 || !definition) return { ok: false, reason: 'invalid-asset' };
  if (e.flags & 9) return { ok: false, reason: 'asset-busy' };
  if (!validAccounts(world, state) || !definition.ownedCount || !Number.isInteger(soilMoisture) || soilMoisture < -128 || soilMoisture > 127) return { ok: false, reason: 'inconsistent-asset' };
  // Original deletion does not unlink equipment (SF-057). Do not leave live
  // parent/attachment references to an inactive machine. Truck +44 is storage.
  if (e.attachment || world.equipment.some(other => other.active && other.slot !== slot &&
    (other.attachment === slot || (other.type !== 7 && other.parent === slot)))) return { ok: false, reason: 'inconsistent-asset' };
  const { width, height } = e.type === 8 ? definition : equipmentFootprint(e, world);
  const homeX = e.bytes[50], homeY = e.bytes[51];
  if (e.type === 8 && (!inMap(homeX) || !inMap(homeY) || homeX >= 95 || homeY >= 95)) return { ok: false, reason: 'inconsistent-asset' };
  const remove = prepareRemoval(world, e.x, e.y, width, height, e.type, slot, e.type !== 8, soilMoisture);
  if (!remove) return { ok: false, reason: 'inconsistent-asset' };
  const value = credit(world, state, equipmentSaleQuote(e, world.equipmentDefinitions).value, 'equipmentIncome');
  remove();
  if (!(e.flags & 0x40)) {
    definition.ownedCount--;
    state.equipmentBookValue = (state.equipmentBookValue - definition.price) >>> 0;
  }
  if (e.type === 8) {
    for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) {
      const cell = world.cells[worldIndex(homeX + dx, homeY + dy)];
      cell.terrain = (cell.terrain & 0xf800) | 23;
    }
    const index = ((homeX >>> 3) * 12 + (homeY >>> 3)) * 7;
    if ((homeX & 7) === 3) world.regionalConditions[index] &= ~0x20;
    else if ((homeX & 7) === 5) world.regionalConditions[index] &= ~0x40;
  }
  e.flags &= ~0x20;
  return { ok: true, slot, value };
}
