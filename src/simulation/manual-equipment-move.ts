import { EQUIPMENT_FLAGS as F, type EquipmentRecord } from '../formats/equipment';
import { worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, toggleBuildingInterior, withdrawStoredEquipment } from './building-storage';
import { setEquipmentDestination } from './equipment';
import { equipmentChain, equipmentFootprint } from './equipment-world';

export interface EquipmentMoveTarget {
  slot: number; type: number; x: number; y: number; width: number; height: number; buildingSlot: number | null;
}
export type EquipmentMoveResult = ({ ok: true } & EquipmentMoveTarget) | { ok: false; reason:
  'outside-map' | 'no-equipment' | 'equipment-busy' | 'building-closed' | 'use-aircraft-controls'
  | 'inconsistent-equipment' | 'target-changed' | 'not-owned' };
const inMap = (x: number, y: number) => [x, y].every(n => Number.isInteger(n) && n >= 0 && n < 96);

/** Point lookup0xf7fe: first active footprint, including rotated machines.
 * Native traversal is bounded by records, not the source's potentially stale active count. */
export function findEquipmentAt(world: Scenario, x: number, y: number): EquipmentRecord | undefined {
  if (!inMap(x, y)) return undefined;
  return world.equipment.find(e => {
    if (!e.slot || !e.active) return false;
    const { width, height } = equipmentFootprint(e, world);
    return x >= e.x && x < e.x + width && y >= e.y && y < e.y + height;
  });
}

/** Equipment pickup0x136ee..0x13772. Reading a selection never withdraws it. */
export function checkEquipmentPickup(world: Scenario, x: number, y: number): EquipmentMoveResult {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  const e = findEquipmentAt(world, x, y);
  if (!e) return { ok: false, reason: 'no-equipment' };
  if (e.flags & 3) return { ok: false, reason: 'equipment-busy' };
  // SF-114: the original accepts aircraft here but dispatcher0x14c38 cannot move them.
  if (e.type === 8) return { ok: false, reason: 'use-aircraft-controls' };
  const b = findBuilding(world, x, y), { width, height } = equipmentFootprint(e, world);
  if (b && !(b.flags & 1)) return { ok: false, reason: 'building-closed' };
  if (!inMap(e.x, e.y) || !inMap(e.x + width - 1, e.y + height - 1))
    return { ok: false, reason: 'inconsistent-equipment' };
  try { equipmentChain(e, world); }
  catch { return { ok: false, reason: 'inconsistent-equipment' }; }
  // Native preflight: source withdrawal trusts the content slot and can clear another item (SF-011).
  if (b) {
    const def = world.buildingDefinitions[b.type - 64], dx = e.x - b.x, dy = e.y - b.y;
    if (dx < 0 || dy < 0 || dx + width > def.width || dy + height > def.height)
      return { ok: false, reason: 'inconsistent-equipment' };
    for (let cx = dx; cx < dx + width; cx++) for (let cy = dy; cy < dy + height; cy++) {
      const item = b.content(cx * 3 + cy);
      if (item.type !== e.type || item.slot !== e.slot) return { ok: false, reason: 'inconsistent-equipment' };
    }
  } else if (e.flags & F.stored) return { ok: false, reason: 'inconsistent-equipment' };
  return { ok: true, slot: e.slot, type: e.type, x: e.x, y: e.y, width, height, buildingSlot: b?.slot ?? null };
}

/** Drop0x13c0c..0x13d6c checks ownership and busy flags, then issues a movement order.
 * Destination obstruction, first-fit storage and towing belong to the original dispatcher. */
export function checkEquipmentMove(world: Scenario, selected: EquipmentMoveTarget, x: number, y: number): EquipmentMoveResult {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  if (!(world.cells[worldIndex(x, y)].overlay & 0x800)) return { ok: false, reason: 'not-owned' };
  const result = checkEquipmentPickup(world, selected.x, selected.y);
  if (!result.ok) return result;
  if (result.slot !== selected.slot || result.type !== selected.type || result.x !== selected.x || result.y !== selected.y ||
    result.width !== selected.width || result.height !== selected.height || result.buildingSlot !== selected.buildingSlot)
    return { ok: false, reason: 'target-changed' };
  return result;
}

export function moveManualEquipment(world: Scenario, selected: EquipmentMoveTarget, x: number, y: number, tick: number): EquipmentMoveResult {
  const result = checkEquipmentMove(world, selected, x, y);
  if (!result.ok) return result;
  if (!Number.isInteger(tick) || tick < 0 || tick > 65535) throw new Error('Invalid equipment movement clock');
  const e = world.equipment[result.slot];
  if (result.buildingSlot !== null) {
    withdrawStoredEquipment(e, world);
    const b = world.buildings[result.buildingSlot];
    // Caller0x13d1d/0x13d37 repeats the withdrawal helper's own refresh.
    toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
  }
  setEquipmentDestination(e, x, y, tick); // DS139e timer clock, not animation clock DS13a0.
  e.flags |= 0x0800;
  return result;
}

export type BuildingInteriorResult = { ok: true; slot: number; open: boolean }
  | { ok: false; reason: 'outside-map' | 'no-building' | 'no-interior' | 'target-changed' };
/** Map caller0x20e22..0x20e65 ->0x1a2f8. No ownership or cash gate in this action. */
export function toggleManualBuildingInterior(world: Scenario, x: number, y: number, expectedSlot: number): BuildingInteriorResult {
  if (!inMap(x, y)) return { ok: false, reason: 'outside-map' };
  const b = findBuilding(world, x, y);
  if (!b) return { ok: false, reason: 'no-building' };
  if (b.slot !== expectedSlot) return { ok: false, reason: 'target-changed' };
  if (b.type === 70 || b.type === 71) return { ok: false, reason: 'no-interior' };
  toggleBuildingInterior(b, world);
  return { ok: true, slot: b.slot, open: Boolean(b.flags & 1) };
}
