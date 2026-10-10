import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { readCrop } from '../src/formats/crop';
import { readScenario } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { GameSimulation } from '../src/simulation/game';
import { CustomFarmSetup } from '../src/simulation/custom-farm-setup';
import { newFarmAssets, newFarmOptions as options, newFarmExe as exe } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const cold = () => new GameSimulation(readScenario(source('SCEN0.SSM')), crops, assets.townLayouts);
const load = (text: string) => GameSimulation.load(text, crops, assets.townLayouts).simulation;
const state = (g: GameSimulation) => readNativeSave(g.save(null)).state;

test('climate choice bytes start at zero; geographic acceptance and custom controls write them but Load returns before the copy', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.deepEqual([...exe.subarray(0x8aea6, 0x8aea9)], [0, 0, 0]);
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x3245a, '9a3012e6249a2612e624b001a2c466a2be66b801005e5fc9cb');
  exact(0x32559, 'c03eab6605a0ab668e06feca26a2b667c03eac6605a0ac668e0600cb26a2b767c03ead6605a0ad668e0602cb26a2b867');
  for (const [offset, target] of [[0x33228, 'b6'], [0x332de, 'b7'], [0x3339a, 'b8']] as const)
    exact(offset, `fe06${target}67803e${target}67037e05c606${target}6703`);
  for (const [offset, target] of [[0x3346a, 'b6'], [0x33516, 'b7'], [0x335c8, 'b8']] as const)
    exact(offset, `803e${target}67007e04fe0e${target}67`);
  exact(0x41032, '8e0694ce26a0b86798508e0696ce26a0b76798508e0698ce26a0b66798509aa213e624');
  for (const selector of [0xcafe, 0xcb00, 0xcb02, 0xce94, 0xce96, 0xce98])
    assert.equal(exe.readUInt16LE(0x846f0 + selector), 0x6190);
});

test('accepted custom/geographic choices replace the retained levels; SSM imports and ordinary play preserve them independently of tables', () => {
  const prior = cold(), before = prior.save(null);
  assert.deepEqual(prior.getSnapshot().setup.climateSelection, { precipitation: 0, temperature: 0, wind: 0 });
  const first = { precipitation: 0, temperature: 3, wind: 1 }, final = { precipitation: 3, temperature: 0, wind: 2 };
  const draft = CustomFarmSetup.restart(state(prior), { ...options, climate: first }, assets);
  draft.generateWorld(); draft.setSettings({ ...options, climate: final });
  const generated = load(writeNativeSave(draft.accept(), null));
  assert.deepEqual(generated.getSnapshot().setup.climateSelection, final);
  assert.equal(prior.save(null), before);
  for (const game of [GameSimulation.createNew({ ...options, climate: first }, assets),
    GameSimulation.createGeographic({ ...options, climate: first }, assets),
    prior.restartGeographic({ ...options, climate: first }, assets),
    GameSimulation.openGeographicRegion(source('SCEN4.SSM'), first, options.seeds, assets),
    generated.restartRegion(source('SCEN4.SSM'), first, assets)]) {
    assert.deepEqual(game.getSnapshot().setup.climateSelection, first);
    const imported = game.importOriginal(source('SCEN6.SSM'), crops).simulation;
    assert.deepEqual(imported.getSnapshot().setup.climateSelection, first);
    assert.deepEqual(imported.getSnapshot().scenario.climate, readScenario(source('SCEN6.SSM')).climate);
    const restored = load(imported.save(null));
    for (let day = 0; day < 7; day++) { imported.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
    assert.equal(imported.save(null), restored.save(null));
    assert.deepEqual(imported.getSnapshot().setup.climateSelection, first);
  }
  const cancel = CustomFarmSetup.restart(state(prior), { ...options, climate: final }, assets);
  cancel.cancel(); assert.equal(prior.save(null), before);
});

test('v21 requires bounded climate selections or explicit unknown; older saves never infer them from tables or provenance', () => {
  const generated = GameSimulation.createNew(options, assets), original = cold();
  const current = JSON.parse(generated.save(null)); assert.equal(current.version, 22);
  for (const value of [null, { precipitation: 0, temperature: 3, wind: 0 }, { precipitation: 3, temperature: 0, wind: 3 }]) {
    const valid = structuredClone(current); valid.runtime.setup.climateSelection = value;
    const decoded = readNativeSave(JSON.stringify(valid)).state;
    assert.deepEqual(decoded.setup.climateSelection, value);
    assert.deepEqual(readNativeSave(writeNativeSave(decoded, null)).state.setup.climateSelection, value);
  }
  for (const value of [undefined, {}, [], 0, { precipitation: -1, temperature: 0, wind: 0 },
    { precipitation: 0, temperature: 4, wind: 0 }, { precipitation: 0, temperature: 0, wind: 0.5 },
    { precipitation: '1', temperature: 0, wind: 0 }]) {
    const bad = structuredClone(current); bad.runtime.setup.climateSelection = value;
    assert.throws(() => readNativeSave(JSON.stringify(bad)), /selection/);
  }
  for (const game of [original, generated, generated.importOriginal(source('SCEN6.SSM'), crops).simulation]) {
    const initial = JSON.parse(game.save(null));
    for (const version of [18, 19, 20]) {
      const legacy = structuredClone(initial); legacy.version = version;
      delete legacy.runtime.setup.climateSelection;
      if (version === 18) delete legacy.runtime.setup;
      if (version === 19) delete legacy.runtime.setup.previewRaw;
      const migrated = load(JSON.stringify(legacy)), saved = JSON.parse(migrated.save(null));
      assert.equal(saved.runtime.setup.climateSelection, null);
      assert.deepEqual(saved.scenario, { ...initial.scenario, farm: { ...initial.scenario.farm, equipmentPacingByte: null } }); assert.deepEqual(saved.runtime.random, initial.runtime.random);
      assert.deepEqual(saved.runtime.weather, initial.runtime.weather); assert.deepEqual(saved.runtime.market, initial.runtime.market);
      assert.deepEqual(JSON.parse(load(migrated.save(null)).save(null)), JSON.parse(migrated.save(null)));
      assert.equal(migrated.importOriginal(source('SCEN4.SSM'), crops).simulation.getSnapshot().setup.climateSelection, null);
      // A new explicit choice is sufficient; historical provenance is not.
      if (migrated.getSnapshot().setup.terrainHistory)
        assert.deepEqual(migrated.restartRegion(source('SCEN4.SSM'), options.climate, assets).getSnapshot().setup.climateSelection, options.climate);
    }
  }
});
