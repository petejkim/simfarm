import { Binary } from '../formats/binary';
import type { Scenario } from '../formats/scenario';
import { changeFieldCondition } from './field-conditions';
import { writeFieldBadge } from './field-status';
import type { FarmRandom } from './random';
import { consumeSeed, type SeedResult } from './seeds';
import { checkFieldPlacement, createField, type FieldPlacementResult } from './field-placement';
import type { FieldRecord } from '../formats/field';

export type PlantResult = SeedResult | { ok: false; reason: 'invalid-field' | 'field-busy' | 'invalid-crop' };
export type NewFieldResult = (Extract<SeedResult, { ok: true }> & { slot: number })
  | Extract<PlantResult | FieldPlacementResult, { ok: false }>;

/** Map planting branch 0x23eae..0x24162. Unlike replanting, no crop-rotation pest reduction.
 * Preflight placement and acquire seed before construction (native SF-018 correction). */
export function plantNewField(world: Scenario, x: number, y: number, cropSlot: number, crops: readonly (readonly number[])[],
  marketPrices: number[], random: FarmRandom, soilMoisture: number): NewFieldResult {
  if (!Number.isInteger(cropSlot) || cropSlot < 0 || cropSlot >= 16 || crops[cropSlot]?.length !== 128) return { ok: false, reason: 'invalid-crop' };
  const placement = checkFieldPlacement(world, x, y);
  if (!placement.ok) return placement;
  const seed = consumeSeed(world, cropSlot, soilMoisture);
  if (!seed.ok) return seed;
  const created = createField(world, x, y);
  if (!created.ok) throw new Error('Validated field placement changed during seed acquisition');
  const field = world.fields[created.slot];
  resetPlantingField(world, field);
  startPlanting(world, field, cropSlot, crops[cropSlot], marketPrices, random);
  return { ...seed, slot: created.slot };
}

/** Existing-field planting branch 0x2f7de..0x2fa54. The native UI issues an immediate order;
 * scheduled calls follow weekly cleanup and permit the original state replacement. */
export function plantField(world: Scenario, slot: number, cropSlot: number, crops: readonly (readonly number[])[],
  marketPrices: number[], random: FarmRandom, soilMoisture: number, scheduled = false): PlantResult {
  const field = world.fields[slot];
  if (!Number.isInteger(slot) || !slot || !field?.active) return { ok: false, reason: 'invalid-field' };
  if (!Number.isInteger(cropSlot) || cropSlot < 0 || cropSlot >= 16 || crops[cropSlot]?.length !== 128) return { ok: false, reason: 'invalid-crop' };
  // Cancellation/return of an in-flight field job is not yet ported; don't strand its machines.
  if ((!scheduled && ![0, 2, 4].includes(field.state)) || field.equipment || field.pendingEquipment) return { ok: false, reason: 'field-busy' };
  const seed = consumeSeed(world, cropSlot, soilMoisture);
  if (!seed.ok) return seed; // SF-018: preserve existing crop and contract when seed acquisition fails.
  resetPlantingField(world, field);
  const b = field.bytes, oldCrop = crops[field.cropSlot];
  const shift = field.cropSlot === cropSlot ? 2 : 0;
  for (const [offset, mode] of [[20, 8], [22, 6], [21, 10]]) changeFieldCondition(field, oldCrop, world.regionalConditions, mode, b[offset] >> shift);
  startPlanting(world, field, cropSlot, crops[cropSlot], marketPrices, random);
  return seed;
}

function resetPlantingField(world: Scenario, field: FieldRecord): void {
  const data = new Binary(field.bytes), b = field.bytes;
  for (const offset of [18, 38, 40]) data.view.setUint16(offset, 0, true);
  b[33] = b[34] = 0;
  if (data.u16(48)) { world.cropDefinitions[field.cropSlot].count--; data.view.setUint16(48, 0, true); }
}

function startPlanting(world: Scenario, field: FieldRecord, cropSlot: number, crop: readonly number[],
  marketPrices: number[], random: FarmRandom): void {
  const b = field.bytes;
  b[2] = 3; b[3] = 0;
  // 0x4b066 reduces this crop's current market price by one quarter (signed shift in source).
  const price = marketPrices[cropSlot];
  marketPrices[cropSlot] = (price - ((price << 16 >> 16) >> 2)) & 0xffff;
  world.cropDefinitions[cropSlot].price = marketPrices[cropSlot];
  b[14] = cropSlot; writeFieldBadge(field, world.cells, 0, cropSlot);
  for (const [target, resistance] of [[61, 59], [60, 58], [62, 60]]) {
    b[target] = Math.max(0, Math.min(64, Math.max(1, random.nextSimulation() & 255) - crop[resistance]));
  }
}
