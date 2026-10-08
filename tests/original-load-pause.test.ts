import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GameSimulation } from '../src/simulation/game';
import { readCrop } from '../src/formats/crop';
import { readScenario } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { transferOriginalFarm } from '../src/simulation/original-load';
import { newFarmAssets, newFarmExe } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const { townLayouts } = newFarmAssets;
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const cold = () => new GameSimulation(readScenario(source('SCEN0.SSM')), crops, townLayouts);

test('SSM byte21719 replaces pause depth before the load callback tests loaded1->0, independently of old pause', () => {
  const exe = newFarmExe;
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x4619e, 'ff76e6ff76e46a016a016890616887019a4a07840083c40c');
  exact(0x461b6, 'ff76e6ff76e46a016a02689061688c1f9a4a078400');
  exact(0x43257, '0ee8e12183c4040bc07470'); exact(0x43284, '9a3413e624');
  exact(0x3f4f3, '26803e8701007503e9850026fe0e8701757e');
  exact(0x3f505, 'c606a0a802'); exact(0x3f50e, '26c706b2690400');
  exact(0x3f519, '26c7068c1f0001'); exact(0x3f524, '26c706901f0100');
  exact(0x3f52f, '26c70686221000'); exact(0x3f53a, '26c70602240200');
  // Same saved field at the writer, between equipment pacing and day delay.
  exact(0x45186, '689061688701');
  for (let id = 0; id < 8; id++) assert.equal(source(`SCEN${id}.SSM`)[0x21719], 0);
});

test('saved pause boundaries control only the source resume stores and never mutates the prior or input', () => {
  const prior = readNativeSave(cold().save(null)).state;
  prior.disasters.frameDelay = 47; prior.traffic.lastTick = 4567;
  prior.weather.moistureBalance = 5; prior.market.history[0][0] = 5432;
  const original = writeNativeSave(prior, null);
  const input = Buffer.from(source('SCEN0.SSM'));
  input[0x21718] = 0;
  input.writeUInt16LE(777, 0x2171a); input.writeUInt16LE(5, 0x2171c);
  input.writeUInt16LE(29, 0x2171e); input.writeUInt16LE(13, 0x21720);
  for (const paused of [true, false]) {
    prior.paused = paused;
    for (const depth of [0, 1, 2, 127, 128, 254, 255]) {
      input[0x21719] = depth; const before = Buffer.from(input);
      const next = transferOriginalFarm(prior, input, crops), resumes = depth === 1;
      assert.equal(next.scenario.farm.dayDelayTicks, resumes ? 256 : 777);
      assert.equal(next.scenario.farm.speed, resumes ? 1 : 5);
      assert.equal(next.scenario.farm.paceEquipment, resumes);
      assert.equal(next.traffic.delay, resumes ? 16 : 29);
      assert.equal(next.scenario.irrigation.delay, resumes ? 2 : 13);
      assert.equal(next.disasters.frameDelay, resumes ? 4 : 47);
      assert.equal(next.paused, true); assert.equal(next.elapsed, 0);
      assert.deepEqual(next.random, prior.random); assert.deepEqual(next.weather, prior.weather);
      assert.equal(next.traffic.lastTick, 4567); assert.equal(next.market.history[0][0], 5432);
      assert.equal(next.scenario.sourceBytes![0x21719], depth); assert.deepEqual(input, before);
    }
  }
  prior.paused = true; assert.equal(writeNativeSave(prior, null), original);
});

test('all resume branches remain exact native continuations and numbered chooser loads do not invoke the in-game return', () => {
  for (const depth of [0, 1, 2, 255]) {
    const bytes = Buffer.from(source('SCEN0.SSM')); bytes[0x21719] = depth; bytes[0x21718] = 0;
    bytes.writeUInt16LE(333, 0x2171a); bytes.writeUInt16LE(9, 0x2171e); bytes.writeUInt16LE(7, 0x21720);
    const prior = cold(); prior.dispatch({ type: 'set-paused', paused: false });
    const imported = prior.importOriginal(bytes, crops).simulation;
    const restored = GameSimulation.load(imported.save(null), crops, townLayouts).simulation;
    assert.equal(restored.save(null), imported.save(null));
    for (let day = 0; day < 7; day++) {
      imported.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' });
    }
    assert.equal(restored.save(null), imported.save(null));
    const selected = { precipitation: 2, temperature: 2, wind: 1 };
    for (const game of [prior.restartRegion(bytes, selected, assets),
      GameSimulation.openGeographicRegion(bytes, selected, { visual: 9029, simulation: 9029, bounded: 9029 }, assets)]) {
      const state = game.getSnapshot();
      assert.equal(state.scenario.farm.dayDelayTicks, 333); assert.equal(state.scenario.farm.paceEquipment, false);
      assert.equal(state.traffic.delay, 9); assert.equal(state.scenario.irrigation.delay, 7);
    }
  }
  const game = cold(), before = game.save(null);
  assert.throws(() => game.importOriginal(source('SCEN0.SSM').subarray(0, 0x21719), crops));
  assert.equal(game.save(null), before);
});
