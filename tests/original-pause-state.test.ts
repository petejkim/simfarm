import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initialOriginalPause, unknownOriginalPause, enterOriginalPause, leaveOriginalPause } from '../src/simulation/original-pause';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from '../src/simulation/game';
import { newFarmAssets, newFarmOptions as options, newFarmExe as exe } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const cold = (id = 4) => new GameSimulation(readScenario(source(`SCEN${id}.SSM`)), assets.crops, assets.townLayouts);
const parsed = (g: GameSimulation) => JSON.parse(g.save(null));
const restore = (value: unknown) => GameSimulation.load(JSON.stringify(value), assets.crops, assets.townLayouts).simulation;

test('original pause source keeps initialized checks, byte wrapping and1->0 resume independent of equipment identity', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  assert.equal(exe[0x846f0 + 0x187], 0);
  assert.deepEqual([0xa760, 0xa752, 0xa744, 0xa728, 0xa736].map(o => exe[0x846f0 + o]), initialOriginalPause().speedChecks);
  for (const offset of [0xccdc, 0xce12, 0xce38, 0xce3a, 0xce3c, 0xce3e]) assert.equal(exe.readUInt16LE(0x846f0 + offset), 0x6190);
  exact(0x3f49d, '26fe06870174422ac0a260a7a252a7a244a7a228a7c60636a701');
  exact(0x3f4f3, '26803e8701007503e9850026fe0e8701757e');
  exact(0x3f541, 'c60644a7012ac0a236a7a260a7a252a7a228a7');
  exact(0x40773, '8e0612ce26a244a7');
  exact(0x4084a, '8e0638ce26a260a78e063ace26a252a78e063cce26a228a78e063ece26a236a7');
  exact(0x3ecd0, '0ee8be07'); exact(0x3fa42, '9a2a13e624'); exact(0x3ed67, 'e921ff');
  exact(0x4619e, 'ff76e6ff76e46a016a016890616887019a4a07840083c40c');
  exact(0x43284, '9a3413e624');
  const state = readNativeSave(cold().save(null)).state;
  for (let depth = 0; depth < 256; depth++) {
    const checks: [number, number, number, number, number] = [128, 3, 254, 1, 255];
    const pause = { depth, speedChecks: [...checks] as typeof checks };
    enterOriginalPause(pause);
    assert.equal(pause.depth, (depth + 1) & 255);
    assert.deepEqual(pause.speedChecks, depth === 255 ? checks : [0, 0, 0, 0, 1]);
    state.originalPause = { depth, speedChecks: [...checks] };
    state.scenario.farm.dayDelayTicks = 777; state.scenario.farm.speed = 11;
    state.scenario.farm.equipmentPacingByte = 255; state.scenario.farm.paceEquipment = true;
    state.disasters.frameDelay = 37; state.traffic.delay = 29; state.scenario.irrigation.delay = 13;
    leaveOriginalPause(state);
    assert.equal(state.originalPause.depth, Math.max(0, depth - 1));
    assert.deepEqual(state.originalPause.speedChecks, depth === 1 ? [0, 0, 1, 0, 0] : checks);
    assert.deepEqual([state.scenario.farm.dayDelayTicks, state.scenario.farm.speed, state.scenario.farm.equipmentPacingByte,
      state.disasters.frameDelay, state.traffic.delay, state.scenario.irrigation.delay], depth === 1 ? [256, 1, 2, 4, 16, 2] : [777, 11, 255, 37, 29, 13]);
  }
  const unknown = unknownOriginalPause(); enterOriginalPause(unknown); assert.deepEqual(unknown, unknownOriginalPause());
  unknown.speedChecks = [0, 42, null, 0, 1]; enterOriginalPause(unknown);
  assert.deepEqual(unknown.speedChecks, [0, null, null, 0, 1]);
  state.originalPause = unknown; const before = writeNativeSave(state, null);
  assert.throws(() => leaveOriginalPause(state), /unknown/); assert.equal(writeNativeSave(state, null), before);
});

test('ordinary loads retain opening checks and loaded post-return depth across all source farms and exact checkpoints', () => {
  for (let id = 0; id < 8; id++) {
    const prior = cold(id), before = prior.save(null);
    for (const depth of [0, 1, 2, 127, 128, 254, 255]) {
      const bytes = Buffer.from(source(`SCEN${id}.SSM`)); bytes[0x21719] = depth;
      const input = Buffer.from(bytes), loaded = prior.importOriginal(bytes, assets.crops).simulation;
      const expected = { depth: Math.max(0, depth - 1), speedChecks: depth === 1 ? [0, 0, 1, 0, 0] : [0, 0, 0, 0, 1] };
      assert.deepEqual(loaded.getSnapshot().originalPause, expected);
      const saved = parsed(loaded); assert.equal(saved.version, 23); assert.deepEqual(saved.runtime.originalPause, expected);
      const copy = restore(saved); assert.equal(copy.save(null), loaded.save(null));
      for (const game of [loaded, copy]) { game.dispatch({ type: 'set-paused', paused: false }); game.tick(41.5); }
      assert.equal(copy.save(null), loaded.save(null)); assert.deepEqual(bytes, input);
      const snapshot = loaded.getSnapshot(); snapshot.originalPause.depth = 55; snapshot.originalPause.speedChecks.fill(55);
      assert.deepEqual(parsed(loaded).runtime.originalPause, expected);
    }
    assert.equal(prior.save(null), before);
  }
  const value = parsed(cold()); value.runtime.originalPause = { depth: 255, speedChecks: [128, 3, 254, 1, 255] };
  const prior = restore(value), next = prior.importOriginal(source('SCEN4.SSM'), assets.crops).simulation;
  assert.deepEqual(next.getSnapshot().originalPause, { depth: 0, speedChecks: value.runtime.originalPause.speedChecks });
  assert.deepEqual(parsed(prior), value); //255->0 opening leaves checks; loaded0 skips resume.
}, 15000); //56 complete import/checkpoint/continuation pairs across eight farms.

test('restart resets checks but retains pause depth; numbered and Load chooser outcomes use distinct source callbacks', () => {
  const value = parsed(cold()); value.runtime.originalPause = { depth: 254, speedChecks: [128, 3, 254, 1, 255] };
  const prior = restore(value), fresh = GameSimulation.createNew(options, assets);
  assert.deepEqual(fresh.getSnapshot().originalPause, initialOriginalPause());
  const restarted = prior.restartGenerated(options, assets);
  assert.deepEqual(restarted.getSnapshot().originalPause, { depth: 254, speedChecks: [0, 0, 1, 0, 0] });
  const bytes = Buffer.from(source('SCEN4.SSM')); bytes[0x21719] = 255;
  for (const game of [prior.restartRegion(bytes, options.climate, assets), GameSimulation.openGeographicRegion(bytes, options.climate, options.seeds, assets)])
    assert.deepEqual(game.getSnapshot().originalPause, { depth: 255, speedChecks: [0, 0, 1, 0, 0] });
  for (const game of [prior.restartOriginalSave(bytes, options.date, assets), GameSimulation.openOriginalSave(bytes, options, assets)])
    assert.deepEqual(game.getSnapshot().originalPause, { depth: 254, speedChecks: [0, 0, 0, 0, 1] });
  assert.deepEqual(parsed(prior), value);
});

test('v23 preserves raw or unknown pause/check bytes; older formats never infer them from pause, source or equipment', () => {
  const base = parsed(cold());
  for (const pause of [unknownOriginalPause(), { depth: 255, speedChecks: [254, null, 128, 0, 1] }, { depth: null, speedChecks: [0, 0, 1, 0, 0] }]) {
    const value = structuredClone(base); value.runtime.originalPause = pause;
    assert.deepEqual(parsed(restore(value)), value);
  }
  for (const mutate of [
    (v: any) => delete v.runtime.originalPause, (v: any) => v.runtime.originalPause = null,
    ...[undefined, -1, 256, 0.5, '0', false, {}].map(depth => (v: any) => v.runtime.originalPause.depth = depth),
    (v: any) => v.runtime.originalPause.speedChecks.pop(), (v: any) => v.runtime.originalPause.speedChecks = {},
    ...[-1, 256, 0.5, '0', false, {}].map(byte => (v: any) => v.runtime.originalPause.speedChecks[3] = byte),
  ]) {
    const value = structuredClone(base); mutate(value); assert.throws(() => restore(value), /original (pause|speed)/);
  }
  for (let version = 1; version <= 22; version++) {
    const old = structuredClone(base); old.version = version; old.scenarioId = 4;
    old.runtime.originalPause = { depth: 27, speedChecks: [0, 1, 0, 0, 0] }; // Stray newer fields do not establish historical knowledge.
    const game = restore(old), migrated = parsed(game);
    assert.deepEqual(migrated.runtime.originalPause, unknownOriginalPause());
    assert.deepEqual(migrated.runtime.random, old.runtime.random); assert.equal(migrated.scenario.world, old.scenario.world);
    assert.equal(migrated.runtime.paused, old.runtime.paused); assert.equal(migrated.runtime.elapsed, old.runtime.elapsed);
    assert.deepEqual(parsed(restore(migrated)), migrated);
    const loaded = game.importOriginal(source('SCEN4.SSM'), assets.crops).simulation;
    assert.deepEqual(loaded.getSnapshot().originalPause, { depth: 0, speedChecks: [null, null, null, null, null] });
    const one = Buffer.from(source('SCEN4.SSM')); one[0x21719] = 1;
    assert.deepEqual(game.importOriginal(one, assets.crops).simulation.getSnapshot().originalPause, initialOriginalPause());
  }
}, 15000); //Every historical version plus both subsequent original-load branches.
