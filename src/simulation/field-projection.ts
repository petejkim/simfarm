import type { Scenario } from '../formats/scenario';
import { FieldSchedule, SCHEDULE_COLUMNS, SCHEDULE_WEEKS } from '../formats/field-schedule';

const YEAR_WEEKS = 48;
const RETAINED_WEEKS = SCHEDULE_WEEKS - YEAR_WEEKS;

function definition(crops: readonly (readonly number[])[], slot: number): readonly number[] {
  const crop = crops[slot];
  if (!Number.isInteger(slot) || slot < 0 || slot >= 16 || !crop || crop.length !== 128 ||
    crop.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Invalid projection crop definition');
  return crop;
}

/** Original overlay 25:0648, file 0x48d08..0x491ce. Shift four years, then extend the last
 * matching crop cycle. Commit only after validation; no clock, field or RNG changes here.
 * SF-036: markerless columns get the original fallow tail without reading outside the plan.
 * Inactive columns retain their unknown old tail: DOS leaves that buffer area unwritten. */
export function projectFieldScheduleYear(world: Pick<Scenario, 'fields' | 'schedule'>,
  crops: readonly (readonly number[])[]): { unprojectedFieldSlots: number[] } {
  const schedule = new FieldSchedule(Uint8Array.from(world.schedule.bytes));
  schedule.bytes.copyWithin(0, YEAR_WEEKS * SCHEDULE_COLUMNS * 2);
  const unprojectedFieldSlots: number[] = [];
  for (const field of world.fields) {
    if (!field.slot || !field.active) continue;
    const column = field.slot - 1, current = definition(crops, field.cropSlot);
    const perennial = Boolean(current[62] & 1);
    for (let week = RETAINED_WEEKS; week < SCHEDULE_WEEKS; week++) schedule.set(week, column, 209);
    let start = RETAINED_WEEKS - 1;
    for (; start >= 0; start--) {
      const code = schedule.get(start, column);
      if (perennial ? code === 440 : code >= 832 && code < 848) break;
    }
    if (start < 0) { unprojectedFieldSlots.push(field.slot); continue; }

    // The current field chooses the search branch. An annual branch can select a different,
    // even perennial, future crop from its last planting code (0x48f8e..0x48fd2).
    const slot = perennial ? field.cropSlot : schedule.get(start, column) - 832;
    const crop = definition(crops, slot), duration = crop[56];
    const stride = Math.trunc((duration + crop[66] - 2) / crop[66]);
    if (duration && (!crop[66] || stride <= 0)) throw new Error('Invalid projection stage divisor'); // SF-031.
    if (duration > 47) throw new Error('Invalid projection duration'); // SF-037: overlaps live DOS stack locals.
    const pattern = [perennial ? 440 : 832 + slot];
    const base = 688 + slot * 8 + crop[26] + crop[27] * 256;
    for (let age = 0; age < duration; age++) pattern.push((base + Math.floor(age / stride)) & 0xffff);
    pattern.push(440);
    const restart = crop[62] & 1 ? (crop[18] < 128 ? crop[18] : crop[18] - 256) + 1 : 0;
    if (restart < 0 || restart >= pattern.length) throw new Error('Invalid projection restart'); // SF-038.
    for (let week = start, index = 0; week < SCHEDULE_WEEKS; week++, index++) {
      if (index >= pattern.length) index = restart;
      schedule.set(week, column, pattern[index]);
    }
  }
  world.schedule.bytes.set(schedule.bytes);
  return { unprojectedFieldSlots };
}
