import type { Scenario } from '../formats/scenario';
import { SCHEDULE_WEEKS } from '../formats/field-schedule';
import type { Treatment } from './field-treatment';
import { validateCalendar } from './calendar';

export type FieldPlanOrder = { kind: 'plant'; cropSlot: number } | { kind: Treatment | 'plow' };

/** Manual-order schedule recorder 0x2fb14..0x2ffad; this does not execute work or implement
 * the full calendar editor. All seven recovered toolbar/map callers pass weekOffset zero.
 * Returns false when a treatment cannot replace a protected planning word. */
export function recordFieldPlanOrder(world: Pick<Scenario, 'fields' | 'schedule' | 'farm'>,
  crops: readonly (readonly number[])[], fieldSlot: number, order: FieldPlanOrder, weekOffset = 0): boolean {
  validateCalendar(world.farm.calendar);
  if (!Number.isInteger(fieldSlot) || !fieldSlot || !world.fields[fieldSlot]?.active) throw new Error('Invalid plan field');
  const start = world.farm.calendar.month * 4 + world.farm.calendar.week + weekOffset;
  if (!Number.isInteger(weekOffset) || weekOffset < -128 || weekOffset > 127 || start < 0 || start >= SCHEDULE_WEEKS) {
    throw new Error('Invalid plan week');
  }
  const column = fieldSlot - 1;
  if (order.kind !== 'plant') {
    const codes = { plow: 852, fertilizer: 915, pesticide: 914, fungicide: 912, herbicide: 913 };
    const code = codes[order.kind];
    if (code === undefined) throw new Error('Invalid plan order');
    const previous = world.schedule.get(start, column);
    if (order.kind !== 'plow' && ([1, 2, 3, 440, 198, 852].includes(previous) || previous >= 832 && previous <= 847)) return false;
    world.schedule.set(start, column, code);
    return true;
  }

  const slot = order.cropSlot, crop = crops[slot];
  if (!Number.isInteger(slot) || slot < 0 || slot >= 16 || !crop || crop.length !== 128 ||
    crop.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Invalid plan crop definition');
  const duration = crop[56], stride = Math.trunc((duration + crop[66] - 2) / crop[66]);
  if (duration > 47) throw new Error('Invalid plan duration'); // SF-037.
  if (duration && (!crop[66] || stride <= 0)) throw new Error('Invalid plan stage divisor'); // SF-031.
  // Unlike year projection's word +26, this routine reads and sign-extends just byte +26.
  const base = 688 + slot * 8, offset = crop[26] < 128 ? crop[26] : crop[26] - 256;
  const pattern = [832 + slot];
  for (let age = 0; age < duration; age++) pattern.push((base + offset + Math.floor(age / stride)) & 0xffff);
  // Fixed-harvest plans replace every generated stage below, including this terminal value.
  pattern.push(crop[76] ? pattern[pattern.length - 1] : 440);
  const restart = crop[62] & 1 ? (crop[18] < 128 ? crop[18] : crop[18] - 256) + 1 : 0;
  if (restart < 0 || restart >= pattern.length) throw new Error('Invalid plan restart'); // SF-038.
  const plan = Array<number>(SCHEDULE_WEEKS).fill(209);
  let week = start;
  if (crop[76]) plan[week++] = 832 + slot;
  for (let index = 0; week < SCHEDULE_WEEKS; week++, index++) {
    if (index >= pattern.length) index = restart;
    let code = pattern[index];
    if (crop[76]) {
      const weekOfYear = week % 48, harvestWeek = crop[76];
      code = weekOfYear === harvestWeek ? 440 : (base + Math.trunc((weekOfYear - harvestWeek + (weekOfYear < harvestWeek ? 48 : 0)) / 6)) & 0xffff;
    }
    plan[week] = code;
  }
  // Original full-column writer 0x4882e is called with starting row zero, so history is fallow too.
  plan.forEach((code, row) => world.schedule.set(row, column, code));
  return true;
}
