import { EQUIPMENT_FLAGS as F, type EquipmentRecord } from '../formats/equipment';
import { Binary } from '../formats/binary';
import type { Scenario } from '../formats/scenario';
import { reserveOwnedEquipment } from './building-storage';

/** Shared equipment constructor 0xf8be. Initialize only the members written by the original. */
export function createEquipment(world: Scenario, type: number, x: number, y: number, tick: number): EquipmentRecord | undefined {
  if (!Number.isInteger(type) || type < 0 || type > 8) throw new Error('Unsupported equipment type');
  if (![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) throw new Error('Equipment coordinate outside map');
  const e = world.equipment.find(e => e.slot && !e.active);
  if (!e) return undefined;
  const b = e.bytes, view = new Binary(b).view, def = world.equipmentDefinitions[type];
  view.setUint16(0, type, true);
  b[5] = b[50] = x; b[6] = b[51] = y;
  b[53] = def.width; b[54] = def.height;
  b[15] = b[52] = b[16] = b[17] = b[22] = b[48] = b[4] = b[42] = b[55] = 0;
  b[49] = 1;
  for (const offset of [18, 20, 32, 34, 36, 44, 46]) view.setUint16(offset, 0, true);
  e.timestamp = tick; e.flags = F.active | F.drawn;
  return e;
}

/** 0x115d6..0x117b6. Owned machines first; automatic rentals cost half the saved purchase price.
 * Cash debit and rental-ledger increment are the 1500 branch of 0x1c88e. */
export function reserveEquipment(world: Scenario, type: number, x: number, y: number, tick: number): EquipmentRecord | undefined {
  const owned = reserveOwnedEquipment(world, type, x, y);
  if (owned || !world.farm.autoRent) return owned;
  const e = createEquipment(world, type, 0, 0, tick);
  if (!e) return undefined;
  const cost = world.equipmentDefinitions[type].price >>> 1;
  if (cost > world.farm.cash) { e.flags &= ~F.active; return undefined; }
  world.farm.cash -= cost;
  world.farm.rentalExpenses = (world.farm.rentalExpenses + cost) >>> 0;
  // The DOS debit routine returns the paid amount; zero-cost rentals are therefore removed too.
  if (cost === 0) { e.flags &= ~F.active; return undefined; }
  e.bytes[5] = e.bytes[50] = world.farm.townRegionX * 8 + 1;
  e.bytes[6] = e.bytes[51] = world.farm.townRegionY * 8 + 5;
  e.flags |= F.rented | F.reserved;
  return e;
}
