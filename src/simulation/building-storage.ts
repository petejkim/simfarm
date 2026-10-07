import type { BuildingRecord } from '../formats/building';
import { EQUIPMENT_FLAGS as F, type EquipmentRecord } from '../formats/equipment';
import { worldIndex, type Scenario } from '../formats/scenario';
import { findAvailableEquipment } from './equipment';
import { equipmentFootprint } from './equipment-world';

type BuildingWorld = Pick<Scenario, 'buildings' | 'buildingDefinitions' | 'cells'>;
// Initialized tile table selected by definition +0; roof tile order is row-major.
const graphics: Readonly<Record<number, number>> = { 6: 440, 7: 441, 8: 445, 9: 451, 10: 460, 11: 469, 61: 120, 104: 1010, 103: 481 };

/** 0x1a17e: first active building overlapping any cell of the requested rectangle. */
export function findBuilding(world: BuildingWorld, x: number, y: number, width = 1, height = 1): BuildingRecord | undefined {
  if (width <= 0 || height <= 0) return undefined;
  return world.buildings.find(b => {
    if (!b.slot || !b.active) return false;
    const def = world.buildingDefinitions[b.type - 64];
    return x < b.x + def.width && y < b.y + def.height && x + width > b.x && y + height > b.y;
  });
}

/** 0x1a2f8–0x1a591. Changes actual world cells; no DOM or DOS viewport dependency. */
export function toggleBuildingInterior(b: BuildingRecord, world: BuildingWorld): void {
  if (!b.active || b.type === 70 || b.type === 71) return;
  const def = world.buildingDefinitions[b.type - 64], base = graphics[def.graphic];
  if (base === undefined) throw new Error('Unsupported building graphic');
  b.flags ^= 1;
  if (b.flags & 1) {
    for (let dx = 0; dx < def.width; dx++) for (let dy = 0; dy < def.height; dy++) {
      const cell = world.cells[worldIndex(b.x + dx, b.y + dy)];
      if (b.type === 72) {
        cell.terrain = ((b.bytes[10] | b.bytes[11] << 8) >> 6) + 83;
        continue;
      }
      const item = b.content(dx * 3 + dy);
      cell.terrain = 217;
      if (item.type === -1 || item.type === -2) continue;
      if (item.graphic >= 848) { cell.terrain = 0x08d9; cell.overlay = (cell.overlay & 0xf800) | item.graphic; }
      else cell.terrain = item.graphic;
    }
  } else if (b.type === 72) {
    const cell = world.cells[worldIndex(b.x, b.y)];
    cell.terrain = (cell.terrain & 0xf800) | (b.bytes[6] >= 100 ? 149 : base);
  } else {
    for (let dy = 0; dy < def.height; dy++) for (let dx = 0; dx < def.width; dx++) {
      world.cells[worldIndex(b.x + dx, b.y + dy)].terrain = base + dy * def.width + dx;
    }
  }
}

/** Equipment branch of storage removal 0x1aeb0, used by allocator 0x116af.
 * Other stored item types use a separate dimensions dispatcher and are not handled here. */
export function withdrawStoredEquipment(e: EquipmentRecord, world: Scenario): void {
  const b = findBuilding(world, e.x, e.y);
  if (!b) throw new Error('Stored equipment has no building');
  const dx = e.x - b.x, dy = e.y - b.y, item = b.content(dx * 3 + dy);
  if (item.type < 0 || item.type > 63 || item.slot !== e.slot) throw new Error('Stored equipment does not match building contents');
  const { width, height } = equipmentFootprint(e, world);
  const def = world.buildingDefinitions[b.type - 64];
  if (dx + width > def.width || dy + height > def.height) throw new Error('Stored equipment extends outside building');
  for (let x = dx; x < dx + width; x++) for (let y = dy; y < dy + height; y++) b.clearContent(x * 3 + y);
  // The original toggles twice to refresh the interior while retaining its open/closed state.
  toggleBuildingInterior(b, world); toggleBuildingInterior(b, world);
  e.flags &= ~F.stored;
}

/** Owned branch of 0x115d6–0x116fa. Automatic rental remains a separate economy operation. */
export function reserveOwnedEquipment(world: Scenario, type: number, x: number, y: number): EquipmentRecord | undefined {
  const e = findAvailableEquipment(world.equipment, type, x, y);
  if (!e) return undefined;
  // Validate/withdraw before reserving, so malformed native state does not leave a phantom reservation.
  if (e.flags & F.stored) withdrawStoredEquipment(e, world);
  e.flags |= F.reserved;
  return e;
}
