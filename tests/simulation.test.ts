import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { CALENDAR_OFFSET } from '../src/formats/scenario-state';
import { advanceCalendarDay, type FarmCalendar } from '../src/simulation/calendar';
import { FarmRandom } from '../src/simulation/random';
import { changeFieldCondition } from '../src/simulation/field-conditions';
import { growField, waterStress } from '../src/simulation/field-growth';
import { updateFieldStatus, writeFieldBadge } from '../src/simulation/field-status';
import { clearFieldCrop, updateGrowingField } from '../src/simulation/field-lifecycle';

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

test('field conditions retain saturation, resistance and corrected regional subtraction', () => {
  const field = readScenario(source('SCEN0.SSM')).fields[1], crop = definition('grapes');
  const regions = new Uint8Array(1008), region = (5 * 12 + 4) * 7;
  field.bytes[20] = 250;
  changeFieldCondition(field, crop, regions, 9, 64);
  assert.equal(field.bytes[20], 255); assert.equal(regions[region + 2], 16);
  regions[region + 6] = 5;
  changeFieldCondition(field, crop, regions, 13, 8);
  assert.equal(field.bytes[29], 0); assert.equal(regions[region + 6], 0);
  regions[region + 6] = 20;
  changeFieldCondition(field, crop, regions, 13, 8);
  assert.equal(regions[region + 6], 12);
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

test('field badges preserve flags, use original quadrant ordering and erase from the following rows', () => {
  const scenario = readScenario(source('SCEN0.SSM')), field = scenario.fields[1];
  const x = field.x + 2, y = field.y;
  for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) {
    scenario.cells[worldIndex(x + dx, y + dy)].terrain = 0xa800 | (696 + dy * 2 + dx);
  }
  writeFieldBadge(field, scenario.cells, 1, 19);
  assert.deepEqual([0, 1].flatMap(dy => [0, 1].map(dx => scenario.cells[worldIndex(x + dx, y + dy)].terrain)),
    [615, 616, 617, 618].map(t => 0xa800 | t));
  writeFieldBadge(field, scenario.cells, 1, -1);
  assert.deepEqual([0, 1].flatMap(dy => [0, 1].map(dx => scenario.cells[worldIndex(x + dx, y + dy)].terrain)),
    [700, 701, 702, 703].map(t => 0xa800 | t));
});

test('status refresh samples fertility, cycles pest warnings and retains overwritten toxicity flags', () => {
  const scenario = readScenario(source('SCEN0.SSM')), field = scenario.fields[1], crop = definition('grapes');
  const f = new DataView(field.bytes.buffer), b = field.bytes;
  f.setUint16(24, 0, true); b[29] = 90; b[32] = 129; b[20] = b[21] = b[22] = 53;
  b[56] = 0;
  for (const badge of [21, 16, 20, 21]) {
    assert.equal(updateFieldStatus(field, crop, scenario.cells), 0xbd);
    assert.equal(b[28], 90);
    assert.equal(scenario.cells[worldIndex(field.x + 6, field.y)].terrain & 2047, 539 + badge * 4);
  }
  // SF-006: the exact upper limit now displays the stress growth applies.
  f.setUint16(24, 28, true);
  assert.equal(updateFieldStatus(field, crop, scenario.cells) & 10, 2);
  assert.notEqual(waterStress(field, crop, random()), 0);
  f.setUint16(24, 29, true);
  assert.equal(updateFieldStatus(field, crop, scenario.cells) & 10, 2);
  const before = field.bytes.slice(), terrain = scenario.cells.map(c => c.terrain);
  f.setUint16(42, 1, true); before[42] = 1;
  assert.equal(updateFieldStatus(field, crop, scenario.cells), 0);
  assert.deepEqual(field.bytes, before); assert.deepEqual(scenario.cells.map(c => c.terrain), terrain);
});

test('an original corn field grows through expiry, returns fertility and clears crop tiles and warnings', () => {
  const scenario = readScenario(source('SCEN4.SSM')), field = scenario.fields[1], crop = definition('corn');
  const context = { week: 0, temperature: 75, regions: scenario.regionalConditions, cells: scenario.cells, random: random() };
  const view = new DataView(field.bytes.buffer);
  const cropBadge = scenario.cells[worldIndex(field.x, field.y)].terrain;
  field.bytes[29] = 200;
  updateGrowingField(field, crop, context);
  assert.equal(field.bytes[28], 200); // Sampled before this week's depletion.
  for (let week = 1; week <= crop[56]; week++) {
    context.week = week % 4;
    const result = updateGrowingField(field, crop, context);
    assert.equal(result.expired, week === crop[56]);
    if (!result.expired) assert.equal(field.state, 4);
  }
  assert.equal(field.state, 0); assert.equal(field.step, 0);
  assert.equal(view.getUint16(18, true), 0); assert.equal(view.getUint16(54, true), 0);
  assert.equal(scenario.cells[worldIndex(field.x, field.y)].terrain, cropBadge);
  for (let x = field.x; x < field.x + field.width; x++) for (let y = field.y; y < field.y + field.height; y++) {
    const tile = scenario.cells[worldIndex(x, y)].terrain & 2047;
    assert.ok(tile < 688 || tile > 815);
  }
  assert.equal(scenario.cells[worldIndex(field.x + 2, field.y)].terrain & 2047, 34);
  assert.ok(field.bytes[29] >= 70);
  const nutrient = field.bytes[29];
  clearFieldCrop(field, crop, scenario.regionalConditions, scenario.cells);
  assert.equal(field.bytes[29], Math.min(255, nutrient + 10));
  assert.deepEqual(updateGrowingField(field, crop, context), { updated: false, expired: false });
});


test('all five regional reductions saturate across the complete byte domain', () => {
  const field=readScenario(source('SCEN0.SSM')).fields[1],crop=definition('grapes'),regions=new Uint8Array(1008);
  const base=(5*12+4)*7;
  for(const [mode,channel,offset] of [[2,5,32],[6,3,22],[8,2,20],[10,4,21],[13,6,29]]) {
    regions.fill(71);
    for(let current=0;current<256;current++)for(let amount=0;amount<256;amount++) {
      regions[base+channel]=current;field.bytes[offset]=current;
      changeFieldCondition(field,crop,regions,mode,amount);
      assert.equal(regions[base+channel],Math.max(0,current-amount));
      assert.equal(field.bytes[offset],Math.max(0,current-amount));
    }
    regions[base+channel]=71;assert.ok(regions.every(n=>n===71));
  }
});


test('water warnings match growth word thresholds and signed-water boundaries for every crop', () => {
  const world=readScenario(source('SCEN0.SSM')),field=world.fields[1],view=new DataView(field.bytes.buffer,field.bytes.byteOffset,field.bytes.length);
  field.bytes[2]=4;view.setUint16(42,0,true);
  const definitions=readdirSync(new URL('../../simfarm-dos/CROPS/',import.meta.url)).filter(n=>n.toLowerCase().endsWith('.crp')).map(n=>readCrop(n,source(`CROPS/${n}`)).rawDefinition);
  const custom=Array.from(definition('grapes'));custom[40]=200;custom[41]=1;custom[42]=250;custom[43]=1;definitions.push(custom);
  for(const crop of definitions) {
    for(const dry of [0,1,63,64,127,128,255])for(const wet of [0,1,63,64,127,128,255]) {
      field.bytes[51]=dry;field.bytes[52]=wet;
      const lower=Math.max(0,(crop[40]+crop[41]*256)-dry*2),upper=crop[42]+crop[43]*256+wet*2;
      for(const raw of new Set([0,27,28,29,127,128,32767,32768,65535,lower-1,lower,upper-1,upper])) {
        if(raw<0||raw>65535)continue;view.setUint16(24,raw,true);
        const water=raw>=32768?raw-65536:raw,expected=water<lower?8:water>=upper?2:0;
        assert.equal(updateFieldStatus(field,crop as readonly number[],world.cells)&10,expected);
        const rng=random(),before=rng.snapshot();waterStress(field,crop as readonly number[],rng);
        assert.equal(rng.snapshot().simulation===before.simulation,expected===0);
      }
    }
  }
});
