import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import type { EquipmentRecord } from '../formats/equipment';
import { worldIndex, type Scenario } from '../formats/scenario';
import { reserveOwnedEquipment } from './building-storage';
import { attachEquipment, positionEquipmentAttachments, setEquipmentDestination } from './equipment';
import type { EquipmentAllocator } from './equipment-dispatch';
import { eraseEquipment, traverseEquipmentField, type EquipmentRuntime } from './equipment-world';
import { findBuildingEntry, findFieldEntry } from './field-planting';
import { creditHarvest, settleHarvestContract } from './harvest-income';
import { deliverStoredHarvest, releaseFirstHarvestReservation, reserveHarvestStorage } from './harvest-storage';
import { fieldHarvestValue, harvestLoss } from './harvest-value';
import type { FarmRandom } from './random';

export type HarvestOrderResult = { ok: true } | { ok: false; reason: 'invalid-field' | 'not-growing' | 'field-busy' };

/** Existing-field calendar harvest command, 0x2f776..0x2f7bc; native immediate adapter. */
export function orderHarvest(world: Scenario, slot: number, crops: readonly (readonly number[])[]): HarvestOrderResult {
  const f = world.fields[slot];
  if (!Number.isInteger(slot) || !slot || !f?.active) return { ok: false, reason: 'invalid-field' };
  if (f.state !== 4) return { ok: false, reason: 'not-growing' };
  if (f.equipment || f.pendingEquipment || new Binary(f.bytes).u16(46)) return { ok: false, reason: 'field-busy' };
  f.bytes[2] = 5; f.bytes[3] = crops[f.cropSlot][57] === 1 ? 10 : 0; f.bytes[7] |= 2;
  return { ok: true };
}

/** Harvest dispatcher 0x156be..0x16abc. Machinery steps 0..7, workers 10..16.
 * False reproduces a wait return from this routine; callers still visit the other fields. */
export function updateHarvestField(field: FieldRecord, crop: readonly number[], world: Scenario,
  runtime: EquipmentRuntime, tick: number, random: FarmRandom, allocate: EquipmentAllocator = reserveOwnedEquipment): boolean {
  if (!field.active || field.state !== 5) return true;
  const b = field.bytes, f = new Binary(b), c = new Binary(Uint8Array.from(crop));
  const machine = (slot: number) => {
    const e = world.equipment[slot];
    if (!slot || !e?.active) throw new Error('Harvest equipment is missing');
    return e;
  };
  const go = (e: EquipmentRecord, x: number, y: number, flags = 0x1000) => {
    setEquipmentDestination(e, x, y, tick); e.flags |= flags;
  };
  const returnTruck = (truck: EquipmentRecord, clearCargo: boolean) => {
    truck.bytes[42] = 0; truck.flags &= ~8;
    if (clearCargo) for (const offset of [32, 34, 38, 40]) new Binary(truck.bytes).view.setUint16(offset, 0, true);
    go(truck, truck.bytes[50], truck.bytes[51], 0x0200);
  };
  const finish = () => {
    b[3] = 0; field.pendingEquipment = 0;
    for (const offset of [18, 38, 40]) f.view.setUint16(offset, 0, true);
    b[33] = 0; b[34] = crop[62] & 1 ? crop[18] : 0; b[2] = crop[62] & 1 ? 4 : 0;
  };
  const sell = () => creditHarvest(world, fieldHarvestValue(field, crop, world.cropDefinitions[field.cropSlot].price));
  const loadTruck = (truck: EquipmentRecord, storageStep: number, saleStep: number, sellNow: boolean) => {
    const reservation = reserveHarvestStorage(world, truck.x, truck.y), t = new Binary(truck.bytes);
    f.view.setUint16(64, reservation?.buildingSlot ?? 0, true);
    b[66] = reservation?.x ?? 255; b[67] = reservation?.y ?? 255;
    t.view.setUint16(32, harvestLoss(field, crop), true);
    // Original copies the harvester's saved word +20, including slot zero in the worker branch.
    t.view.setUint16(20, new Binary(world.equipment[field.equipment].bytes).u16(20), true);
    truck.bytes[42] = 1;
    t.view.setUint16(34, 168 + field.cropSlot, true);
    t.view.setUint16(38, 0x713c + field.cropSlot * 18, true); t.view.setUint16(40, 0x6190, true);
    if (reservation) {
      const entry = findBuildingEntry(world.buildings[reservation.buildingSlot], world);
      go(truck, entry.x, entry.y); t.view.setUint16(44, reservation.buildingSlot, true); b[3] = storageStep;
    } else {
      if (sellNow) sell();
      go(truck, world.farm.townRegionX * 8, world.farm.townRegionY * 8); b[3] = saleStep;
    }
  };
  const unloadTruck = () => {
    const truck = machine(field.pendingEquipment);
    if (truck.flags & 2) return false;
    const t = new Binary(truck.bytes), slot = t.u16(34) - 168;
    if (slot < 0 || slot >= world.cropFiles.length || slot !== field.cropSlot) throw new Error('Invalid harvest truck cargo');
    const stored = deliverStoredHarvest(world, f.u16(64), slot, c.u16(32), t.u16(32));
    if (!stored) {
      sell();
      // SF-022: release the failed delivery's reservation instead of leaking it.
      releaseFirstHarvestReservation(world, f.u16(64));
    }
    f.view.setUint16(64, 0, true); returnTruck(truck, true); finish(); return true;
  };
  switch (field.step) {
    case 0: {
      const harvester = allocate(world, 4, field.x, field.y);
      if (!harvester) break;
      harvester.flags |= 8; harvester.bytes[48] = field.slot; harvester.timestamp = tick;
      field.equipment = harvester.slot; b[3] = 1; break;
    }
    case 1: {
      const header = allocate(world, 5, field.x, field.y);
      if (!header) break;
      f.view.setUint16(46, header.slot, true);
      go(machine(field.equipment), header.x - 1, header.y); b[3] = 2; break;
    }
    case 2: case 11: {
      const truck = allocate(world, 7, field.x, field.y);
      if (!truck) break;
      truck.flags |= 8; field.pendingEquipment = truck.slot;
      const entry = findFieldEntry(field, world); go(truck, entry.x, entry.y);
      b[3] = field.step === 2 ? 3 : 12; break;
    }
    case 3: {
      const harvester = machine(field.equipment);
      if (harvester.flags & 2) return false;
      const header = machine(f.u16(46)); f.view.setUint16(46, 0, true);
      eraseEquipment(header, world); eraseEquipment(harvester, world);
      attachEquipment(harvester, header, world.equipmentDefinitions);
      const entry = findFieldEntry(field, world); go(harvester, entry.x, entry.y);
      b[3] = 4; break;
    }
    case 4: {
      const harvester = machine(field.equipment), truck = machine(field.pendingEquipment);
      if ((harvester.flags | truck.flags) & 2) return false;
      eraseEquipment(harvester, world); harvester.bytes[15] = 2;
      positionEquipmentAttachments(harvester, world.equipment, world.equipmentDefinitions);
      harvester.bytes[5] = field.x; harvester.bytes[6] = field.y;
      positionEquipmentAttachments(harvester, world.equipment, world.equipmentDefinitions);
      harvester.timestamp = tick; b[3] = 5; break;
    }
    case 5: {
      const harvester = machine(field.equipment);
      if (((tick - harvester.timestamp) & 65535) < 1) return false;
      harvester.timestamp = tick;
      const header = machine(harvester.attachment), truck = machine(field.pendingEquipment);
      header.bytes[42] = 1;
      if (!traverseEquipmentField(harvester, field, crop[62] & 1 ? -1 : 36, world, runtime)) break;
      f.view.setUint16(64, 0, true); b[66] = b[67] = 255;
      if (f.u16(48)) {
        settleHarvestContract(world, field, crop); returnTruck(truck, false); finish();
      } else loadTruck(truck, 6, 7, true);
      header.bytes[42] = 0;
      go(harvester, header.bytes[50], header.bytes[51], 0x0100);
      field.equipment = 0; b[6] &= ~6; break;
    }
    case 6: case 15: return unloadTruck();
    case 7: case 16: {
      const truck = machine(field.pendingEquipment);
      if (truck.flags & 2) return false;
      if (field.step === 16) sell(); // Worker path sells on arrival; machinery path already credited in step 5.
      // SF-023: omit the DOS step-7 write through an uninitialized local header index.
      returnTruck(truck, false); f.view.setUint16(64, 0, true); finish(); break;
    }
    case 10: {
      const fee = f.u16(58);
      if (!fee || fee > world.farm.cash) break;
      world.farm.cash -= fee; world.farm.workerExpenses = (world.farm.workerExpenses + fee) >>> 0;
      b[3] = 11; break;
    }
    case 12: {
      if (machine(field.pendingEquipment).flags & 2) return false;
      b[3] = 13; b[50] = world.farm.calendar.day; f.view.setUint16(46, 0, true);
      for (let x = field.x; x < field.x + 8; x++) for (let y = field.y; y < field.y + 8; y++) {
        const draw = (random.nextVisual() & 7) < 6;
        if (x >= 96 || y >= 96) continue;
        const cell = world.cells[worldIndex(x, y)];
        if (!draw || cell.terrain & 0x0800) continue;
        cell.overlay = (cell.overlay & 0xf800) | (1036 + (random.nextVisual() & 1)); cell.terrain |= 0x0800;
      }
      break;
    }
    case 13:
      // Original day-of-week subtraction wraps on Sunday (SF-024).
      if (((world.farm.calendar.day - b[50]) & 65535) < 3) return false;
      for (let x = field.x; x < field.x + 8; x++) for (let y = field.y; y < field.y + 8; y++) {
        if (x >= 96 || y >= 96) continue;
        const cell = world.cells[worldIndex(x, y)];
        cell.terrain &= ~0x0800;
        if (!(crop[62] & 1)) cell.terrain = (cell.terrain & 0xf824) | 36;
      }
      b[3] = 14; break;
    case 14: {
      const truck = machine(field.pendingEquipment);
      if (f.u16(48)) { settleHarvestContract(world, field, crop); returnTruck(truck, false); finish(); }
      else loadTruck(truck, 15, 16, false);
      break;
    }
  }
  return true;
}
