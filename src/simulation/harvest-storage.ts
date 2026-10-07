import { Binary } from '../formats/binary';
import type { InventoryRecord } from '../formats/inventory';
import type { Scenario } from '../formats/scenario';
import { toggleBuildingInterior } from './building-storage';
import { equipmentDistance } from './equipment';

export interface HarvestReservation { buildingSlot: number; x: number; y: number }

function storageCells(world: Scenario, slot: number): number[] {
  const b = world.buildings[slot];
  if (!b?.slot || !b.active || (b.type !== 64 && b.type !== 65)) return [];
  const def = world.buildingDefinitions[b.type - 64];
  return Array.from({ length: def.width }, (_, x) => Array.from({ length: def.height }, (_, y) => x * 3 + y)).flat();
}

/** 0x1aff0: nearest crop-storage building with a free cell; slot order breaks ties.
 * Reserve its first free column-major cell with type -2, preserving its other members. */
export function reserveHarvestStorage(world: Scenario, x: number, y: number): HarvestReservation | undefined {
  let best: HarvestReservation | undefined, distance = 1_000_000;
  for (const b of world.buildings) {
    const free = storageCells(world, b.slot).find(i => b.content(i).type === -1);
    if (free === undefined) continue;
    const candidate = equipmentDistance(x, y, b.x, b.y);
    if (candidate >= distance) continue;
    distance = candidate; best = { buildingSlot: b.slot, x: Math.floor(free / 3), y: free % 3 };
  }
  if (best) new Binary(world.buildings[best.buildingSlot].bytes).view.setInt16(34 + (best.x * 3 + best.y) * 2, -2, true);
  return best;
}

/** Native failure cleanup (SF-022). Only release a cell that is still reserved. */
export function releaseHarvestReservation(world: Scenario, reservation: HarvestReservation): void {
  const b = world.buildings[reservation.buildingSlot], index = reservation.x * 3 + reservation.y;
  if (storageCells(world, reservation.buildingSlot).includes(index) && b.content(index).type === -2) b.clearContent(index);
}

/** Match delivery's first-reserved-cell ordering even when two trucks arrive out of order. */
export function releaseFirstHarvestReservation(world: Scenario, buildingSlot: number): void {
  const b = world.buildings[buildingSlot];
  const index = storageCells(world, buildingSlot).find(i => b.content(i).type === -2);
  if (index !== undefined) b.clearContent(index);
}

/** Inventory constructor 0x15234. Counts/definition updates are caller responsibilities.
 * Unknown byte +11 survives reuse, as in the original. */
export function createInventoryItem(world: Scenario, type: number, quantity: number, loss: number, x: number, y: number): InventoryRecord | undefined {
  if (![type, quantity, loss].every(n => Number.isInteger(n) && n >= 0 && n <= 65535) ||
      ![x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96)) throw new Error('Invalid inventory item');
  const item = world.inventory.find(i => i.slot && !i.active);
  if (!item) return undefined;
  const v = new Binary(item.bytes).view;
  v.setUint16(0, type, true); v.setUint16(2, quantity, true); v.setUint16(4, loss, true); v.setUint16(6, 0, true);
  item.bytes[8] = x; item.bytes[9] = y; item.bytes[10] = 0x20;
  return item;
}

/** 0x15f9a..0x1602f -> 0x15234/0x1b278. Fill the first reserved cell, as in DOS.
 * SF-021: reject a slot that cannot fit the building's byte reference before mutation. */
export function deliverStoredHarvest(world: Scenario, buildingSlot: number, cropSlot: number, quantity: number, loss: number): InventoryRecord | undefined {
  if (!Number.isInteger(cropSlot) || cropSlot < 0 || cropSlot >= 16) throw new Error('Invalid harvest crop slot');
  const b = world.buildings[buildingSlot];
  const index = storageCells(world, buildingSlot).find(i => b.content(i).type === -2);
  const free = world.inventory.find(i => i.slot && !i.active);
  if (index === undefined || !free || free.slot > 255) return undefined;
  const def = world.harvestDefinitions[cropSlot];
  const item = createInventoryItem(world, def.type, quantity, loss, b.x + Math.floor(index / 3), b.y + index % 3)!;
  def.count++;
  // Tile-base table file 0x4f4be, entries 109..124, gives 816..831.
  b.setContent(index, 816 + cropSlot, def.type, item.slot);
  toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
  return item;
}
