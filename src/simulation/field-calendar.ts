import { Binary } from '../formats/binary';
import type { Scenario } from '../formats/scenario';
import { describeScheduleEntry } from '../formats/field-schedule';
import { validateCalendar } from './calendar';
import type { EquipmentRuntime } from './equipment-world';
import { finishWeeklyFieldWork } from './field-weekly';
import { clearFieldCrop } from './field-lifecycle';
import { plantField, type PlantResult } from './plant-order';
import type { FarmRandom } from './random';

export type ScheduleDispatchResult = { ok: true }
  | { ok: false; fieldSlot: number; reason: Extract<PlantResult, { ok: false }>['reason'] };

/** Original weekly order dispatcher 0x2f66a..0x2fb12, called after week increment but BEFORE
 * month/year normalization (0xcbbd). Accept temporary week 4, including absolute week 48.
 * An explicit January week-zero call skips completion; actual year-end calls do not.
 * A failed seed order exits the whole scan.
 * Calendar advancement and year-plan projection remain separate caller responsibilities. */
export function dispatchFieldSchedule(world: Scenario, crops: readonly (readonly number[])[], marketPrices: number[],
  random: FarmRandom, runtime: EquipmentRuntime, soilMoisture: number): ScheduleDispatchResult {
  const calendar = world.farm.calendar;
  validateCalendar(calendar.week === 4 ? { ...calendar, week: 0 } : calendar);
  const week = world.farm.calendar.month * 4 + world.farm.calendar.week;
  if (week >= 1) finishWeeklyFieldWork(world, crops, runtime);
  for (const field of world.fields) {
    if (!field.slot || !field.active) continue;
    const entry = describeScheduleEntry(world.schedule.get(week, field.slot - 1)), b = field.bytes;
    switch (entry.kind) {
      case 'plant': {
        // SF-018: preserve the existing field if seed fails, but retain the original stop-on-failure ordering.
        const result = plantField(world, field.slot, entry.cropSlot, crops, marketPrices, random, soilMoisture, true);
        if (!result.ok) return { ok: false, fieldSlot: field.slot, reason: result.reason };
        break;
      }
      case 'fallow': clearFieldCrop(field, crops[field.cropSlot], world.regionalConditions, world.cells); break;
      case 'contract': {
        const f = new Binary(b), definition = world.cropDefinitions[field.cropSlot];
        if (field.state === 4 && !f.u16(48)) { f.view.setUint16(48, definition.price, true); definition.count++; }
        break;
      }
      case 'harvest':
        if (field.state === 4) { b[2] = 5; b[3] = crops[field.cropSlot][57] === 1 ? 10 : 0; b[7] |= 2; }
        break;
      case 'alternate-harvest': b[2] = 5; b[3] = 0; b[7] &= ~2; break;
      case 'plow':
        // Both original work dispatch tables leave state 2 inert. Do not invent a plowing FSM.
        b[2] = 2; b[3] = 0; break;
      case 'fertilizer': case 'pesticide': case 'herbicide': case 'fungicide':
        b[4] = b[2]; b[5] = b[3];
        b[2] = { fertilizer: 6, pesticide: 7, herbicide: 8, fungicide: 9 }[entry.kind]; b[3] = 0;
        break;
      // Graphic growth stages and unknown words do not dispatch work in the executable.
    }
  }
  return { ok: true };
}
