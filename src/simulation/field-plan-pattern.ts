import { cropStageTile, cropPlantTile } from '../formats/crop-slots';
import { SCHEDULE_WEEKS } from '../formats/field-schedule';

/** Shared output of manual 0x2fd94 and editor 0x2e5a6 crop generators for bounded definitions.
 * Callers choose whether to replace earlier weeks; year projection uses a different generator. */
export function buildPlantingPlan(crops: readonly (readonly number[])[], slot: number, start: number): number[] {
  if (!Number.isInteger(start) || start < 0 || start >= SCHEDULE_WEEKS) throw new Error('Invalid plan week');
  const crop = crops[slot];
  if (!Number.isInteger(slot) || slot < 0 || slot >= crops.length || !crop || crop.length !== 128 ||
    crop.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Invalid plan crop definition');
  const duration = crop[56], stride = Math.trunc((duration + crop[66] - 2) / crop[66]);
  if (duration > 47) throw new Error('Invalid plan duration'); // SF-037.
  if (duration && (!crop[66] || stride <= 0)) throw new Error('Invalid plan stage divisor'); // SF-031.
  // Unlike year projection's word +26, this routine reads and sign-extends just byte +26.
  const base = cropStageTile(slot), offset = crop[26] < 128 ? crop[26] : crop[26] - 256;
  const pattern = [cropPlantTile(slot)];
  for (let age = 0; age < duration; age++) pattern.push((base + offset + Math.floor(age / stride)) & 0xffff);
  // Fixed-harvest plans replace every generated stage below, including this terminal value.
  pattern.push(crop[76] ? pattern[pattern.length - 1] : 440);
  const restart = crop[62] & 1 ? (crop[18] < 128 ? crop[18] : crop[18] - 256) + 1 : 0;
  if (restart < 0 || restart >= pattern.length) throw new Error('Invalid plan restart'); // SF-038.
  const plan = Array<number>(SCHEDULE_WEEKS).fill(209);
  let week = start;
  if (crop[76]) plan[week++] = cropPlantTile(slot);
  for (let index = 0; week < SCHEDULE_WEEKS; week++, index++) {
    if (index >= pattern.length) index = restart;
    let code = pattern[index];
    if (crop[76]) {
      const weekOfYear = week % 48, harvestWeek = crop[76];
      code = weekOfYear === harvestWeek ? 440 : (base + Math.trunc((weekOfYear - harvestWeek + (weekOfYear < harvestWeek ? 48 : 0)) / 6)) & 0xffff;
    }
    plan[week] = code;
  }
  return plan;
}
