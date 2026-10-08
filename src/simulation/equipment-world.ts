import { EQUIPMENT_FLAGS as F, type EquipmentRecord } from '../formats/equipment';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type Scenario, type WorldCell } from '../formats/scenario';
import { planEquipmentStep, positionEquipmentAttachments } from './equipment';

export type EquipmentWorld = Pick<Scenario, 'equipment' | 'equipmentDefinitions' | 'cells' | 'animals'>;
export interface EquipmentRuntime {
  /** Original global 6190:2284, shared by all moving machines. */
  grassTravelCount: number;
  /** Animation clock 6190:13a0, used for livestock collision aftermath. */
  animationTick: number;
  notices: ({ type: 'grass-wear' | 'forced-arrival' | 'parking-unavailable'; slot: number } | { type: 'animal-hit'; slot: number })[];
}
const s8 = (n: number) => n << 24 >> 24;
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < 96 && y < 96;
// Initialized tile-base table 6190:085e, indexed by definition +0 (not by equipment type).
export const EQUIPMENT_GRAPHICS: Readonly<Record<number, number>> = { 40: 848, 42: 852, 44: 856, 50: 868, 52: 860, 54: 876, 71: 892, 72: 896, 82: 1028 };

export function equipmentChain(head: EquipmentRecord, world: EquipmentWorld): EquipmentRecord[] {
  const result = [head], visited = new Set([head.slot]);
  while (result.at(-1)!.attachment) {
    const next = world.equipment[result.at(-1)!.attachment];
    if (!next?.active || visited.has(next.slot)) throw new Error('Invalid equipment attachment chain');
    visited.add(next.slot); result.push(next);
  }
  return result;
}

export function equipmentImage(e: EquipmentRecord, world: EquipmentWorld, direction = e.direction, frame = e.bytes[42]): number {
  const def = world.equipmentDefinitions[e.type], base = EQUIPMENT_GRAPHICS[def.graphic];
  if (base === undefined) throw new Error('Unsupported equipment graphic');
  return base + s8(def.width) * s8(def.height) * (s8(def.bytes[10]) * (direction >> 1) + s8(frame));
}

/** 0x10d9c: definition dimensions, swapped only for directions 2 and 6. */
export function equipmentFootprint(e: EquipmentRecord, world: EquipmentWorld): { width: number; height: number } {
  const def = world.equipmentDefinitions[e.type];
  const width = s8(def.width), height = s8(def.height);
  return e.direction === 2 || e.direction === 6 ? { width: height, height: width } : { width, height };
}

function eachCell(e: EquipmentRecord, world: EquipmentWorld, visit: (cell: WorldCell, part: number) => void): void {
  const { width, height } = equipmentFootprint(e, world);
  for (let dx = 0; dx < width; dx++) for (let dy = 0; dy < height; dy++) {
    const x = e.x + dx, y = e.y + dy;
    // Native guard for byte-wrapped attachment positions; never alias adjacent map rows or memory.
    if (inMap(x, y)) visit(world.cells[worldIndex(x, y)], dx * height + dy);
  }
}

/** 0x104c2/0x1050c. Erase only the overlay; keep terrain and both words' other flags. */
export function eraseEquipment(head: EquipmentRecord, world: EquipmentWorld): void {
  if (!head.active || !(head.flags & F.drawn)) return;
  for (const e of equipmentChain(head, world)) {
    eachCell(e, world, cell => { cell.terrain &= ~0x0800; cell.overlay &= 0xf800; });
    e.flags &= ~F.drawn;
  }
}

/** 0x102aa/0x10300, without the DOS viewport blit. The native renderer consumes the changed cells. */
export function drawEquipment(head: EquipmentRecord, world: EquipmentWorld): void {
  if (!head.active || !(head.flags & F.drawn)) return;
  for (const e of equipmentChain(head, world)) {
    const first = equipmentImage(e, world);
    eachCell(e, world, (cell, part) => {
      cell.terrain |= 0x0800;
      cell.overlay = ((cell.overlay & 0xf800) | ((first + part) & 0xffff)) & 0xffff;
    });
  }
}

/** 0x133c0–0x13599: collision aftermath selected by the animal's current overlay image. */
function hitAnimal(x: number, y: number, world: EquipmentWorld, runtime: EquipmentRuntime): void {
  const animal = world.animals.find(a => a.slot && a.active && a.x === x && a.y === y);
  if (!animal || (animal.flags & 8)) return;
  const cell = world.cells[worldIndex(x, y)], image = cell.overlay & 0x7ff;
  let aftermath = 1038;
  if (image >= 962 && image < 978) aftermath = 1039;
  else if (image >= 978 && image < 994) aftermath = 1040;
  else if (image >= 994 && image < 1010) aftermath = 1041;
  cell.overlay = (cell.overlay & 0xf800) | aftermath;
  animal.flags = (animal.flags | 8) & ~2;
  animal.deathTick = runtime.animationTick;
  // Original sound calls are represented as an event until non-MIDI effects playback is ported.
  runtime.notices.push({ type: 'animal-hit', slot: animal.slot });
}

/** 0x106d8/0x1070a. This is a visibility/occupancy test, not a movement veto.
 * It also applies the original animal-hit side effect when an occupied tile contains live livestock. */
export function equipmentObstructed(head: EquipmentRecord, world: EquipmentWorld, runtime: EquipmentRuntime): boolean {
  for (const e of equipmentChain(head, world)) {
    const { width, height } = equipmentFootprint(e, world);
    for (let dx = 0; dx < width; dx++) for (let dy = 0; dy < height; dy++) {
      const x = e.x + dx, y = e.y + dy;
      if (!inMap(x, y)) return true;
      const cell = world.cells[worldIndex(x, y)];
      if (cell.terrain & 0x0800) { hitAnimal(x, y, world, runtime); return true; }
      const tile = terrainTile(cell);
      if ((tile >= 150 && tile < 172) || (tile >= 15 && tile < 31) ||
        (cell.overlay & 0x1000) || (tile >= 172 && tile < 174)) continue;
      return true;
    }
  }
  return false;
}

/** 0x119b6/0x119e4 only change the head and its first attachment's drawn flags. */
export function refreshEquipment(head: EquipmentRecord, world: EquipmentWorld, runtime: EquipmentRuntime): void {
  const blocked = equipmentObstructed(head, world, runtime);
  for (const e of equipmentChain(head, world).slice(0, 2)) e.flags = blocked ? e.flags & ~F.drawn : e.flags | F.drawn;
  if (!blocked) drawEquipment(head, world);
}

/** 0x11972: base wear plus one quarter of the saved word at +18, saturating at 255. */
export function wearEquipment(e: EquipmentRecord, amount: number): void {
  const age = e.bytes[18] | e.bytes[19] << 8;
  e.bytes[17] = Math.min(255, (age >> 2) + (amount & 255) + e.condition);
}

/** Complete position/occupancy/wear update 0xffe8–0x102a9. False means arrived/inactive.
 * Caller 0x14a12 owns timer gating, clearing the moving flag, and arrival/storage dispatch. */
export function moveEquipment(e: EquipmentRecord, world: EquipmentWorld, runtime: EquipmentRuntime): boolean {
  if (!e.active) return false;
  eraseEquipment(e, world);
  const step = planEquipmentStep(e, world.cells);
  // 0xfc14 changes current position before history is shifted in its all-blocked fallback.
  if (step.teleported) { e.bytes[5] = step.x; e.bytes[6] = step.y; }
  e.bytes.copyWithin(11, 9, 13); e.bytes[9] = e.x; e.bytes[10] = e.y;
  e.bytes[5] = step.x; e.bytes[6] = step.y; e.bytes[15] = step.direction;
  const tile = terrainTile(world.cells[worldIndex(e.x, e.y)]);
  if (tile >= 15 && tile < 31) {
    runtime.grassTravelCount = (runtime.grassTravelCount + 1) & 0xffff;
    if ((runtime.grassTravelCount << 16 >> 16) > 10) {
      runtime.grassTravelCount = 0;
      runtime.notices.push({ type: 'grass-wear', slot: e.slot });
      if (e.type !== 6) wearEquipment(e, 2);
      if (e.attachment) wearEquipment(world.equipment[e.attachment], 2);
    }
  }
  positionEquipmentAttachments(e, world.equipment, world.equipmentDefinitions);
  refreshEquipment(e, world, runtime);
  if (e.x === e.targetX && e.y === e.targetY) { e.bytes[55] = 0; return false; }
  e.bytes[55]++;
  if (s8(e.bytes[55]) >= 64) {
    eraseEquipment(e, world);
    e.bytes[5] = e.targetX; e.bytes[6] = e.targetY;
    positionEquipmentAttachments(e, world.equipment, world.equipmentDefinitions);
    e.bytes[55] = 0;
    if (e.type !== 6) wearEquipment(e, 10);
    runtime.notices.push({ type: 'forced-arrival', slot: e.slot });
    refreshEquipment(e, world, runtime);
    return false;
  }
  return true;
}

/** 0x108ce–0x10b22: serpentine field pass, including its extra border positions.
 * Returns true when the pass finishes. Negative tile means do not paint terrain. */
export function traverseEquipmentField(e: EquipmentRecord, field: FieldRecord, tile: number, world: EquipmentWorld, runtime: EquipmentRuntime): boolean {
  if (!e.active || e.fieldSlot !== field.slot || !field.active) throw new Error('Invalid equipment field assignment');
  eraseEquipment(e, world);
  const cell = inMap(e.x, e.y) ? world.cells[worldIndex(e.x, e.y)] : undefined;
  const current = cell ? terrainTile(cell) : -1;
  if (cell && tile >= 0 && !(current >= 539 && current < 666) && (cell.overlay & 0x1000)) {
    cell.terrain = ((cell.terrain & 0xf800) | tile) & 0xffff;
  }
  const left = s8(field.x), right = s8(field.x + field.width), bottom = s8(field.y + field.height);
  let stride = s8(e.bytes[49]), x = s8(e.x + stride), y = s8(e.y);
  if (x >= right + 1) {
    stride = -1; e.bytes[15] = 6;
    positionEquipmentAttachments(e, world.equipment, world.equipmentDefinitions);
    x = s8(right - 1); y = s8(y + 1);
  }
  if (x < left - 1) {
    stride = 1; e.bytes[15] = 2;
    positionEquipmentAttachments(e, world.equipment, world.equipmentDefinitions);
    x = left; y = s8(y + 1);
  }
  if (y >= bottom - (s8(e.bytes[53]) >> 1)) {
    refreshEquipment(e, world, runtime); return true;
  }
  const dx = x - e.x, dy = y - e.y;
  for (const child of equipmentChain(e, world).slice(1)) {
    child.bytes[5] += dx; child.bytes[6] += dy; child.bytes[49] = stride;
  }
  e.bytes[5] = x; e.bytes[6] = y; e.bytes[49] = stride;
  refreshEquipment(e, world, runtime);
  return false;
}
