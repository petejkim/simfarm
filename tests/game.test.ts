import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from '../src/simulation/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function farm(id = 4) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  return { scenario, crops };
}

test('simulation owns game state, publishes stable detached snapshots, and pauses elapsed time', () => {
  const input = farm(), simulation = new GameSimulation(input.scenario, input.crops);
  const initial = simulation.getSnapshot(), cash = initial.scenario.farm.cash;
  assert.equal(simulation.getSnapshot(), initial);
  let notifications = 0;
  const unsubscribe = simulation.subscribe(() => notifications++);
  input.scenario.farm.cash = 0; initial.scenario.farm.cash = 1;
  input.scenario.fields[1].bytes[34] = 200; initial.scenario.fields[1].bytes[34] = 200;
  const equipmentFlags = initial.scenario.equipment[1].flags;
  input.scenario.equipment[1].flags = 0; initial.scenario.equipment[1].flags = 0;
  input.scenario.equipmentDefinitions[0].bytes[6] = 0; initial.scenario.equipmentDefinitions[0].bytes[6] = 0;
  const buildingFlags = initial.scenario.buildings[1].flags;
  input.scenario.buildings[1].flags = 0; initial.scenario.buildings[1].flags = 0;
  input.scenario.buildingDefinitions[0].bytes[8] = 0; initial.scenario.buildingDefinitions[0].bytes[8] = 0;
  input.scenario.animals[1].flags = 0x20; initial.scenario.animals[1].flags = 0x20;
  simulation.tick(5000); assert.equal(notifications, 0);
  simulation.dispatch({ type: 'set-paused', paused: false });
  assert.equal(simulation.getSnapshot().scenario.farm.cash, cash);
  assert.equal(simulation.getSnapshot().scenario.fields[1].bytes[34], 0);
  assert.equal(simulation.getSnapshot().scenario.equipment[1].flags, equipmentFlags);
  assert.equal(simulation.getSnapshot().scenario.equipmentDefinitions[0].price, 400);
  assert.equal(simulation.getSnapshot().scenario.buildings[1].flags, buildingFlags);
  assert.equal(simulation.getSnapshot().scenario.buildingDefinitions[0].width, 1);
  assert.equal(simulation.getSnapshot().scenario.animals[1].active, false);
  simulation.tick(900); assert.equal(simulation.getSnapshot().daysAdvanced, 0);
  simulation.tick(100); assert.equal(simulation.getSnapshot().daysAdvanced, 1);
  assert.equal(simulation.getSnapshot().scenario.fields[1].bytes[34], 1); // Sunday-to-Monday month boundary.
  simulation.dispatch({ type: 'set-paused', paused: true });
  const paused = simulation.getSnapshot();
  simulation.tick(5000); assert.equal(simulation.getSnapshot(), paused);
  unsubscribe(); const count = notifications;
  simulation.dispatch({ type: 'advance-day' }); assert.equal(notifications, count);
  assert.equal(simulation.getSnapshot().daysAdvanced, 2);
  assert.throws(() => simulation.tick(-1), /elapsed/);
});

test('manual and timed schedules produce the same crop, climate and calendar state', () => {
  const input = farm(), manual = new GameSimulation(input.scenario, input.crops), timed = new GameSimulation(input.scenario, input.crops);
  for (let i = 0; i < 100; i++) manual.dispatch({ type: 'advance-day' });
  timed.dispatch({ type: 'set-paused', paused: false }); timed.tick(100000);
  const a = manual.getSnapshot(), b = timed.getSnapshot();
  assert.deepEqual(a.scenario, b.scenario); assert.deepEqual(a.weather, b.weather);
  assert.equal(a.scenario.fields[1].state, 0); // Original corn has expired by now.
  assert.equal(input.scenario.fields[1].state, 4);
});

test('all eight original farms advance a year without invalid terrain or missing crop state', () => {
  for (let i = 0; i < 8; i++) {
    const input = farm(i), game = new GameSimulation(input.scenario, input.crops);
    game.dispatch({ type: 'set-paused', paused: false }); game.tick(336000);
    const snapshot = game.getSnapshot();
    assert.deepEqual(snapshot.scenario.farm.calendar, { ...input.scenario.farm.calendar, year: 1994 });
    assert.equal(snapshot.daysAdvanced, 336);
    assert.ok(snapshot.scenario.cells.every(c => Number.isInteger(c.terrain) && c.terrain >= 0 && c.terrain <= 65535));
    assert.ok(Number.isFinite(snapshot.weather.temperature));
  }
});

test('the fifth year-end retains the original temperature-table overread into wind (SF-007)', () => {
  const input = farm();
  input.scenario.farm.calendar = { day: 6, week: 3, month: 11, year: 1993, season: 0 };
  input.scenario.climate.temperature.fill(70); input.scenario.climate.wind.fill(12);
  const game = new GameSimulation(input.scenario, input.crops);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick((336 * 4 + 1) * 1000);
  const snapshot = game.getSnapshot();
  assert.equal(snapshot.scenario.farm.calendar.year, 1998);
  assert.equal(snapshot.weather.temperatureYear, 0);
  assert.equal(snapshot.weather.temperature, 12);
});
