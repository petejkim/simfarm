import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { Binary } from '../src/formats/binary';
import { GameSimulation } from '../src/simulation/game';
import { dispatchFieldSchedule } from '../src/simulation/field-calendar';
import { describeScheduleEntry } from '../src/formats/field-schedule';
import { FarmRandom } from '../src/simulation/random';
import { updateTreatmentField } from '../src/simulation/field-treatment';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const original = readScenario(source(`SCEN${id}.SSM`));
  const definitions = original.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const snapshot = new GameSimulation(original, definitions).getSnapshot();
  const world = snapshot.scenario, crops = definitions.map(d => d.rawDefinition), prices = snapshot.cropMarketPrices;
  const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
  const runtime = { grassTravelCount: 0, animationTick: 0, notices: [] };
  return { world, crops, prices, random, runtime, run: () => dispatchFieldSchedule(world, crops, prices, random, runtime, 8) };
}
function oneField() {
  const context = setup();
  context.world.fields.slice(2).forEach(f => f.bytes[7] &= ~1);
  context.world.farm.calendar.month = 0; context.world.farm.calendar.week = 1;
  return context;
}

test('original work dispatcher confirms that scheduled plowing state has no work handler', () => {
  const exe = source('SIMFARM.EXE');
  assert.deepEqual([0, 1, 2].map(state => 0x17d30 + exe.readUInt16LE(0x18c98 + state * 2)), [0x18cb2, 0x18cb2, 0x18cb2]);
  assert.equal(exe.subarray(0x2f720, 0x2f726).toString('hex'), '26c687342402');
  assert.equal(exe.subarray(0x2f7d4, 0x2f7da).toString('hex'), '2680a73924fd');
});

test('actual saved plans dispatch crop orders and graphics correctly on all eight farms', () => {
  for (let id = 0; id < 8; id++) {
    const { world, run } = setup(id);
    // Use an original planting week in field slot 1; every active field retains its supplied plan.
    const week = world.schedule.column(0).findIndex(code => code >= 832 && code < 848);
    assert.ok(week >= 0 && week < 48);
    world.farm.calendar.month = week >> 2; world.farm.calendar.week = week & 3;
    const codes = world.fields.map(f => f.slot ? world.schedule.get(week, f.slot - 1) : 0);
    const originalPlan = Uint8Array.from(world.schedule.bytes);
    assert.equal(run().ok, true);
    assert.equal(world.fields[1].state, 3); assert.equal(world.fields[1].cropSlot, codes[1] - 832);
    for (const f of world.fields.filter(f => f.active)) {
      const entry = describeScheduleEntry(codes[f.slot]);
      if (entry.kind === 'crop-stage') assert.equal(f.state, 4);
      if (entry.kind === 'fallow') assert.equal(f.state, 0);
      if (entry.kind === 'plant') { assert.equal(f.state, 3); assert.equal(f.cropSlot, entry.cropSlot); }
    }
    assert.deepEqual(world.schedule.bytes, originalPlan);
  }
});

test('weekly cleanup precedes new orders, while January week zero skips it', () => {
  const { world, run } = oneField(), f = world.fields[1];
  f.bytes[2] = 3; f.bytes[3] = 0;
  world.schedule.set(1, 0, 915);
  const cash = world.farm.cash; assert.equal(run().ok, true);
  assert.equal(f.state, 6); assert.equal(f.step, 0); assert.equal(f.bytes[4], 4); assert.equal(f.bytes[5], 0);
  assert.equal(world.farm.cash, cash); // Calendar order doesn't buy chemicals yet.
  world.farm.calendar.week = 0; world.schedule.set(0, 0, 688);
  const before = Uint8Array.from(f.bytes); run(); assert.deepEqual(f.bytes, before);
});

test('calendar treatments defer payment to step zero and preserve all four state codes', () => {
  for (const [code, state] of [[915, 6], [914, 7], [913, 8], [912, 9]]) {
    const { world, crops, runtime, run } = oneField(), f = world.fields[1], cash = world.farm.cash;
    world.schedule.set(1, 0, code); run();
    assert.equal(f.state, state); assert.equal(f.step, 0); assert.equal(world.farm.cash, cash);
    updateTreatmentField(f, crops[f.cropSlot], world, runtime, 0, 8);
    assert.equal(f.step, 1); assert.equal(world.farm.cash, cash - 275);
  }
});

test('calendar crop contracts and both harvest order variants retain original guards and flags', () => {
  const { world, crops, run } = oneField(), f = world.fields[1], data = new Binary(f.bytes), definition = world.cropDefinitions[f.cropSlot];
  world.schedule.set(1, 0, 198); const count = definition.count;
  run(); assert.equal(data.u16(48), definition.price); assert.equal(definition.count, count + 1);
  run(); assert.equal(definition.count, count + 1);
  world.schedule.set(1, 0, 440); run(); assert.equal(f.state, 5); assert.equal(f.step, crops[f.cropSlot][57] === 1 ? 10 : 0);
  assert.equal(f.bytes[7] & 2, 2);
  // Week zero isolates order dispatch from completion of the preceding harvest.
  world.farm.calendar.week = 0; world.schedule.set(0, 0, 440); f.bytes[2] = 0; f.bytes[3] = 9;
  run(); assert.equal(f.state, 0); assert.equal(f.step, 9);
  world.schedule.set(0, 0, 231); run(); assert.equal(f.state, 5); assert.equal(f.step, 0); assert.equal(f.bytes[7] & 2, 0);
  world.schedule.set(0, 0, 852); run(); assert.equal(f.state, 2); assert.equal(f.step, 0);
});

test('failed scheduled seed acquisition stops later fields while preserving the failed field crop (SF-018)', () => {
  const { world, run, random } = setup(), f = world.fields[1], later = world.fields[2];
  world.farm.calendar.month = 0; world.farm.calendar.week = 1;
  world.farm.cash = 0;
  for (const field of world.fields.filter(f => f.active)) world.schedule.set(1, field.slot - 1, 832);
  const before = Uint8Array.from(f.bytes), after = Uint8Array.from(later.bytes), rng = random.snapshot();
  const result = run(); assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.fieldSlot, 1);
  assert.deepEqual(f.bytes, before); assert.deepEqual(later.bytes, after); assert.deepEqual(random.snapshot(), rng);
});

test('zero/unknown/graphic entries differ from fallow and never silently create work', () => {
  const { world, run } = oneField(), f = world.fields[1];
  for (const code of [0, 1, 2, 3, 65535, 688, 815]) {
    world.schedule.set(1, 0, code); const before = Uint8Array.from(f.bytes);
    run(); assert.deepEqual(f.bytes, before);
  }
  world.schedule.set(1, 0, 209); run(); assert.equal(f.state, 0);
  f.bytes[29] = 0; run(); assert.equal(f.bytes[29], 10); // Repeated fallow has a real soil effect.
});
