import type { FieldRecord } from '../formats/field';
import type { Scenario } from '../formats/scenario';
import { consumeChemical, type ChemicalResult } from './chemicals';
import { reserveOwnedEquipment } from './building-storage';
import { attachEquipment, positionEquipmentAttachments, setEquipmentDestination } from './equipment';
import type { EquipmentAllocator } from './equipment-dispatch';
import { eraseEquipment, traverseEquipmentField, type EquipmentRuntime } from './equipment-world';
import { findFieldEntry } from './field-planting';
import { updateFieldStatus } from './field-status';
import { changeFieldCondition } from './field-conditions';

export const TREATMENTS = ['fertilizer', 'pesticide', 'herbicide', 'fungicide'] as const;
export type Treatment = typeof TREATMENTS[number];
export type TreatmentResult = (Extract<ChemicalResult, { ok: true }> & { fieldSlot: number; treatment: Treatment })
  | Extract<ChemicalResult, { ok: false }> | { ok: false; reason: 'invalid-field' | 'invalid-treatment' | 'field-busy' };

/** Immediate toolbar handlers 0x26d3c..0x26f86. Consume once, save state/step, begin at step 1. */
export function orderTreatment(world: Scenario, slot: number, treatment: Treatment, soilMoisture: number): TreatmentResult {
  const index = TREATMENTS.indexOf(treatment), field = world.fields[slot];
  if (index < 0) return { ok: false, reason: 'invalid-treatment' };
  if (!Number.isInteger(slot) || !slot || !field?.active) return { ok: false, reason: 'invalid-field' };
  if (![0, 4].includes(field.state) || field.equipment || field.pendingEquipment) return { ok: false, reason: 'field-busy' };
  const supply = consumeChemical(world, 220 + index, soilMoisture);
  if (!supply.ok) return supply;
  const b = field.bytes;
  b[4] = field.state; b[5] = field.step; b[2] = 6 + index; b[3] = 1;
  return { ...supply, fieldSlot: slot, treatment };
}

/** Shared treatment FSM, file 0x185ac..0x18c89. False exits the whole field dispatcher (step 0 stock
 * failure only; the step 5 timer wait is per-field natively, SF-178).
 * Each treatment makes one non-painting tractor/type-3 sprayer pass, then returns the equipment.
 * Step 0 is the scheduled-order path; immediate commands already paid and start at step 1. */
export function updateTreatmentField(field: FieldRecord, crop: readonly number[], world: Scenario,
  runtime: EquipmentRuntime, tick: number, soilMoisture: number, allocate: EquipmentAllocator = reserveOwnedEquipment): boolean {
  if (!field.active || field.state < 6 || field.state > 9) return true;
  const kind = field.state - 6, b = field.bytes;
  if (field.step === 0) {
    if (!consumeChemical(world, 220 + kind, soilMoisture).ok) return false;
    b[3] = 1; return true;
  }
  if (field.step === 1) {
    const tractor = allocate(world, 0, field.x, field.y);
    if (!tractor) return true;
    tractor.flags |= 8; field.equipment = tractor.slot;
    tractor.bytes[48] = field.slot; tractor.bytes[15] = 2; tractor.bytes[49] = 1;
    tractor.timestamp = tick; b[3] = 2; return true;
  }
  const tractor = world.equipment[field.equipment];
  if (!tractor?.active) throw new Error('Treatment field has no active tractor');
  const order = (x: number, y: number, flags: number) => {
    setEquipmentDestination(tractor, x, y, tick); tractor.flags |= flags;
  };
  switch (field.step) {
    case 2: {
      const sprayer = allocate(world, 3, field.x, field.y);
      if (!sprayer) return true;
      field.pendingEquipment = sprayer.slot; sprayer.flags |= 8;
      order(sprayer.x, sprayer.y, 0x1000); b[3] = 3; break;
    }
    case 3: {
      if (tractor.flags & 2) break;
      const sprayer = world.equipment[field.pendingEquipment];
      if (!sprayer?.active) throw new Error('Treatment sprayer is missing');
      field.pendingEquipment = 0;
      eraseEquipment(sprayer, world); eraseEquipment(tractor, world);
      attachEquipment(tractor, sprayer, world.equipmentDefinitions);
      const entry = findFieldEntry(field, world); order(entry.x, entry.y, 0x1000);
      b[3] = 4; tractor.timestamp = tick; break;
    }
    case 4:
      if (tractor.flags & 2) break;
      eraseEquipment(tractor, world);
      tractor.bytes[5] = field.x; tractor.bytes[6] = field.y; tractor.bytes[15] = 2;
      positionEquipmentAttachments(tractor, world.equipment, world.equipmentDefinitions);
      tractor.timestamp = tick; b[3] = 5; break;
    case 5: {
      // SF-178: the original returns false here, ending the whole field dispatcher whenever this tractor's
      // timer was just refreshed. Native code waits for this field only, so later fields keep their turn.
      if (((tick - tractor.timestamp) & 0xffff) < 1) return true;
      const sprayer = world.equipment[tractor.attachment];
      if (!sprayer?.active) throw new Error('Treatment sprayer is missing');
      if (!traverseEquipmentField(tractor, field, -1, world, runtime)) break;
      order(sprayer.bytes[50], sprayer.bytes[51], 0x0100);
      field.equipment = 0; b[3] = 0;
      // Preserve original ordering: badges/sample +28 refresh BEFORE state restoration and treatment.
      updateFieldStatus(field, crop, world.cells);
      b[2] = b[4]; b[3] = b[5];
      if (kind === 0) changeFieldCondition(field, crop, world.regionalConditions, 1, 255);
      else {
        changeFieldCondition(field, crop, world.regionalConditions, 3, 32);
        const [offset, mode, pressure] = [[20, 8, 60], [21, 10, 61], [22, 6, 62]][kind - 1];
        changeFieldCondition(field, crop, world.regionalConditions, mode, b[offset]);
        b[pressure] >>= 2;
      }
      break;
    }
  }
  return true;
}
