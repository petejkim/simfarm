import { Binary } from '../formats/binary';
import type { FieldRecord } from '../formats/field';
import { terrainTile, worldIndex, type Scenario } from '../formats/scenario';
import { detachEquipment, parkEquipment, releaseEquipment } from './equipment-dispatch';
import { equipmentChain, eraseEquipment, type EquipmentRuntime } from './equipment-world';
import { changeFieldCondition } from './field-conditions';
import { clearFieldCrop } from './field-lifecycle';
import { updateFieldStatus } from './field-status';
import { creditHarvest, settleHarvestContract } from './harvest-income';
import { fieldHarvestValue, harvestLoss } from './harvest-value';
import { deliverStoredHarvest, releaseFirstHarvestReservation, reserveHarvestStorage } from './harvest-storage';

/** Repeated cleanup at 0x2ef60/0x2f1b5 and helper 0x2ffae. Child first, then head.
 * SF-010: retain the native fix that detaches/releases all members of a longer chain. */
function returnFieldEquipment(world: Scenario, field: FieldRecord, runtime: EquipmentRuntime, harvest: boolean, pendingHeader = 0): void {
  const f = new Binary(field.bytes), slots = [field.equipment, field.pendingEquipment];
  // SF-033: an allocated, not-yet-attached header lives at +46, which the DOS cleanup omits.
  if (pendingHeader) slots.push(pendingHeader);
  const visited = new Set<number>();
  for (const slot of slots) {
    if (!slot || visited.has(slot)) continue;
    const head = world.equipment[slot];
    if (!head?.active) throw new Error('Weekly cleanup has invalid field equipment');
    const chain = equipmentChain(head, world);
    detachEquipment(head, world);
    for (const e of [...chain.slice(1), head]) {
      if (visited.has(e.slot)) continue;
      visited.add(e.slot);
      e.parent = 0; e.attachment = 0;
      eraseEquipment(e, world);
      e.bytes[5] = e.bytes[50]; e.bytes[6] = e.bytes[51]; e.bytes[15] = e.bytes[52];
      e.flags &= 0xe9fc;
      if (harvest) e.bytes[42] = 0;
      if (!(e.flags & 0x40)) parkEquipment(e, world, runtime);
      releaseEquipment(e, world);
    }
  }
  field.equipment = 0; field.pendingEquipment = 0;
  if (pendingHeader) f.view.setUint16(46, 0, true);
}

function finishPlanting(world: Scenario, field: FieldRecord, crop: readonly number[], runtime: EquipmentRuntime): void {
  returnFieldEquipment(world, field, runtime, false);
  const b = field.bytes, f = new Binary(b);
  b[6] = (b[6] | 4) & ~2; b[3] = b[34] = 0;
  for (const offset of [18, 38, 40]) f.view.setUint16(offset, 0, true);
  b[2] = 4;
  // Unlike ordinary planting completion, this does not set +33 or +36 (0x2f3bf..0x2f42c).
  updateFieldStatus(field, crop, world.cells);
  for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
    const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
    if (tile < 539 || tile >= 635) cell.terrain = (cell.terrain & 0xf800) | (688 + field.cropSlot * 8);
    cell.terrain &= ~0x0800;
  }
}

function finishTreatment(world: Scenario, field: FieldRecord, crop: readonly number[], runtime: EquipmentRuntime): void {
  const kind = field.state - 6, b = field.bytes;
  returnFieldEquipment(world, field, runtime, false);
  // SF-032: this deadline path applies the full effect even if step zero never obtained supplies.
  if (kind === 0) changeFieldCondition(field, crop, world.regionalConditions, 1, 255);
  else {
    changeFieldCondition(field, crop, world.regionalConditions, 3, 32);
    const [offset, mode, pressure] = [[20, 8, 60], [21, 10, 61], [22, 6, 62]][kind - 1];
    changeFieldCondition(field, crop, world.regionalConditions, mode, b[offset]); b[pressure] >>= 2;
  }
  if (b[4]) { b[2] = b[4]; b[3] = b[5]; b[4] = b[5] = 0; }
  else { b[2] = b[3] = 0; } // Saved Waiting substep/backup bytes are deliberately not restored/cleared.
}

function resetHarvest(field: FieldRecord, crop: readonly number[]): void {
  const b = field.bytes, f = new Binary(b);
  b[3] = b[33] = 0;
  for (const offset of [18, 38, 40]) f.view.setUint16(offset, 0, true);
  b[34] = crop[62] & 1 ? crop[18] : 0; b[2] = crop[62] & 1 ? 4 : 0;
}

function finishHarvest(world: Scenario, field: FieldRecord, crop: readonly number[], runtime: EquipmentRuntime): void {
  const b = field.bytes, f = new Binary(b), c = new Binary(Uint8Array.from(crop));
  const pendingHeader = field.step < 4 && f.u16(46) && world.equipment[f.u16(46)]?.type === 5 ? f.u16(46) : 0;
  if (field.step < 3) clearFieldCrop(field, crop, world.regionalConditions, world.cells);
  const step = field.step;
  if (step <= 6 || (step >= 10 && step <= 15)) {
    const value = fieldHarvestValue(field, crop, world.cropDefinitions[field.cropSlot].price);
    const clearFrames = () => {
      world.equipment[world.equipment[field.equipment].attachment].bytes[42] = 0;
      world.equipment[field.pendingEquipment].bytes[42] = 0;
    };
    if (f.u16(48)) { settleHarvestContract(world, field, crop); clearFrames(); }
    else {
      const truck = world.equipment[field.pendingEquipment]; // Slot zero is read by the original when no truck was acquired.
      let buildingSlot = f.u16(64);
      if (!buildingSlot) {
        const reservation = reserveHarvestStorage(world, truck.x, truck.y);
        buildingSlot = reservation?.buildingSlot ?? 0;
        b[66] = reservation?.x ?? 255; b[67] = reservation?.y ?? 255;
      }
      f.view.setUint16(64, 0, true);
      if (buildingSlot) {
        const t = new Binary(truck.bytes);
        t.view.setUint16(38, 0x713c + field.cropSlot * 18, true); t.view.setUint16(40, 0x6190, true);
        if (!deliverStoredHarvest(world, buildingSlot, field.cropSlot, c.u16(32), harvestLoss(field, crop))) {
          creditHarvest(world, value); releaseFirstHarvestReservation(world, buildingSlot); // SF-021/022 native guards.
        }
      } else { creditHarvest(world, value); clearFrames(); }
    }
    resetHarvest(field, crop); b[6] &= ~6;
    // 0x2edc4..0x2ee40 clears every overlay in a fixed 8×8 area (including badges for annuals).
    for (let x = field.x; x < Math.min(96, field.x + 8); x++) for (let y = field.y; y < Math.min(96, field.y + 8); y++) {
      const cell = world.cells[worldIndex(x, y)]; cell.terrain &= ~0x0800;
      if (!(crop[62] & 1)) cell.terrain = (cell.terrain & 0xf824) | 36;
    }
    if (!(crop[62] & 1)) for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
      const cell = world.cells[worldIndex(x, y)], tile = terrainTile(cell);
      if (tile < 539 || tile >= 635) cell.terrain = (cell.terrain & 0xf824) | 36;
    }
  } else if (step === 7) resetHarvest(field, crop); // Already sold by machinery FSM; never pay twice.
  else if (step === 16) {
    // SF-034: DOS omits this worker-sale phase, then clears its truck pointer and strands the field.
    creditHarvest(world, fieldHarvestValue(field, crop, world.cropDefinitions[field.cropSlot].price));
    resetHarvest(field, crop);
  }
  returnFieldEquipment(world, field, runtime, true, pendingHeader);
}

/** Original weekly force-completion 0x2e93a..0x2f668. The caller's week argument is unused.
 * No schedule history, RNG, clock, fee or supply purchase occurs in this routine.
 * Keep separate from the dispatcher until all scheduled action/year-rollover paths are ported. */
export function finishWeeklyFieldWork(world: Scenario, crops: readonly (readonly number[])[], runtime: EquipmentRuntime): void {
  for (const field of world.fields) {
    if (!field.slot || !field.active) continue;
    const crop = crops[field.cropSlot];
    if (field.state === 3) finishPlanting(world, field, crop, runtime);
    else if (field.state === 5) finishHarvest(world, field, crop, runtime);
    else if (field.state >= 6 && field.state <= 9) finishTreatment(world, field, crop, runtime);
  }
}
