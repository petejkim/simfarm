import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../src/simulation/game';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { newFarmAssets, newFarmOptions } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n)).map(n => readCrop(n.slice(0,-4).toLowerCase(), source('CROPS/' + n)));
const layouts = newFarmAssets.townLayouts;
const cold = () => new GameSimulation(readScenario(source('SCEN0.SSM')), crops, layouts);
const parsed = (g: GameSimulation) => JSON.parse(g.save(null));

test('original import retains runtime history, RNG, weather, traffic and timers while replacing source farm data', () => {
  const prior = readNativeSave(cold().save(null)).state;
  prior.scenario.farm.workerExpenses = 0xfedcba98; prior.finances.accounts.buildingBookValue = 45678;
  prior.finances.debt.balanceDue = 123; prior.finances.debt.balanceCountdown = 7;
  prior.weather.wind = 27; prior.weather.moistureBalance = -5; prior.weather.temperatureAnomaly = 19;
  prior.market.history[0][0] = 4321; prior.market.mood = 2; prior.market.rawBC72 = 250;
  prior.animalFrame.lastMoveTick = 456; prior.grassTravelCount = 731; prior.dayTicks = 17;
  prior.scenario.farm.timerTicks = 123; prior.scenario.farm.animationTicks = 60000;
  prior.traffic.lastTick = 65000; prior.disasters.frameDelay = 47;
  const old = GameSimulation.load(writeNativeSave(prior, null), crops, layouts).simulation, before = old.save(null);
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), file = readScenario(bytes), next = old.importOriginal(bytes, crops).simulation;
    const saved = parsed(next), state = readNativeSave(next.save(null)).state;
    assert.equal(saved.version, 23); assert.equal(saved.scenarioId, null); assert.equal(saved.scenario.origin, 'original');
    assert.equal(saved.scenario.source, bytes.toString('hex')); assert.equal(saved.runtime.retainedSetup, null);
    assert.equal(saved.scenario.farm.workerExpenses, 0xfedcba98); assert.equal(state.finances.accounts.buildingBookValue, 45678);
    assert.equal(state.finances.debt.balanceDue, 123); assert.deepEqual(state.scenario.climate, file.climate);
    assert.deepEqual(state.scenario.cells, file.cells); assert.deepEqual(state.scenario.farm.calendar, file.farm.calendar);
    assert.deepEqual(state.random, prior.random); assert.deepEqual(state.weather, { ...prior.weather, precipitationDays: file.farm.precipitationDays });
    assert.deepEqual(state.animalFrame, prior.animalFrame); assert.equal(state.grassTravelCount, 731);
    assert.deepEqual(state.traffic, { ...prior.traffic, delay: bytes.readUInt16LE(0x2171e) });
    assert.equal(state.disasters.frameDelay, 47); assert.equal(state.market.history[0][0], 4321); assert.equal(state.market.mood, 2); assert.equal(state.market.rawBC72, 250);
    assert.equal(state.dayTicks, (file.farm.animationTicks - ((60000 - 17) & 65535)) & 65535);
    state.crops.forEach((c, slot) => assert.equal(state.market.history[slot][29], c[34] | c[35] << 8));
    assert.equal(old.save(null), before); next.getSnapshot().scenario.cells[0].terrain = 0;
    assert.equal(old.save(null), before);
  }
});

test('loaded depth one applies source pacing and imported overdue day phase advances and checkpoints exactly', () => {
  const old = cold(); old.dispatch({ type: 'set-paused', paused: false }); old.tick(50);
  const bytes = Buffer.from(source('SCEN6.SSM')); bytes[0x21718] = 0; bytes[0x21719] = 1;
  const imported = old.importOriginal(bytes, crops).simulation;
  let s = parsed(imported);
  assert.equal(s.scenario.farm.dayDelayTicks, 256); assert.equal(s.scenario.farm.speed, 1);
  assert.equal(s.scenario.irrigation.delay, 2); assert.equal(s.runtime.traffic.delay, 16); assert.equal(s.runtime.disasters.frameDelay, 4);
  assert.equal(s.runtime.paused, true); assert.equal(s.runtime.elapsed, 0);
  assert.equal(s.scenario.farm.paceEquipment, true);
  assert.equal(cold().importOriginal(bytes, crops).simulation.getSnapshot().scenario.farm.paceEquipment, true);
  s.runtime.dayTicks = 300; s.runtime.traffic.records[0][1] = 213;
  const a = GameSimulation.load(JSON.stringify(s), crops, layouts).simulation, b = GameSimulation.load(a.save(null), crops, layouts).simulation;
  const before = a.getSnapshot().daysAdvanced;
  a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' });
  assert.equal(a.getSnapshot().daysAdvanced, before + 1); assert.deepEqual(parsed(a), parsed(b));
  for (let day = 0; day < 7; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(parsed(a), parsed(b));
  s = parsed(a); s.runtime.dayTicks = 65535;
  const wrapped = GameSimulation.load(JSON.stringify(s), crops, layouts).simulation;
  wrapped.dispatch({ type: 'advance-day' }); assert.equal(parsed(wrapped).runtime.dayTicks, 0);
  assert.equal(wrapped.getSnapshot().daysAdvanced, a.getSnapshot().daysAdvanced + 1);
});

test('import from generated farms preserves detached setup bytes across repeated original imports and native restores', () => {
  const generated = GameSimulation.createNew(newFarmOptions, { ...newFarmAssets, crops });
  const sourceSetup = parsed(generated).runtime.newFarm;
  const imported = generated.importOriginal(source('SCEN7.SSM'), crops).simulation;
  const saved = parsed(imported); assert.equal(saved.runtime.newFarm, null); assert.deepEqual(saved.runtime.retainedSetup, sourceSetup);
  const restored = GameSimulation.load(imported.save(null), crops, layouts).simulation;
  assert.deepEqual(parsed(restored), saved);
  assert.deepEqual(parsed(restored.importOriginal(source('SCEN1.SSM'), crops).simulation).runtime.retainedSetup, sourceSetup);
  const view = imported.getSnapshot(); view.retainedSetup!.plannerBuffer[0] ^= 255;
  assert.deepEqual(parsed(imported).runtime.retainedSetup, sourceSetup);
});

test('malformed originals, missing crops and malformed v18 checkpoints reject without changing the active session', () => {
  const game = cold(), before = game.save(null), bytes = source('SCEN0.SSM');
  for (const bad of [bytes.subarray(0,-1), Buffer.alloc(bytes.length), Buffer.concat([bytes, Buffer.from([0])])]) assert.throws(() => game.importOriginal(bad, crops));
  assert.throws(() => game.importOriginal(bytes, []), /Missing simulation crop/);
  const valid = parsed(game);
  for (const change of [(s: any) => delete s.runtime.retainedSetup, (s: any) => s.runtime.retainedSetup = {}, (s: any) => s.runtime.dayTicks = 65536]) {
    const bad = structuredClone(valid); change(bad); assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops, layouts));
  }
  const legacy = structuredClone(valid); legacy.version = 17; legacy.scenarioId = 0; delete legacy.runtime.retainedSetup;
  assert.equal(parsed(GameSimulation.load(JSON.stringify(legacy), crops, layouts).simulation).runtime.retainedSetup, null);
  legacy.scenarioId = null; assert.throws(() => GameSimulation.load(JSON.stringify(legacy), crops, layouts), /scenario ID/);
  assert.equal(game.save(null), before);
});

test('full warm irrigation registry and active wave survive import, removals and native continuation', () => {
  const state = readNativeSave(cold().save(null)).state;
  state.scenario.irrigation.sources.fill(0);
  state.scenario.irrigation.sources.set([95, 94, 255], 189);
  Object.assign(state.scenario.irrigation, { active: true, phase: 1, lastTick: 65534, flow: [{ x: 95, y: 0, strength: 255 }] });
  const old = GameSimulation.load(writeNativeSave(state, null), crops, layouts).simulation;
  const bytes = Buffer.from(source('SCEN0.SSM')); bytes[0x210d2] = 64; bytes.fill(0, 0x210d3, 0x21193);
  assert.throws(() => readScenario(bytes), /tail/);
  const imported = old.importOriginal(bytes, crops).simulation;
  const next = readNativeSave(imported.save(null)).state;
  assert.equal(next.scenario.irrigation.sourceCount, 64);
  assert.deepEqual([...next.scenario.irrigation.sources.subarray(189)], [95, 94, 255]);
  assert.deepEqual(next.scenario.irrigation.flow, state.scenario.irrigation.flow);
  assert.equal(next.scenario.irrigation.lastTick, 65534);
  assert.equal(next.scenario.irrigation.phase, 1);
  // Mutable registry no longer needs to have the immutable source's original count.
  next.scenario.irrigation.sourceCount = 0;
  const restored = GameSimulation.load(writeNativeSave(next, null), crops, layouts).simulation;
  assert.equal(restored.getSnapshot().scenario.irrigation.sourceCount, 0);
  const resumed = GameSimulation.load(restored.save(null), crops, layouts).simulation;
  restored.dispatch({ type: 'advance-day' }); resumed.dispatch({ type: 'advance-day' });
  assert.deepEqual(parsed(restored), parsed(resumed));
});
