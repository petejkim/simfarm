import { Binary } from '../formats/binary';
import type { BuildingRecord } from '../formats/building';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { findBuilding, reserveOwnedEquipment } from './building-storage';
import { attachEquipment, positionEquipmentAttachments, setEquipmentDestination } from './equipment';
import type { EquipmentAllocator } from './equipment-dispatch';
import { eraseEquipment, traverseEquipmentField, type EquipmentRuntime } from './equipment-world';
import { updateFieldStatus } from './field-status';

function roadEntry(world: Scenario, x: number, y: number, farX: number, farY: number, limitX: number, limitY: number): { x: number; y: number } | undefined {
  const check = (px: number, py: number) => {
    const cx = Math.max(0, Math.min(95, px)), cy = Math.max(0, Math.min(95, py));
    const tile = terrainTile(world.cells[worldIndex(cx, cy)]);
    return tile >= 150 && tile < 172 ? { x: cx, y: cy } : undefined;
  };
  for (let px = x - 1; px < x + limitX; px++) {
    const found = check(px, y - 1) ?? check(px, y + farY);
    if (found) return found;
  }
  for (let py = y - 1; py < y + limitY; py++) {
    const found = check(x - 1, py) ?? check(x + farX, py);
    if (found) return found;
  }
  return undefined;
}

/** 0x19c62..0x19f4a uses a fixed eight-cell field, clamps probes, and falls back to its origin. */
export function findFieldEntry(field: FieldRecord, world: Scenario): { x: number; y: number } {
  return roadEntry(world, field.x, field.y, 8, 8, 9, 9) ?? { x: field.x, y: field.y };
}

/** 0x1b476..0x1b76f probes one cell beyond the building's far edge, then falls back west. */
export function findBuildingEntry(building: BuildingRecord, world: Scenario): { x: number; y: number } {
  const def = world.buildingDefinitions[building.type - 64];
  return roadEntry(world, building.x, building.y, def.width + 1, def.height + 1, def.width + 1, def.height + 1) ?? { x: building.x - 1, y: building.y };
}

/** Planting FSM 0x17d74..0x1843b, plus shared steps 0/1 at 0x18ae8/0x185c8.
 * Orders must already have passed the seed/contract handler. False requests the original early
 * return from the whole field dispatcher when the tractor's work timer is not ready. */
export function updatePlantingField(field: FieldRecord, definition: readonly number[], world: Scenario,
  runtime: EquipmentRuntime, tick: number, allocate: EquipmentAllocator = reserveOwnedEquipment): boolean {
  if (!field.active || field.state !== 3) return true;
  const f = new Binary(field.bytes), b = field.bytes;
  if (field.step === 0) { b[3] = 1; return true; }
  if (field.step === 1) {
    const tractor = allocate(world, 0, field.x, field.y);
    if (!tractor) return true;
    tractor.flags |= 8; field.equipment = tractor.slot;
    tractor.bytes[48] = field.slot; tractor.bytes[15] = 2; tractor.bytes[49] = 1;
    tractor.timestamp = tick; b[3] = 2; return true;
  }
  const tractor = world.equipment[field.equipment];
  if (!tractor?.active) throw new Error('Planting field has no active tractor');
  const order = (x: number, y: number, flags: number) => {
    setEquipmentDestination(tractor, x, y, tick); tractor.flags |= flags;
  };
  const placeAtOrigin = () => {
    eraseEquipment(tractor, world);
    tractor.bytes[5] = field.x; tractor.bytes[6] = field.y; tractor.bytes[15] = 2;
    positionEquipmentAttachments(tractor, world.equipment, world.equipmentDefinitions);
    tractor.timestamp = tick;
  };
  switch (field.step) {
    case 2: case 7: {
      const secondPass = field.step === 7, implement = allocate(world, secondPass ? 2 : 1, field.x, field.y);
      if (!implement) return true;
      field.pendingEquipment = implement.slot; implement.flags |= 8;
      order(implement.x - Number(secondPass), implement.y, 0x1000);
      b[3] = secondPass ? 8 : 3;
      break;
    }
    case 3: case 8: {
      if (tractor.flags & 2) break;
      const secondPass = field.step === 8, implement = world.equipment[field.pendingEquipment];
      if (!implement?.active) throw new Error('Planting implement is missing');
      field.pendingEquipment = 0;
      eraseEquipment(implement, world); eraseEquipment(tractor, world);
      attachEquipment(tractor, implement, world.equipmentDefinitions);
      if (!secondPass) { const entry = findFieldEntry(field, world); order(entry.x, entry.y, 0x1000); }
      b[3] = secondPass ? 9 : 4; tractor.timestamp = tick;
      break;
    }
    case 4:
      if (tractor.flags & 2) break;
      placeAtOrigin(); b[3] = 5; break;
    case 5: {
      if (((tick - tractor.timestamp) & 0xffff) < 1) return false;
      const implement = world.equipment[tractor.attachment];
      if (!implement?.active) throw new Error('Planting implement is missing');
      if (traverseEquipmentField(tractor, field, 12, world, runtime)) {
        const building = findBuilding(world, implement.bytes[50], implement.bytes[51]);
        const entry = building ? findBuildingEntry(building, world) : { x: implement.bytes[50] - 1, y: implement.bytes[51] };
        order(entry.x, entry.y, 0x0400); b[6] |= 2; b[3] = 6;
      }
      tractor.timestamp = tick; break;
    }
    case 6:
      if (!(tractor.flags & 2)) b[3] = 7;
      break;
    case 9: {
      if (tractor.flags & 2) break;
      const entry = findFieldEntry(field, world); order(entry.x, entry.y, 0x1000); b[3] = 10; break;
    }
    case 10:
      if (tractor.flags & 2) break;
      tractor.bytes[48] = field.slot; tractor.bytes[15] = 2; tractor.bytes[49] = 1;
      placeAtOrigin(); b[3] = 11; break;
    case 11: {
      if (((tick - tractor.timestamp) & 0xffff) < 1) return false;
      if (definition.length !== 128) throw new Error('Invalid planting crop definition');
      const implement = world.equipment[tractor.attachment];
      if (!implement?.active) throw new Error('Planting implement is missing');
      if (traverseEquipmentField(tractor, field, 688 + field.cropSlot * 8, world, runtime)) {
        b[34] = 0; f.view.setUint16(38, 0, true); f.view.setUint16(40, 0, true);
        order(implement.bytes[50] - 1, implement.bytes[51], 0x0100);
        b[6] = (b[6] | 4) & ~2;
        field.equipment = 0; b[3] = 0; b[2] = 4;
        f.view.setUint16(36, definition[30] | definition[31] << 8, true);
        f.view.setUint16(18, 0, true); b[33] = (world.farm.calendar.week + 1) & 3;
        updateFieldStatus(field, definition, world.cells);
      }
      // Original reloads field +42 after clearing it, so completion writes slot zero's timestamp.
      world.equipment[field.equipment].timestamp = tick;
      break;
    }
  }
  return true;
}
