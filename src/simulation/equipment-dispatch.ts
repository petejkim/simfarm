import { EQUIPMENT_FLAGS as F, type EquipmentRecord } from '../formats/equipment';
import type { Scenario } from '../formats/scenario';
import { findBuilding, reserveOwnedEquipment, storeEquipment, toggleBuildingInterior } from './building-storage';
import { attachEquipment, setEquipmentDestination } from './equipment';
import { drawEquipment, equipmentChain, equipmentObstructed, eraseEquipment, moveEquipment, type EquipmentRuntime } from './equipment-world';

export type EquipmentAllocator = (world: Scenario, type: number, x: number, y: number) => EquipmentRecord | undefined;

/** 0xfa66. The native active count is derived from records; rented planes need their separate overlay cleanup. */
export function releaseEquipment(e: EquipmentRecord, world: Scenario): void {
  if (!e.active) return;
  const members = equipmentChain(e, world);
  if (members.some(m => m.type === 8 && (m.flags & F.rented))) throw new Error('Rented plane cleanup is not yet implemented');
  for (const member of members) {
    const def = world.equipmentDefinitions[member.type];
    member.flags &= ~(F.reserved | F.fieldWork);
    member.bytes[53] = def.width; member.bytes[54] = def.height; member.bytes[48] = 0;
    if (member.flags & F.rented) member.flags &= ~F.active;
  }
}

/** 0x112a0, with SF-010 fixed: clear both links on every member, not only the first two. */
export function detachEquipment(e: EquipmentRecord, world: Scenario): void {
  if (!e.active) return;
  for (const member of equipmentChain(e, world)) { member.parent = 0; member.attachment = 0; }
}

/** 0x15196. Temporary candidate coordinates are restored, but collision side effects remain. */
function canPark(e: EquipmentRecord, world: Scenario, runtime: EquipmentRuntime, x: number, y: number, direction: number): boolean {
  if (x < 0 || y < 0 || x >= 96 || y >= 96) return false;
  const original = [e.x, e.y, e.direction];
  e.bytes[5] = x; e.bytes[6] = y; e.bytes[15] = direction;
  try { return !equipmentObstructed(e, world, runtime); }
  finally { [e.bytes[5], e.bytes[6], e.bytes[15]] = original; }
}

/** 0x14e96. Try a shed at the current location; otherwise retain a drawable position or search rings. */
export function parkEquipment(e: EquipmentRecord, world: Scenario, runtime: EquipmentRuntime): boolean {
  eraseEquipment(e, world);
  const store = (x: number, y: number): boolean => {
    const b = findBuilding(world, x, y);
    if (!b || !storeEquipment(b, e, world)) return false;
    // The caller repeats the storage routine's refresh in the original.
    toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
    return true;
  };
  if (store(e.x, e.y)) return true;
  if (!equipmentObstructed(e, world, runtime)) { e.flags |= F.drawn; drawEquipment(e, world); return true; }
  const originX = e.x, originY = e.y;
  // SF-012: bound the original unbounded byte-counter loop to the complete native map.
  for (let radius = 1; radius <= 96; radius++) {
    const left = originX - radius, top = originY - radius, right = originX + radius + 1, bottom = originY + radius + 1;
    const candidates: [number, number, number][] = [];
    for (let x = left; x < right; x++) candidates.push([x, top, 0], [x, bottom, 0], [x, top, 2], [x, bottom, 2]);
    for (let y = top + 1; y < bottom; y++) candidates.push([left, y, 0], [right, y, 0], [left, y, 2], [right, y, 2]);
    for (const [x, y, direction] of candidates) if (canPark(e, world, runtime, x, y, direction)) {
      if (findBuilding(world, x, y)) return store(x, y);
      e.bytes[5] = x; e.bytes[6] = y; e.bytes[15] = direction;
      e.flags |= F.drawn; drawEquipment(e, world); return true;
    }
  }
  runtime.notices.push({ type: 'parking-unavailable', slot: e.slot });
  return false;
}

function restoreHome(e: EquipmentRecord): void { e.bytes[5] = e.bytes[50]; e.bytes[6] = e.bytes[51]; e.bytes[15] = e.bytes[52]; }

/** Arrival handlers 0x14c72, 0x14d04, 0x14dc0, 0x14e1e and 0x14e60, in dispatcher priority order. */
export function arriveEquipment(e: EquipmentRecord, world: Scenario, runtime: EquipmentRuntime, tick: number): void {
  if (e.flags & 0x0500) {
    const returningHome = !(e.flags & 0x0400), child = world.equipment[e.attachment];
    if (!child?.slot || !child.active) throw new Error('Equipment return has no active attachment');
    detachEquipment(e, world);
    eraseEquipment(child, world); eraseEquipment(e, world);
    restoreHome(child); child.flags &= returningHome ? ~3 : ~1;
    if (!(child.flags & F.rented)) parkEquipment(child, world, runtime);
    releaseEquipment(child, world);
    e.flags &= returningHome ? ~0x0100 : ~0x0400;
    if (returningHome) { setEquipmentDestination(e, e.bytes[50], e.bytes[51], tick); e.flags |= 0x0200; }
  } else if (e.flags & 0x0200) {
    eraseEquipment(e, world); restoreHome(e); e.flags &= ~0x0200;
    if (!(e.flags & F.rented)) parkEquipment(e, world, runtime);
    releaseEquipment(e, world);
  } else if (e.flags & 0x1000) {
    e.flags &= ~0x1000;
    if (!(e.flags & F.fieldWork)) { e.flags &= ~F.reserved; parkEquipment(e, world, runtime); }
  } else {
    e.flags &= 0xf7fe;
    e.bytes[50] = e.x; e.bytes[51] = e.y; e.bytes[52] = e.direction;
    parkEquipment(e, world, runtime);
  }
}

/** Equipment dispatcher 0x14a12. Allocator injection keeps auto-rental policy in the economy layer.
 * Default supports the recovered owned-machine branch; paid rental is still outstanding. */
export function updateEquipment(world: Scenario, runtime: EquipmentRuntime, tick: number,
  paced = true, allocate: EquipmentAllocator = reserveOwnedEquipment): void {
  for (const e of world.equipment) {
    if (!e.slot || !e.active) continue;
    if ([0, 4, 6, 7].includes(e.type)) {
      if (paced && ((tick - e.timestamp) & 0xffff) <= world.farm.speed) continue;
      if ((e.flags & F.moving) && !moveEquipment(e, world, runtime)) {
        e.flags &= ~F.moving; arriveEquipment(e, world, runtime, tick);
      }
      e.timestamp = tick;
    } else if ([1, 2, 3, 5].includes(e.type)) {
      if (e.bytes[4] === 1) {
        const tractor = allocate(world, 0, e.x, e.y);
        if (!tractor) return; // Original returns from the whole dispatcher when no tractor is available.
        tractor.flags |= F.fieldWork; e.parent = tractor.slot;
        setEquipmentDestination(tractor, e.x - 1, e.y, tick); tractor.flags |= 0x1000; e.bytes[4] = 2;
      } else if (e.bytes[4] === 2) {
        const tractor = world.equipment[e.parent];
        if (!tractor?.active) throw new Error('Trailer relocation has no active tractor');
        if (tractor.flags & F.moving) continue;
        eraseEquipment(e, world); eraseEquipment(tractor, world);
        attachEquipment(tractor, e, world.equipmentDefinitions);
        setEquipmentDestination(tractor, e.targetX, e.targetY - 1, tick);
        e.bytes[50] = e.targetX; e.bytes[51] = e.targetY;
        tractor.flags |= 0x0100; e.bytes[4] = 0;
      }
    }
  }
}
