import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readNativeSave } from '../src/formats/native-save';
import { readIrrigation, addIrrigationSource } from '../src/formats/irrigation';
import { GameSimulation } from './support/game';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function fixture() {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  for (const cell of scenario.cells) { cell.terrain = 15; cell.overlay = 0x800; }
  for (const f of scenario.fields) f.bytes[7] &= ~1;
  for (const b of scenario.buildings) b.flags = 0;
  for (const e of scenario.equipment) e.flags = 0;
  for (const i of scenario.inventory) i.bytes[10] &= ~0x20;
  scenario.schedule.bytes.fill(0);
  const field = scenario.fields[1]; field.bytes[7] |= 1; field.bytes[2] = 4; field.bytes[3] = 0;
  field.bytes[10] = field.bytes[11] = 11; field.bytes[12] = field.bytes[13] = 8; field.bytes[14] = 0;
  field.equipment = field.pendingEquipment = 0; field.bytes[28] = 1; field.bytes[29] = 200; field.bytes[51] = field.bytes[52] = 0;
  for (let x = 11; x <= 19; x++) scenario.cells[worldIndex(x, 10)].terrain = 87;
  scenario.cells[worldIndex(9, 10)].terrain = 0x200f;
  scenario.irrigation.sourceCount = 0; scenario.irrigation.sources.fill(0);
  Object.assign(scenario.farm, { animationTicks: 0, timerTicks: 0, dayDelayTicks: 1000, cash: 100000 });
  return { scenario, crops };
}

test('purchased pumps drive original ditches and refresh field water then status at the recovered phases', () => {
  const { scenario, crops } = fixture(), game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'build', buildingType: 70, x: 10, y: 10 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  assert.deepEqual(Array.from(game.getSnapshot().scenario.irrigation.sources.slice(0, 3)), [10, 10, 64]);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(3);
  let s = game.getSnapshot(); assert.equal(s.scenario.irrigation.phase, 1); assert.equal(s.scenario.irrigation.active, true);
  assert.deepEqual(s.scenario.irrigation.flow, [{ x: 14, y: 10, strength: 60 }]);
  assert.equal(s.scenario.fields[1].bytes[51], 0); assert.equal(s.scenario.fields[1].bytes[28], 1);
  const text = game.save(4), restored = GameSimulation.load(text, crops).simulation;
  // Exposed snapshots own neither source registry nor queued packet objects.
  s.scenario.irrigation.sources.fill(0); s.scenario.irrigation.flow[0].strength = 1;
  assert.equal(game.save(4), text);
  for (const sim of [game, restored]) sim.tick(6);
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  s = game.getSnapshot(); assert.equal(s.scenario.irrigation.active, false);
  assert.equal(s.scenario.fields[1].bytes[51], 9); assert.equal(s.scenario.fields[1].bytes[28], 1); // Wet completion refreshes water only.
  for (const sim of [game, restored]) sim.tick(3);
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  s = game.getSnapshot(); assert.equal(s.scenario.irrigation.phase, 0);
  assert.equal(s.scenario.fields[1].bytes[51], 9); assert.equal(s.scenario.fields[1].bytes[28], 200); // Before dry traversal, status copies nutrient29.
  game.dispatch({ type: 'set-paused', paused: true }); const paused = game.save(4); game.tick(10000); assert.equal(game.save(4), paused);
});

test('special building purchases preserve source capacity, pump ownership exception and masked windmill pixels', () => {
  const { scenario, crops } = fixture(); scenario.cells[worldIndex(5, 5)].overlay = 0;
  const game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'build', buildingType: 70, x: 5, y: 5 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  game.dispatch({ type: 'build', buildingType: 71, x: 6, y: 5 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  const s = game.getSnapshot(); assert.equal(s.scenario.irrigation.sourceCount, 2);
  assert.deepEqual(Array.from(s.scenario.irrigation.sources.slice(0, 6)), [5, 5, 64, 6, 5, 48]);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const cell = s.scenario.cells[worldIndex(6 + x, 5 + y)];
    assert.equal(cell.terrain & 0x800, 0x800); assert.equal(cell.overlay, 0x800 | (1010 + y * 2 + x));
  }
  for (let i = 0; i < 64; i++) addIrrigationSource(scenario.irrigation, 0, i, 48);
  const full = new GameSimulation(scenario, crops), before = full.save(4);
  full.dispatch({ type: 'build', buildingType: 70, x: 5, y: 5 });
  assert.deepEqual(full.getSnapshot().lastBuildingResult, { ok: false, reason: 'no-water-source-slots' });
  assert.equal(full.save(4), before);
  const restored = GameSimulation.load(before, crops).simulation;
  assert.equal(restored.getSnapshot().scenario.irrigation.sourceCount, 64); assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(before));
});

test('v9 irrigation continuation is strict, while legacy1–8 migrate missing water state once', () => {
  const { scenario, crops } = fixture(), game = new GameSimulation(scenario, crops), save = JSON.parse(game.save(4));
  assert.equal(save.version, 17);
  for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const old = structuredClone(save); old.version = version; delete old.scenario.irrigation;
    const loaded = GameSimulation.load(JSON.stringify(old), crops).simulation;
    assert.deepEqual(loaded.getSnapshot().scenario.irrigation, readIrrigation(scenario.sourceBytes));
    assert.deepEqual(JSON.parse(GameSimulation.load(loaded.save(4), crops).simulation.save(4)), JSON.parse(loaded.save(4)));
  }
  for (const mutate of [(s: any) => { delete s.irrigation; }, (s: any) => { delete s.irrigation.phase; },
    (s: any) => { s.irrigation.sourceCount = 65; }, (s: any) => { s.irrigation.sources = '00'; },
    (s: any) => { s.irrigation.lastTick = 65536; }, (s: any) => { s.irrigation.phase = 2; },
    (s: any) => { s.irrigation.flow = [{ x: 0, y: 0, strength: 1 }]; },
    (s: any) => { s.irrigation.active = true; s.irrigation.flow = [{ x: 96, y: 0, strength: 1 }]; },
    (s: any) => { s.irrigation.active = true; s.irrigation.flow = [{ x: 0, y: 0, strength: 256 }]; }]) {
    const bad = structuredClone(save); mutate(bad.scenario);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /[Ii]rrigation/);
    assert.equal(game.save(4), JSON.stringify(save));
  }
});

test('player-dug ditches, road crossings and valves supply a field and preserve exact saved continuation', () => {
  const { scenario, crops } = fixture();
  for (let x = 11; x <= 19; x++) scenario.cells[worldIndex(x, 10)].terrain = x === 17 ? 161 : 15;
  const game = new GameSimulation(scenario, crops), before = game.getSnapshot();
  game.dispatch({ type: 'build', buildingType: 70, x: 10, y: 10 });
  for (let x = 11; x <= 19; x++) {
    game.dispatch({ type: 'irrigation', tool: 'ditch', x, y: 10 }); assert.ok(game.getSnapshot().lastIrrigationResult?.ok);
  }
  game.dispatch({ type: 'irrigation', tool: 'valve', x: 15, y: 10 }); assert.ok(game.getSnapshot().lastIrrigationResult?.ok);
  game.dispatch({ type: 'irrigation', tool: 'close-valve', x: 15, y: 10 });
  let s = game.getSnapshot(); assert.equal(s.scenario.cells[worldIndex(15, 10)].terrain & 0x7ff, 123);
  assert.equal(s.scenario.farm.cash, before.scenario.farm.cash - 1000 - 8 * 80 - 40 - 35);
  assert.equal(s.finances.annual.otherExpenses, before.finances.annual.otherExpenses + 715);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(3);
  const saved = game.save(4), restored = GameSimulation.load(saved, crops).simulation;
  assert.equal(restored.getSnapshot().lastIrrigationResult, null); // Presentation feedback is not game state.
  for (const sim of [game, restored]) sim.tick(6);
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  s = game.getSnapshot(); assert.equal(s.scenario.cells[worldIndex(16, 10)].terrain & 0x7ff, 88);
  assert.equal(s.scenario.fields[1].bytes[51], 4);
  for (const sim of [game, restored]) {
    sim.dispatch({ type: 'irrigation', tool: 'open-valve', x: 15, y: 10 });
    sim.tick(36);
  }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  assert.ok(game.getSnapshot().scenario.fields[1].bytes[51] > 4);
  const snapshot = game.getSnapshot(), unchanged = game.save(4);
  snapshot.scenario.cells[worldIndex(15, 10)].terrain = 15;
  snapshot.finances.accounts.otherDefinitions[1].price = 9999;
  assert.equal(game.save(4), unchanged);
});

test('irrigation commands reject without state changes and suspend during original financial choices', () => {
  const { scenario, crops } = fixture(), game = new GameSimulation(scenario, crops);
  const before = game.save(4); game.dispatch({ type: 'irrigation', tool: 'ditch', x: 12, y: 10 });
  assert.deepEqual(game.getSnapshot().lastIrrigationResult, { ok: false, reason: 'blocked-terrain' });
  assert.equal(game.save(4), before);
  for (const kind of ['town', 'default']) {
    const { state } = readNativeSave(before);
    if (kind === 'town') state.pendingTown = { phase: 'annual-reset', site: { ...state.finances.town.activeSite }, resumeRunning: false };
    else state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
    const sim = new GameSimulation(state.scenario, crops, state.random, state), frozen = sim.save(4);
    sim.dispatch({ type: 'irrigation', tool: 'ditch', x: 20, y: 10 });
    assert.equal(sim.getSnapshot().lastIrrigationResult, null); assert.equal(sim.save(4), frozen);
  }
});
