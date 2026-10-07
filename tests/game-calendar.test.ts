import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function setup(id = 4) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { scenario, crops };
}

test('original calendar dispatches before month normalization and year projection', () => {
  const exe = source('SIMFARM.EXE');
  assert.equal(exe.subarray(0xc920, 0xc925).toString('hex'), '26ff065212');
  assert.equal(exe.subarray(0xcbbd, 0xcbc2).toString('hex'), '9aec0fe624');
  assert.equal(exe.subarray(0xcc10, 0xcc17).toString('hex'), '26c70652120000');
  assert.equal(exe.subarray(0xcdfe, 0xce03).toString('hex'), '9a3210e624');
  assert.equal(exe.subarray(0x27060 + 0xfec + 3, 0x27060 + 0xfec + 10).toString('hex'), 'ea2a27ce270300');
});

test('month boundary force-completes work before new orders and pays scheduled treatment only on its next tick', () => {
  const { scenario, crops } = setup();
  scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar, { month: 3, week: 3, day: 6 });
  scenario.schedule.set(16, 0, 915);
  const game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'plant-field', fieldSlot: 2, cropSlot: 0 });
  const before = game.getSnapshot(), cost = before.scenario.farm.chemicalExpenses;
  game.dispatch({ type: 'advance-day' });
  const ordered = game.getSnapshot();
  assert.deepEqual(ordered.scenario.farm.calendar, { ...scenario.farm.calendar, month: 4, week: 0, day: 0 });
  assert.equal(ordered.scenario.fields[2].state, 4);
  assert.equal(ordered.scenario.fields[2].equipment, 0);
  assert.equal(ordered.scenario.fields[1].state, 6); assert.equal(ordered.scenario.fields[1].step, 0);
  assert.equal(ordered.scenario.farm.chemicalExpenses, cost);
  assert.deepEqual(ordered.lastScheduleResult, { ok: true });
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(1000 / scenario.farm.dayDelayTicks);
  assert.equal(game.getSnapshot().scenario.fields[1].step, 1);
  assert.equal(game.getSnapshot().scenario.farm.chemicalExpenses, cost + 275);
  game.tick(1000 / scenario.farm.dayDelayTicks);
  assert.equal(game.getSnapshot().scenario.farm.chemicalExpenses, cost + 275);
});

test('year-end dispatches row 48 once, completes pending work, and projects using the newly selected crop', () => {
  const { scenario, crops } = setup();
  scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar, { month: 11, week: 3, day: 6 });
  scenario.schedule.set(0, 0, 915); // Must not dispatch January row zero before the shift.
  scenario.schedule.set(48, 0, 833);
  scenario.schedule.set(49, 0, 688);
  scenario.schedule.set(239, 97, 54321);
  const f = scenario.fields[2]; f.bytes[2] = 6; f.bytes[3] = 0; f.bytes[4] = 4; f.bytes[29] = 0;
  const game = new GameSimulation(scenario, crops), before = game.getSnapshot();
  game.dispatch({ type: 'advance-day' });
  const pending = game.getSnapshot(); assert.ok(pending.pendingTown);
  assert.equal(pending.scenario.farm.seedExpenses, before.scenario.farm.seedExpenses + before.scenario.seedDefinitions[1].price + 20);
  assert.equal(pending.scenario.fields[2].bytes[29], 255); // Completion precedes the chooser and daily growth.
  game.dispatch({ type: 'choose-town', choice: 'residential' });
  const after = game.getSnapshot();
  assert.equal(after.scenario.farm.calendar.year, 1994);
  assert.equal(after.scenario.fields[1].state, 3); assert.equal(after.scenario.fields[1].cropSlot, 1);
  assert.equal(after.scenario.farm.seedExpenses, 0); // Annual reset follows the chooser.
  assert.equal(after.scenario.fields[2].state, 4); assert.equal(after.scenario.fields[2].bytes[29], 245); // Full effect, then weekly growth.
  assert.equal(after.scenario.schedule.get(0, 0), 833); assert.equal(after.scenario.schedule.get(1, 0), 696);
  assert.equal(after.scenario.schedule.get(239, 97), 54321);
  const restored = GameSimulation.load(game.save(4), crops).simulation;
  game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' });
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  assert.equal(game.getSnapshot().scenario.farm.seedExpenses, after.scenario.farm.seedExpenses);
});

test('weekly seed failure stops later orders, reports the field, and does not retry between boundaries', () => {
  const { scenario, crops } = setup();
  scenario.schedule.bytes.fill(0); scenario.farm.cash = 0;
  Object.assign(scenario.farm.calendar, { month: 0, week: 0, day: 6 });
  scenario.schedule.set(1, 0, 832); scenario.schedule.set(1, 1, 915);
  const game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'advance-day' });
  assert.deepEqual(game.getSnapshot().lastScheduleResult, { ok: false, fieldSlot: 1, reason: 'insufficient-funds' });
  assert.equal(game.getSnapshot().scenario.fields[1].state, 4);
  assert.equal(game.getSnapshot().scenario.fields[2].state, 4);
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.farm.seedExpenses, 0);
  const view = game.getSnapshot().lastScheduleResult;
  if (view && !view.ok) view.fieldSlot = 97;
  game.dispatch({ type: 'advance-day' });
  assert.deepEqual(game.getSnapshot().lastScheduleResult, { ok: false, fieldSlot: 1, reason: 'insufficient-funds' });
});

test('year projection sees a perennial-to-annual crop change from the week-48 order', () => {
  const { scenario, crops } = setup(0);
  assert.equal(crops[scenario.fields[1].cropSlot].rawDefinition[62] & 1, 1); // Original grapes.
  scenario.schedule.bytes.fill(0);
  scenario.schedule.set(48, 0, 834); // Original barley slot 2, with no harvest marker for the old grapes.
  Object.assign(scenario.farm.calendar, { month: 11, week: 3, day: 6 });
  const game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'advance-day' });
  assert.ok(game.getSnapshot().pendingTown);
  game.dispatch({ type: 'choose-town', choice: 'residential' });
  const after = game.getSnapshot();
  assert.equal(after.scenario.fields[1].cropSlot, 2);
  assert.deepEqual([0, 1, 35, 36, 200, 239].map(week => after.scenario.schedule.get(week, 0)), [834, 704, 440, 834, 707, 708]);
  // Projecting before dispatch would search for a grape harvest, find none, and leave weeks 192+ fallow.
});

test('an unmodified original plan automatically harvests, stores and replants without manual field orders', () => {
  const { scenario, crops } = setup(), game = new GameSimulation(scenario, crops);
  for (let day = 0; day < 78; day++) game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.fields[1].state, 5); // Original week 27 harvest.
  for (let day = 78; day < 85; day++) game.dispatch({ type: 'advance-day' });
  const planted = game.getSnapshot();
  assert.equal(planted.scenario.fields[1].state, 3); // Original week 28 planting.
  assert.ok(planted.scenario.inventory.some(i => i.active && i.type === 168));
  assert.equal(planted.scenario.farm.seedExpenses, 4 * (planted.scenario.seedDefinitions[0].price + 20));
  const item = planted.scenario.inventory.find(i => i.active && i.type === 168 && planted.storedHarvestValues[i.slot]! > 0)!;
  assert.ok(item);
  const cash = planted.scenario.farm.cash, value = planted.storedHarvestValues[item.slot]!;
  game.dispatch({ type: 'sell-harvest', inventorySlot: item.slot });
  assert.equal(game.getSnapshot().scenario.farm.cash, cash + value);
});

test('edited crop and treatment plans survive checkpoints and execute only at the selected boundaries', () => {
  const { scenario, crops } = setup(), game = new GameSimulation(scenario, crops), initial = game.getSnapshot();
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: 16, action: { kind: 'plant', cropSlot: 15 } });
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: 17, action: { kind: 'fertilizer' } });
  const edited = game.getSnapshot();
  assert.deepEqual(edited.scenario.fields[1].bytes, initial.scenario.fields[1].bytes);
  assert.equal(edited.scenario.farm.cash, initial.scenario.farm.cash);
  assert.equal(edited.scenario.schedule.get(16, 0), 847); assert.equal(edited.scenario.schedule.get(17, 0), 915);
  const restored = GameSimulation.load(game.save(4), crops).simulation;
  for (const sim of [game, restored]) sim.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.fields[1].state, 3);
  assert.equal(game.getSnapshot().scenario.fields[1].cropSlot, 15);
  for (let i = 0; i < 7; i++) for (const sim of [game, restored]) sim.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.fields[1].state, 6);
  assert.equal(game.getSnapshot().scenario.fields[1].step, 0);
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
});

test('clear-plan commands suppress future work and invalid edits leave serialized simulation state intact', () => {
  const { scenario, crops } = setup(), game = new GameSimulation(scenario, crops);
  const before = game.save(4);
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: 15, action: { kind: 'plant', cropSlot: 0 } });
  assert.equal(game.save(4), before);
  assert.deepEqual(game.getSnapshot().lastPlanEditResult, { ok: false, fieldSlot: 1, week: 15, reason: 'future-week-required' });
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: 16, action: { kind: 'clear' } });
  const detached = game.getSnapshot();
  assert.ok(detached.scenario.schedule.column(0).slice(16).every(word => word === 209));
  detached.scenario.schedule.bytes.fill(255);
  if (detached.lastPlanEditResult) detached.lastPlanEditResult.week = 100;
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.fields[1].state, 0);
  assert.equal(game.getSnapshot().scenario.schedule.get(16, 0), 209);
  assert.equal(game.getSnapshot().lastPlanEditResult?.week, 16);
});
