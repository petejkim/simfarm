import type { Scenario } from '../formats/scenario';
import type { FieldRecord } from '../formats/field';
import type { WeatherState } from './weather';
import { changeFieldCondition } from './field-conditions';
import type { MovingDisasterState } from './moving-disasters';

/** 0x1e250: count covered rows/columns in the two-cell tree boundary.
 * Each row/column counts once even if multiple candidate cells contain trees. */
export function fieldWindbreaks(world: Scenario, f: FieldRecord): number {
  const clampByte = (n: number) => Math.max(0, Math.min(95, n << 24 >> 24));
  const left = clampByte(f.x - 2), top = clampByte(f.y - 2);
  const right = clampByte(f.x + f.width + 2), bottom = clampByte(f.y + f.height + 2);
  const tree = (x: number, y: number) => {
    // Native bounds guard; no out-of-map case is established for valid fields.
    if (x < 0 || y < 0 || x >= 96 || y >= 96) return false;
    const tile = world.cells[x * 96 + y].terrain & 2047; return tile >= 131 && tile <= 146;
  };
  let count = 0;
  for (let x = left; x < right; x++) if (tree(x, top) || tree(x, top + 1) || tree(x, bottom) || tree(x, bottom - 1)) count++;
  for (let y = top; y < bottom; y++) if (tree(left, y) || tree(left + 1, y) || tree(right, y) || tree(right - 1, y)) count++;
  return count;
}

/** General start's mode6 callback0x4b1be precedes eligibility checks.
 * Its source sensitivity is crop byte72, with 16-bit wrapping before the cap. */
export function beginWindDisaster(world: Scenario, crops: readonly (readonly number[])[], prices: number[],
  weather: WeatherState, d: MovingDisasterState, tick: number): boolean {
  if (!d.enabled) return false;
  for (let i = 0; i < 16; i++) {
    const c = crops[i], shift = c[72] & 31;
    if (!c[72]) continue;
    prices[i] = Math.min((prices[i] + (shift >= 16 ? 0 : prices[i] >>> shift)) & 65535, ((c[34] | c[35] << 8) * 4) & 65535);
    world.cropDefinitions[i].price = prices[i];
  }
  if (d.flags & 9) return false;
  d.flags = (d.flags & ~32) | 8;
  if (weather.wind < 30) weather.windAnomaly = (40 - weather.wind) << 24 >> 24;
  d.lastStartTick = tick;
  return true;
}

/** 0x370f4: DS6aa8 is initialized zero and this branch never updates it.
 * SF-120: visit actual active records rather than repeating sparse holes. */
export function advanceWindDisaster(world: Scenario, crops: readonly (readonly number[])[], flags: number,
  tick: number, referenceTick: number, delay: number): void {
  if (!(flags & 8) || ((tick - referenceTick) & 65535) <= delay) return;
  for (const field of world.fields) if (field.slot && field.active) {
    field.bytes[55] = fieldWindbreaks(world, field) & 255;
    if ((field.bytes[55] << 24 >> 24) < 8) changeFieldCondition(field, crops[field.cropSlot], world.regionalConditions, 13, 1);
  }
}
