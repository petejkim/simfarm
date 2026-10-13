import { cropStageTile, cropPlantTile } from '../formats/crop-slots';
import { SCHEDULE_WEEKS } from '../formats/field-schedule';

interface PlantingPattern { pattern: number[]; restart: number; base: number; fixedHarvest: number }
function plantingPattern(crops: readonly (readonly number[])[], slot: number): PlantingPattern {
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
  return { pattern, restart, base, fixedHarvest: crop[76] };
}
/** The code at one week of a plan: the pattern index (weeks since planting, wrapping to the restart index), or, for
 * fixed-harvest crops, the calendar stage by week of year. */
function planCode({ pattern, restart, base, fixedHarvest }: PlantingPattern, index: number, week: number): number {
  if (fixedHarvest) {
    const weekOfYear = week % 48;
    return weekOfYear === fixedHarvest ? 440 : (base + Math.trunc((weekOfYear - fixedHarvest + (weekOfYear < fixedHarvest ? 48 : 0)) / 6)) & 0xffff;
  }
  if (index >= pattern.length) index = restart + (index - restart) % (pattern.length - restart);
  return pattern[index];
}

/** Shared output of manual 0x2fd94 and editor 0x2e5a6 crop generators for bounded definitions.
 * Callers choose whether to replace earlier weeks; year projection uses a different generator. */
export function buildPlantingPlan(crops: readonly (readonly number[])[], slot: number, start: number): number[] {
  if (!Number.isInteger(start) || start < 0 || start >= SCHEDULE_WEEKS) throw new Error('Invalid plan week');
  const planting = plantingPattern(crops, slot);
  const plan = Array<number>(SCHEDULE_WEEKS).fill(209);
  let week = start;
  if (planting.fixedHarvest) plan[week++] = cropPlantTile(slot);
  for (let index = 0; week < SCHEDULE_WEEKS; week++, index++) plan[week] = planCode(planting, index, week);
  return plan;
}

/** Native RESET (user request): the same plan continued for a crop planted at `start`, which may lie before row 0
 * (planted in an earlier plan year). Returns codes for rows from..239; equal to buildPlantingPlan's rows there. */
export function continuePlantingPlan(crops: readonly (readonly number[])[], slot: number, start: number, from: number): number[] {
  if (!Number.isInteger(start) || !Number.isInteger(from) || from < 0 || from > SCHEDULE_WEEKS || start >= from) throw new Error('Invalid plan week');
  const planting = plantingPattern(crops, slot);
  return Array.from({ length: SCHEDULE_WEEKS - from }, (_, i) => planCode(planting, from + i - start - (planting.fixedHarvest ? 1 : 0), from + i));
}
