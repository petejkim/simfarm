import type { Scenario } from '../formats/scenario';
import { SCHEDULE_WEEKS } from '../formats/field-schedule';
import { buildPlantingPlan } from './field-plan-pattern';
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

  const plan = buildPlantingPlan(crops, order.cropSlot, start);
  // Original full-column writer 0x4882e is called with starting row zero, so history is fallow too.
  plan.forEach((code, row) => world.schedule.set(row, column, code));
  return true;
}
