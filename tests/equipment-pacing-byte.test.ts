import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFarmState, setEquipmentPacingByte } from '../src/formats/scenario-state';
import { readScenario } from '../src/formats/scenario';
import { readNativeSave } from '../src/formats/native-save';
import { GameSimulation } from '../src/simulation/game';
import { newFarmAssets as assets, newFarmOptions as options, newFarmExe as exe } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const cold = () => new GameSimulation(readScenario(source('SCEN4.SSM')), assets.crops, assets.townLayouts);
const parsed = (g: GameSimulation) => JSON.parse(g.save(null));
const restore = (value: unknown) => GameSimulation.load(JSON.stringify(value), assets.crops, assets.townLayouts).simulation;

test('equipment pacing is an unsigned saved byte, not a boolean or pause counter', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (a: number, hex: string) => assert.equal(exe.subarray(a, a + hex.length / 2).toString('hex'), hex);
  exact(0x4516c, '6a0168906168a0a89adc088400');
  exact(0x4618e, '6a0168906168a0a89a4a078400');
  exact(0x14a61, '263b06901f770f8e06d0c726803ea0a8007403');
  exact(0x4072b, '26c606a0a802'); exact(0x3f505, 'c606a0a802');
  for (let id = 0; id < 8; id++) {
    const bytes = Buffer.from(source(`SCEN${id}.SSM`));
    for (let byte = 0; byte < 256; byte++) {
      bytes[0x21718] = byte; bytes[0x21719] = 255 - byte;
      const farm = readFarmState(bytes);
      assert.equal(farm.equipmentPacingByte, byte); assert.equal(farm.paceEquipment, byte !== 0);
    }
  }
  assert.throws(() => readFarmState(source('SCEN4.SSM').subarray(0, 0x21718)), /range/);
  const farm = cold().getSnapshot().scenario.farm, before = structuredClone(farm);
  for (const byte of [-1, 256, 1.5, NaN]) { assert.throws(() => setEquipmentPacingByte(farm, byte)); assert.deepEqual(farm, before); }
});

test('original import retains every represented speed byte except the verified depth1 resume store, with exact continuation', () => {
  const prior = cold(), before = prior.save(null);
  for (const byte of [0, 1, 2, 3, 4, 127, 128, 255]) {
    for (const depth of [0, 1, 2, 255]) {
      const input = Buffer.from(source('SCEN4.SSM')); input[0x21718] = byte; input[0x21719] = depth;
      const original = Buffer.from(input), game = prior.importOriginal(input, assets.crops).simulation;
      const value = parsed(game); assert.equal(value.version, 27);
      assert.equal(value.scenario.farm.equipmentPacingByte, depth === 1 ? 2 : byte);
      assert.equal(value.scenario.farm.paceEquipment, depth === 1 || byte !== 0);
      const loaded = restore(value); assert.deepEqual(parsed(loaded), value);
      game.dispatch({ type: 'advance-day' }); loaded.dispatch({ type: 'advance-day' });
      assert.equal(game.save(null), loaded.save(null)); assert.deepEqual(input, original);
    }
  }
  assert.equal(prior.save(null), before);
  const raw = Buffer.from(source('SCEN4.SSM')); raw[0x21718] = 255;
  const game = new GameSimulation(readScenario(raw), assets.crops, assets.townLayouts), checkpoint = parsed(game);
  checkpoint.scenario.farm.equipmentPacingByte = null;
  const legacy = restore(checkpoint);
  const restarted = legacy.restartGenerated(options, assets);
  assert.equal(restarted.getSnapshot().scenario.farm.equipmentPacingByte, 2);
  assert.equal(GameSimulation.createNew(options, assets).getSnapshot().scenario.farm.equipmentPacingByte, 2);
}, 15000); // 32 complete import/save/advance pairs: ~4.3s alone, ~7.8s under concurrent regression load.

test('v22 bounds and gate consistency reject malformed saves; old formats keep the byte unknown without guessing from source or delays', () => {
  const before = parsed(cold());
  for (const byte of [undefined, -1, 256, 0.5, '2', {}, false]) {
    const bad = structuredClone(before); bad.scenario.farm.equipmentPacingByte = byte;
    assert.throws(() => restore(bad), /equipment pacing/);
  }
  for (const byte of [0, 1, 2, 255]) {
    const bad = structuredClone(before); bad.scenario.farm.equipmentPacingByte = byte; bad.scenario.farm.paceEquipment = byte === 0;
    assert.throws(() => restore(bad), /pacing gate/);
  }
  for (const gate of [false, true]) {
    const unknown = structuredClone(before); unknown.scenario.farm.equipmentPacingByte = null; unknown.scenario.farm.paceEquipment = gate;
    assert.deepEqual(parsed(restore(unknown)), unknown);
    for (let version = 1; version < 22; version++) {
      const old = structuredClone(unknown); old.version = version; old.scenarioId = 4;
      // Even a stray newer member must not invent knowledge for a historical format.
      old.scenario.farm.equipmentPacingByte = 3;
      const game = restore(old), migrated = parsed(game);
      assert.equal(migrated.scenario.farm.equipmentPacingByte, null); assert.equal(migrated.scenario.farm.paceEquipment, gate);
      assert.deepEqual(migrated.runtime.random, old.runtime.random); assert.equal(migrated.scenario.source, old.scenario.source);
      assert.equal(migrated.scenario.world, old.scenario.world); assert.equal(migrated.scenario.farm.dayDelayTicks, old.scenario.farm.dayDelayTicks);
      assert.equal(readNativeSave(game.save(null)).state.scenario.farm.equipmentPacingByte, null);
    }
  }
});
