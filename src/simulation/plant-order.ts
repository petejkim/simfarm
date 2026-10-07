import { Binary } from '../formats/binary';
import type { Scenario } from '../formats/scenario';
import { changeFieldCondition } from './field-conditions';
import { writeFieldBadge } from './field-status';
import type { FarmRandom } from './random';
import { consumeSeed, type SeedResult } from './seeds';

export type PlantResult = SeedResult | { ok: false; reason: 'invalid-field' | 'field-busy' | 'invalid-crop' };

/** Existing-field planting branch 0x2f7de..0x2fa54. The native UI issues an immediate order;
 * the original calendar-plan editor and future scheduled orders remain separate work. */
export function plantField(world: Scenario, slot: number, cropSlot: number, crops: readonly (readonly number[])[],
  marketPrices: number[], random: FarmRandom, soilMoisture: number): PlantResult {
  const field = world.fields[slot];
  if (!Number.isInteger(slot) || !slot || !field?.active) return { ok: false, reason: 'invalid-field' };
  if (!Number.isInteger(cropSlot) || cropSlot < 0 || cropSlot >= 16 || crops[cropSlot]?.length !== 128) return { ok: false, reason: 'invalid-crop' };
  // Cancellation/return of an in-flight field job is not yet ported; don't strand its machines.
  if (![0, 2, 4].includes(field.state) || field.equipment || field.pendingEquipment) return { ok: false, reason: 'field-busy' };
  const seed = consumeSeed(world, cropSlot, soilMoisture);
  if (!seed.ok) return seed; // SF-018: preserve existing crop and contract when seed acquisition fails.
  const data = new Binary(field.bytes), b = field.bytes, oldCrop = crops[field.cropSlot];
  for (const offset of [18, 38, 40]) data.view.setUint16(offset, 0, true);
  b[33] = b[34] = 0;
  if (data.u16(48)) { world.cropDefinitions[field.cropSlot].count--; data.view.setUint16(48, 0, true); }
  b[2] = 3; b[3] = 0;
  // 0x4b066 reduces this crop's current market price by one quarter (signed shift in source).
  const price = marketPrices[cropSlot];
  marketPrices[cropSlot] = (price - ((price << 16 >> 16) >> 2)) & 0xffff;
  const shift = field.cropSlot === cropSlot ? 2 : 0;
  for (const [offset, mode] of [[20, 8], [22, 6], [21, 10]]) changeFieldCondition(field, oldCrop, world.regionalConditions, mode, b[offset] >> shift);
  b[14] = cropSlot; writeFieldBadge(field, world.cells, 0, cropSlot);
  const crop = crops[cropSlot];
  for (const [target, resistance] of [[61, 59], [60, 58], [62, 60]]) {
    b[target] = Math.max(0, Math.min(64, Math.max(1, random.nextSimulation() & 255) - crop[resistance]));
  }
  return seed;
}
