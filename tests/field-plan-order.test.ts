import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { recordFieldPlanOrder, type FieldPlanOrder } from '../src/simulation/field-plan-order';
import { GameSimulation } from '../src/simulation/game';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const world = readScenario(source(`SCEN${id}.SSM`));
  const definitions = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const crops = definitions.map(c => c.rawDefinition);
  return { world, crops, definitions, record: (order: FieldPlanOrder, offset = 0) => recordFieldPlanOrder(world, crops, 1, order, offset) };
}

test('manual-order jump table, zero-offset callers and full-column writer match source', () => {
  const exe = source('SIMFARM.EXE');
  assert.deepEqual(Array.from({ length: 10 }, (_, i) => 0x2cf40 + exe.readUInt16LE(0x2ff96 + i * 2)),
    [0x2fd8e, 0x2fd94, 0x2ffaa, 0x2ffaa, 0x2fb78, 0x2fc1a, 0x2fc96, 0x2ffaa, 0x2ffaa, 0x2fd12]);
  for (const offset of [0x23f5e, 0x2400c, 0x26cdb, 0x26db8, 0x26e47, 0x26ee3, 0x26f73]) {
    assert.equal(exe.subarray(offset, offset + 2).toString('hex'), '6a00');
  }
  assert.equal(exe.subarray(0x2ff7d, 0x2ff84).toString('hex'), '6a009ab811e624');
  assert.equal(exe.subarray(0x2fdac, 0x2fdb7).toString('hex'), '8b76f2c1e607268a84c6c5'); // Byte +26.
});

test('manual annual planting resets history to fallow and repeats the new crop through five years', () => {
  const { world, record } = setup();
  world.farm.calendar.month = 2; world.farm.calendar.week = 3;
  const before = Uint8Array.from(world.schedule.bytes), fields = world.fields.map(f => Uint8Array.from(f.bytes));
  assert.equal(record({ kind: 'plant', cropSlot: 0 }), true);
  const plan = world.schedule.column(0);
  assert.deepEqual(plan.slice(0, 11), Array(11).fill(209));
  const corn = [832, 688, 688, 689, 689, 690, 690, 691, 691, 692, 692, 693, 693, 440];
  assert.deepEqual(plan.slice(11, 39), [...corn, ...corn]);
  for (let week = 0; week < 240; week++) {
    assert.deepEqual(world.schedule.bytes.slice(week * 196 + 2, (week + 1) * 196), before.slice(week * 196 + 2, (week + 1) * 196));
  }
  world.fields.forEach((f, i) => assert.deepEqual(f.bytes, fields[i]));
});

test('all supplied perennial definitions use their fixed harvest weeks and six-week seasonal graphic stages', () => {
  for (const [file, harvest] of [['ALMONDS', 31], ['APPLES', 44], ['GRAPES', 36], ['ORANGES', 34]] as const) {
    const { world, crops, record } = setup();
    crops[0] = readCrop(file, source(`CROPS/${file}.CRP`)).rawDefinition;
    assert.equal(crops[0][76], harvest);
    world.farm.calendar.month = 0; world.farm.calendar.week = 0;
    record({ kind: 'plant', cropSlot: 0 });
    assert.equal(world.schedule.get(0, 0), 832);
    for (let year = 0; year < 5; year++) {
      assert.equal(world.schedule.get(year * 48 + harvest, 0), 440);
      assert.equal(world.schedule.get(year * 48 + harvest - 1, 0), 695);
      assert.equal(world.schedule.get(year * 48 + harvest + 1, 0), 688);
    }
    assert.equal(world.schedule.get(harvest + 6, 0), 689);
    // The initial planting word survives even when planting on the fixed harvest week.
    world.farm.calendar.month = harvest >> 2; world.farm.calendar.week = harvest & 3;
    record({ kind: 'plant', cropSlot: 0 }); assert.equal(world.schedule.get(harvest, 0), 832);
  }
});

test('treatments protect occupied order words but replace graphics, unknowns and other treatments; plow is unconditional', () => {
  const { world, record } = setup();
  world.farm.calendar.month = 11; world.farm.calendar.week = 3;
  const protectedWords = [1, 2, 3, 198, 440, 852, ...Array.from({ length: 16 }, (_, i) => 832 + i)];
  for (const [kind, code] of [['fertilizer', 915], ['pesticide', 914], ['fungicide', 912], ['herbicide', 913]] as const) {
    for (const previous of [...protectedWords, 0, 198 - 1, 209, 231, 688, 815, 831, 848, 912, 913, 914, 915, 65535]) {
      world.schedule.set(47, 0, previous);
      const before = Uint8Array.from(world.schedule.bytes), blocked = protectedWords.includes(previous);
      assert.equal(record({ kind }), !blocked);
      assert.equal(world.schedule.get(47, 0), blocked ? previous : code);
      world.schedule.set(47, 0, previous); assert.deepEqual(world.schedule.bytes, before);
    }
  }
  world.schedule.set(47, 0, 832); record({ kind: 'plow' }); assert.equal(world.schedule.get(47, 0), 852);
  record({ kind: 'fertilizer' }, 1); assert.equal(world.schedule.get(48, 0), 915); // Week offset crosses year.
});

test('manual plan generator preserves signed-byte offset and perennial restart arithmetic with atomic guards', () => {
  const { world, crops, record } = setup();
  world.farm.calendar.month = 0; world.farm.calendar.week = 0;
  crops[0][26] = 255; crops[0][27] = 42;
  record({ kind: 'plant', cropSlot: 0 });
  assert.deepEqual(world.schedule.column(0).slice(0, 6), [832, 687, 687, 688, 688, 689]);
  crops[0][62] |= 1; crops[0][18] = 1;
  record({ kind: 'plant', cropSlot: 0 });
  assert.deepEqual(world.schedule.column(0).slice(13, 18), [440, 687, 688, 688, 689]);
  const original = [...crops[0]];
  for (const [offset, value] of [[56, 48], [56, 1], [66, 0], [18, 128], [18, 127]]) {
    crops[0] = [...original]; crops[0][offset] = value;
    const before = Uint8Array.from(world.schedule.bytes);
    assert.throws(() => record({ kind: 'plant', cropSlot: 0 })); assert.deepEqual(world.schedule.bytes, before);
  }
  for (const offset of [-1, 128, 0.5, NaN]) assert.throws(() => record({ kind: 'plow' }, offset));
  for (const slot of [0, -1, 98, NaN]) assert.throws(() => recordFieldPlanOrder(world, crops, slot, { kind: 'plow' }));
});

test('manual game planting and treatment update checkpointed plans, while failures preserve plans', () => {
  for (let id = 0; id < 8; id++) {
    const { world, definitions } = setup(id), game = new GameSimulation(world, definitions);
    const week = world.farm.calendar.month * 4 + world.farm.calendar.week;
    game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
    assert.equal(game.getSnapshot().lastPlantResult?.ok, true);
    assert.equal(game.getSnapshot().scenario.schedule.get(week, 0), 832);
    const plan = Uint8Array.from(game.getSnapshot().scenario.schedule.bytes);
    game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 1 });
    assert.equal(game.getSnapshot().lastPlantResult?.ok, false);
    assert.deepEqual(game.getSnapshot().scenario.schedule.bytes, plan);
    const loaded = GameSimulation.load(game.save(id), definitions).simulation;
    assert.deepEqual(loaded.getSnapshot().scenario.schedule.bytes, plan);
  }
  const { world, definitions } = setup(0), week = world.farm.calendar.month * 4 + world.farm.calendar.week;
  world.schedule.set(week, 0, 696);
  const game = new GameSimulation(world, definitions);
  game.dispatch({ type: 'treat-field', fieldSlot: 1, treatment: 'fertilizer' });
  assert.equal(game.getSnapshot().lastTreatmentResult?.ok, true);
  assert.equal(game.getSnapshot().scenario.schedule.get(week, 0), 915);
});

test('new fields receive a full original crop plan only after successful creation', () => {
  const { world, definitions } = setup(), game = new GameSimulation(world, definitions);
  game.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 });
  game.dispatch({ type: 'set-auto-clear', enabled: true });
  game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  const snapshot = game.getSnapshot(), result = snapshot.lastNewFieldResult;
  assert.ok(result?.ok);
  const week = snapshot.scenario.farm.calendar.month * 4 + snapshot.scenario.farm.calendar.week;
  assert.equal(snapshot.scenario.schedule.get(week, result.slot - 1), 832);
  assert.equal(snapshot.scenario.schedule.get(week + 13, result.slot - 1), 440);
  game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 1 });
  assert.equal(game.getSnapshot().lastNewFieldResult?.ok, false);
  assert.deepEqual(game.getSnapshot().scenario.schedule.bytes, snapshot.scenario.schedule.bytes);
});
