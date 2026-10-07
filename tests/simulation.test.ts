import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { CALENDAR_OFFSET } from '../src/formats/scenario-state';
import { advanceCalendarDay, type FarmCalendar } from '../src/simulation/calendar';
import { FarmRandom } from '../src/simulation/random';
import { changeFieldCondition } from '../src/simulation/field-conditions';
import { growField, waterStress } from '../src/simulation/field-growth';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const definition = (name: string) => readCrop(name, source(`CROPS/${name.toUpperCase()}.CRP`)).rawDefinition;
const random = () => new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });

test('all original farms restore cash, calendar, timing and regional records from loader offsets', () => {
  const dates = [[4, 2, 1, 7], [3, 1, 0, 4], [0, 2, 0, 6], [4, 1, 0, 5], [6, 1, 3, 3], [2, 2, 2, 6], [6, 1, 3, 3], [6, 1, 2, 3]];
  for (let i = 0; i < 8; i++) {
    const bytes = source(`SCEN${i}.SSM`), farm = readScenario(bytes);
    const { day, season, week, year, month } = farm.farm.calendar;
    assert.deepEqual([day, season, week, month], dates[i]);
    assert.equal(year, 1993); assert.equal(farm.farm.cash, 40000);
    assert.equal(farm.farm.dayDelayTicks, 256); assert.equal(farm.farm.speed, 1);
    assert.equal(farm.regionalConditions.length, 1008);
    assert.deepEqual(farm.regionalConditions, new Uint8Array(bytes.subarray(0x21273, 0x21663)));
  }
  const corrupt = source('SCEN0.SSM'); corrupt.writeUInt16LE(7, CALENDAR_OFFSET);
  assert.throws(() => readScenario(corrupt), /calendar day/);
});

test('calendar reproduces 7-day weeks, 4-week months, original season gap and year rollover', () => {
  let calendar: FarmCalendar = { day: 0, week: 0, month: 0, year: 1993, season: 0 };
  let weeks = 0, months = 0, years = 0;
  for (let day = 0; day < 336; day++) {
    const advance = advanceCalendarDay(calendar);
    calendar = advance.calendar;
    weeks += Number(advance.weekEnded); months += Number(advance.monthEnded); years += Number(advance.yearEnded);
    if (day === 69) assert.equal(calendar.season, 1); // Enter week 10.
    if (day === 153) assert.equal(calendar.season, 1); // Week 22 has no assignment in source.
    if (day === 160) assert.equal(calendar.season, 2);
    if (day === 237) assert.equal(calendar.season, 3);
    if (day === 314) assert.equal(calendar.season, 0);
  }
  assert.deepEqual([weeks, months, years], [48, 12, 1]);
  assert.deepEqual(calendar, { day: 0, week: 0, month: 0, year: 1994, season: 0 });
  assert.equal(advanceCalendarDay({ day: 6, week: 3, month: 11, year: 65535, season: 0 }).calendar.year, 0);
});

test('original independent random streams, rejection-state quirk and monthly perturbation', () => {
  const rng = random();
  assert.deepEqual(Array.from({ length: 8 }, () => rng.nextSimulation()), [9378, 4689, 15400, 7700, 3850, 1925, 14018, 7009]);
  assert.deepEqual(Array.from({ length: 8 }, () => rng.nextVisual()), [2816, 16395, 1856, 28679, 624, 41986, 420, 47873]);
  assert.equal(rng.below(5), 4);
  assert.equal(rng.snapshot().bounded, 161); // The stored state is before rejection, not returned 4.
  const restored = new FarmRandom(rng.snapshot());
  assert.deepEqual(Array.from({ length: 20 }, () => restored.below(17)), Array.from({ length: 20 }, () => rng.below(17)));
  const monthly = new FarmRandom({ visual: 27, simulation: 8190, bounded: 51 });
  monthly.mixMonth(1); assert.equal(monthly.snapshot().simulation, 1234);
  assert.throws(() => rng.below(0));
});

test('field conditions retain saturation, resistance and original regional subtraction behavior', () => {
  const field = readScenario(source('SCEN0.SSM')).fields[1], crop = definition('grapes');
  const regions = new Uint8Array(1008), region = (5 * 12 + 4) * 7;
  field.bytes[20] = 250;
  changeFieldCondition(field, crop, regions, 9, 64);
  assert.equal(field.bytes[20], 255); assert.equal(regions[region + 2], 16);
  regions[region + 6] = 5;
  changeFieldCondition(field, crop, regions, 13, 8);
  assert.equal(field.bytes[29], 0); assert.equal(regions[region + 6], 253);
  regions[region + 6] = 20;
  changeFieldCondition(field, crop, regions, 13, 8);
  assert.equal(regions[region + 6], 0);
  field.bytes[30] = 2;
  changeFieldCondition(field, crop, regions, 17, 3);
  assert.equal(field.bytes[30], 2); // Original leaves this nutrient unchanged when amount exceeds it.
  changeFieldCondition(field, crop, regions, 17, 2);
  assert.equal(field.bytes[30], 0);
});

test('weekly grape update consumes original amounts, changes crop tiles and cannot run twice in one week', () => {
  const input = source('SCEN0.SSM'), original = Uint8Array.from(input);
  const scenario = readScenario(input), field = scenario.fields[1], crop = definition('grapes');
  const context = { week: 0, temperature: 75, regions: new Uint8Array(1008), cells: scenario.cells, random: random() };
  const marker = scenario.cells[worldIndex(39, 29)].terrain;
  assert.deepEqual(growField(field, crop, context), { updated: true, expired: false });
  assert.deepEqual([field.bytes[29], field.bytes[30], field.bytes[31], field.bytes[20], field.bytes[21], field.bytes[33], field.bytes[34]],
    [0, 69, 83, 16, 13, 1, 1]);
  const data = new DataView(field.bytes.buffer, field.bytes.byteOffset, field.bytes.byteLength);
  assert.equal(data.getUint16(18, true), 500); // floor((2*floor(65535/47))*floor(278/6)/256).
  assert.equal(data.getUint16(16, true), 696);
  assert.equal(scenario.cells[worldIndex(39, 29)].terrain, marker);
  assert.equal(scenario.cells[worldIndex(41, 31)].terrain & 2047, 696);
  const after = field.bytes.slice();
  assert.deepEqual(growField(field, crop, context), { updated: false, expired: false });
  assert.deepEqual(field.bytes, after);
  scenario.regionalConditions.fill(0);
  assert.deepEqual(Uint8Array.from(input), original); // Buffer inputs must also be copied, never aliased into mutable state.
});

test('growth honors cold deficits, stage rounding, saturating accumulation and annual/perennial expiry', () => {
  const scenario = readScenario(source('SCEN0.SSM')), field = scenario.fields[1];
  const data = new DataView(field.bytes.buffer, field.bytes.byteOffset, field.bytes.byteLength);
  const context = { week: 0, temperature: 40, regions: new Uint8Array(1008), cells: scenario.cells, random: random() };
  growField(field, definition('grapes'), context);
  assert.equal(data.getUint16(38, true), 136);
  field.bytes[33] = 0; field.bytes[34] = 7;
  data.setUint16(18, 65534, true);
  const cell = scenario.cells[worldIndex(41, 31)]; cell.terrain = 0xf800 | 696;
  growField(field, definition('wheat'), context);
  assert.equal(data.getUint16(18, true), 65535);
  assert.equal(data.getUint16(16, true), 698);
  assert.equal(cell.terrain, 0xf800 | 698);
  field.bytes[33] = 0; field.bytes[34] = 12;
  assert.equal(growField(field, definition('corn'), context).expired, true);
  field.bytes[33] = 0; field.bytes[34] = 47;
  assert.equal(growField(field, definition('grapes'), context).expired, false);
});

test('water stress uses original tolerance modifiers, random consumption and byte wrap', () => {
  const field = readScenario(source('SCEN0.SSM')).fields[1], crop = definition('grapes'), rng = random();
  const data = new DataView(field.bytes.buffer, field.bytes.byteOffset, field.bytes.byteLength);
  assert.equal(waterStress(field, crop, rng), 0); assert.equal(rng.snapshot().simulation, 9029);
  data.setUint16(24, 0, true);
  assert.equal(waterStress(field, crop, rng), 130); // 9378 & 31 = 2; crop dry multiplier 1.
  data.setUint16(24, 28, true);
  assert.equal(waterStress(field, crop, rng), 145); // Upper bound is exclusive; next random low bits = 17.
});
