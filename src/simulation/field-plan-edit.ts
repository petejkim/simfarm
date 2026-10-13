import { cropPlantSlot } from '../formats/crop-slots';
import { Binary } from '../formats/binary';
import type { Scenario } from '../formats/scenario';
import { SCHEDULE_WEEKS } from '../formats/field-schedule';
import { buildPlantingPlan, continuePlantingPlan } from './field-plan-pattern';
import { validateCalendar } from './calendar';
import type { Treatment } from './field-treatment';

export type FieldPlanEdit = { kind: 'plant'; cropSlot: number } | { kind: Treatment | 'harvest' | 'clear' | 'contract' | 'plow' };
export type FieldPlanEditResult = { ok: true; fieldSlot: number; week: number }
  | { ok: false; reason: 'invalid-field' | 'invalid-week' | 'invalid-action' | 'invalid-crop' | 'future-week-required'
    | 'contract-current-week' | 'not-growing' | 'already-contracted' | 'protected-order' | 'fixed-harvest-week' };

/** Calendar editor 0x2e11a..0x2e80c and erase helper 0x2df9c..0x2e118.
 * Accept field slots (DOS editor uses slot-1) and absolute plan weeks, avoiding UI buffer indices.
 * Only the contract action changes live work; all other actions edit future schedule words. */
export function editFieldPlan(world: Pick<Scenario, 'fields' | 'farm' | 'schedule' | 'cropDefinitions'>,
  crops: readonly (readonly number[])[], fieldSlot: number, week: number, action: FieldPlanEdit): FieldPlanEditResult {
  const field = world.fields[fieldSlot];
  if (!Number.isInteger(fieldSlot) || fieldSlot < 1 || !field?.active) return { ok: false, reason: 'invalid-field' };
  if (!Number.isInteger(week) || week < 0 || week >= SCHEDULE_WEEKS) return { ok: false, reason: 'invalid-week' };
  validateCalendar(world.farm.calendar);
  const now = world.farm.calendar.month * 4 + world.farm.calendar.week, column = fieldSlot - 1;
  const success = { ok: true as const, fieldSlot, week };
  if (action.kind === 'contract') {
    if (week !== now) return { ok: false, reason: 'contract-current-week' };
    if (field.state !== 4) return { ok: false, reason: 'not-growing' };
    const f = new Binary(field.bytes);
    if (f.u16(48)) return { ok: false, reason: 'already-contracted' };
    const definition = world.cropDefinitions[field.cropSlot];
    f.view.setUint16(48, definition.price, true); definition.count++;
    world.schedule.set(week, column, 198);
    return success;
  }
  if (week <= now) return { ok: false, reason: 'future-week-required' };
  if (action.kind === 'plant') {
    let plan: number[];
    try { plan = buildPlantingPlan(crops, action.cropSlot, week); }
    catch { return { ok: false, reason: 'invalid-crop' }; }
    // 0x2e779 passes the selected starting week, unlike manual planting's whole-column reset.
    for (let row = week; row < SCHEDULE_WEEKS; row++) world.schedule.set(row, column, plan[row]);
    return success;
  }
  if (action.kind === 'clear') {
    for (let row = week; row < SCHEDULE_WEEKS; row++) world.schedule.set(row, column, 209);
    return success;
  }
  if (action.kind === 'harvest') {
    const crop = crops[field.cropSlot];
    if (!crop || crop.length !== 128) return { ok: false, reason: 'invalid-crop' };
    if (crop[76]) return { ok: false, reason: 'fixed-harvest-week' };
    world.schedule.set(week, column, 440);
    if (!(crop[62] & 1)) for (let row = week + 1; row < SCHEDULE_WEEKS; row++) {
      const code = world.schedule.get(row, column);
      // SF-039: include crop slot 15; original strict comparison accidentally erases 847.
      if (cropPlantSlot(code, crops.length) >= 0) break;
      world.schedule.set(row, column, 209);
    }
    return success;
  }
  const codes = { fertilizer: 915, pesticide: 914, herbicide: 913, fungicide: 912, plow: 852 };
  const code = codes[action.kind];
  if (code === undefined) return { ok: false, reason: 'invalid-action' };
  const previous = world.schedule.get(week, column);
  // Editor guards are narrower than the immediate-order recorder (0x2e2a8..0x2e303).
  if (action.kind !== 'plow' && (previous === 198 || previous === 440 || cropPlantSlot(previous, crops.length) >= 0)) {
    return { ok: false, reason: 'protected-order' };
  }
  world.schedule.set(week, column, code);
  return success;
}

/** Native RESET (user request; no original equivalent): every future week of a field's plan returns to the default plan
 * of the crop in the field, as if it had been planted with no edits. Player orders (CUT, another crop, harvests,
 * treatments, plowing) are dropped; the current week, including a contract, is untouched. The plan is aligned to the
 * crop's actual age (+34), which the weekly dispatcher advances in step with the plan: a growing crop's plan index equals
 * its age, planting is index 0, and a harvest or treatment under way is age + 1 (treatments keep the interrupted state in +4). A field
 * with no crop (waiting, clearing or plowing) is left with nothing planned (fallow 209). */
export function resetFieldPlan(world: Pick<Scenario, 'fields' | 'farm' | 'schedule'>, crops: readonly (readonly number[])[],
  fieldSlot: number): FieldPlanEditResult {
  const field = world.fields[fieldSlot];
  if (!Number.isInteger(fieldSlot) || fieldSlot < 1 || !field?.active) return { ok: false, reason: 'invalid-field' };
  validateCalendar(world.farm.calendar);
  const now = world.farm.calendar.month * 4 + world.farm.calendar.week, column = fieldSlot - 1, from = now + 1;
  if (from >= SCHEDULE_WEEKS) return { ok: false, reason: 'invalid-week' };
  const b = field.bytes, treating = b[2] >= 6 && b[2] <= 9, state = treating ? b[4] : b[2], age = b[34] << 24 >> 24;
  // A treatment week skips growth and the next week catches up (+34 advances twice), so it sits at age + 1 like a harvest.
  const start = state === 3 && !treating ? now : state === 4 ? now - age - (treating ? 1 : 0) : state === 5 ? now - age - 1 : null;
  let plan: number[];
  if (start === null || !crops[field.cropSlot]) plan = Array<number>(SCHEDULE_WEEKS - from).fill(209);
  else try { plan = continuePlantingPlan(crops, field.cropSlot, start, from); }
  catch { return { ok: false, reason: 'invalid-crop' }; }
  plan.forEach((code, i) => world.schedule.set(from + i, column, code));
  return { ok: true, fieldSlot, week: from };
}
