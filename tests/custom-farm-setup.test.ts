import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { CustomFarmSetup } from '../src/simulation/custom-farm-setup';
import { GameSimulation } from '../src/simulation/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { climateForSetup } from '../src/formats/new-farm';
import { createSetupRecords } from '../src/formats/new-farm-records';
import { createTrafficState, snapshotTraffic } from '../src/formats/traffic';
import { createSetupRuntime } from '../src/simulation/new-farm-runtime';
import { FarmRandom } from '../src/simulation/random';
import { initialTerrainHistory } from '../src/simulation/terrain-random';
import { beginTerrainPreview, locateTerrainPreview, rebuildTerrainPreview, copyLocatedTerrainPreview } from '../src/simulation/terrain-preview';
import { initializeStartingProperty } from '../src/simulation/starting-property';
import { initializeStartingTown, createStartupCalendar } from '../src/simulation/starting-environment';
import { initializeStartingMarket } from '../src/simulation/starting-market';
import { loadStartingCrops } from '../src/simulation/new-farm-records';
import { initializeStartingTraffic } from '../src/simulation/starting-traffic';
import { initializeWeather } from '../src/simulation/weather';
import { newFarmAssets as assets, newFarmOptions as options, newFarmExe } from './support/new-farm';
const { seeds: _, ...settings } = options;
const stateOf = (game: GameSimulation) => readNativeSave(game.save(null)).state;
const load = (text: string) => GameSimulation.load(text, assets.crops, assets.townLayouts).simulation;

test('custom setup starts with original cold soil/water, separates controls from preview and retains every reroll stream', () => {
  assert.equal(newFarmExe[0x84854], 8);
  const draft = CustomFarmSetup.fresh({ ...options, climate: { precipitation: 0, temperature: 0, wind: 0 }, river: false, lake: true }, assets);
  let expected = locateTerrainPreview(beginTerrainPreview(new Uint8Array(1008), options.seeds, initialTerrainHistory(options.seeds.simulation), 8, 'cold'));
  assert.deepEqual(draft.getSnapshot().preview, expected);
  const first = draft.getSnapshot(); assert.equal(draft.getSnapshot(), first);
  let notices = 0; const stop = draft.subscribe(() => notices++);
  for (const precipitation of [3, 0, 1]) {
    const selected = { ...settings, climate: { precipitation, temperature: 1, wind: 3 }, river: false, lake: true };
    draft.setSettings(selected); assert.deepEqual(draft.getSnapshot().preview, expected);
    expected = rebuildTerrainPreview(expected, precipitation, selected);
    draft.generateWorld(); assert.deepEqual(draft.getSnapshot().preview, expected);
  }
  assert.equal(notices, 6); stop(); draft.setSettings(settings); assert.equal(notices, 6);
  const before = structuredClone(draft.getSnapshot());
  for (const invalid of [{ ...settings, lake: 1 }, { ...settings, climate: { ...settings.climate, wind: 4 } },
    { ...settings, date: { year: 0, dayOfWeek: 7 } }]) assert.throws(() => draft.setSettings(invalid as any));
  assert.deepEqual(draft.getSnapshot(), before);
  // Mutating a published copy cannot alter the next generation or canonical input.
  draft.getSnapshot().preview.world.cells[0].terrain = 65535;
  draft.getSnapshot().preview.random.visual ^= 65535;
  draft.getSnapshot().settings.climate.precipitation = 3;
  draft.generateWorld(); assert.deepEqual(draft.getSnapshot().preview, rebuildTerrainPreview(expected, settings.climate.precipitation, settings));
});

test('Play uses the displayed sites/map and exact post-preview streams, with one property/town/market/weather/traffic finalization', () => {
  for (const rerolls of [0, 3]) {
    const draft = CustomFarmSetup.fresh(options, assets);
    for (let i = 0; i < rerolls; i++) draft.generateWorld();
    // Change controls AFTER generation. Play must not generate from these settings.
    const selected = { ...settings, climate: { precipitation: 0, temperature: 3, wind: 0 }, river: false, lake: true };
    draft.setSettings(selected);
    const preview = structuredClone(draft.getSnapshot().preview), world = structuredClone(preview.world);
    const records = createSetupRecords(assets.records), runtime = createSetupRuntime(assets.runtime, records);
    const sites = preview.locations!, random = new FarmRandom(preview.random);
    const property = initializeStartingProperty(world, sites.player);
    runtime.farm.cash = property.cash; runtime.finances.homestead = property.homestead;
    assert.ok(initializeStartingTown(world, runtime, assets.townLayouts, sites.town).ok);
    loadStartingCrops(records, assets.records.cropFiles, assets.crops);
    const history = initializeStartingMarket(records.cropDefinitions.slice(0, 16).map(d => d.price), records.marketMood, random);
    const climate = climateForSetup(assets.climate, selected.climate);
    const weather = initializeWeather(climate, createStartupCalendar(options.date), 0, random, world.cells, preview.terrain.soilMoisture);
    const traffic = createTrafficState(assets.traffic); initializeStartingTraffic(traffic, sites.town, random);
    const accepted = draft.accept();
    assert.deepEqual(accepted.scenario.cells, world.cells); assert.deepEqual(accepted.scenario.regionalConditions, world.regionalConditions);
    assert.deepEqual(accepted.random, random.snapshot()); assert.deepEqual(accepted.weather, weather);
    assert.deepEqual(accepted.market.history, history); assert.deepEqual(accepted.traffic, snapshotTraffic(traffic));
    assert.deepEqual(accepted.setup.terrainHistory, preview.terrainHistory); assert.deepEqual(accepted.setup.previewRaw, preview.raw);
    assert.deepEqual(accepted.finances.homestead, property.homestead); assert.deepEqual(accepted.finances.town.activeSite, sites.town);
    assert.deepEqual(accepted.scenario.climate, climate); assert.equal(accepted.scenario.farm.cash, 40000);
    assert.deepEqual(draft.getSnapshot().preview, preview); assert.equal(draft.getSnapshot().phase, 'accepted');
    assert.throws(() => draft.accept(), /closed/); assert.throws(() => draft.generateWorld(), /closed/);
    assert.throws(() => draft.setSettings(settings), /closed/); assert.throws(() => draft.cancel(), /closed/);
    const a = load(writeNativeSave(accepted, null)), b = load(a.save(null));
    for (let day = 0; day < 14; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
    assert.equal(a.save(null), b.save(null));
  }
});

test('restart drafts retain entry state while the live farm advances; cancel and failed acceptance are atomic', () => {
  const game = GameSimulation.createNew(options, assets), prior = stateOf(game);
  prior.weather.soilMoisture = 5; prior.scenario.farm.workerExpenses = 123456;
  const draft = CustomFarmSetup.restart(prior, settings, assets), before = readNativeSave(writeNativeSave(prior, null)).state;
  assert.deepEqual(draft.getSnapshot().preview, locateTerrainPreview(beginTerrainPreview(prior.scenario.regionalConditions,
    prior.random, prior.setup.terrainHistory!, 5, 'restart')));
  for (let i = 0; i < 3; i++) game.dispatch({ type: 'advance-day' });
  prior.random.visual ^= 65535; prior.scenario.farm.workerExpenses = 999;
  const accepted = draft.accept();
  assert.equal(accepted.weather.soilMoisture, 5); assert.equal(accepted.scenario.farm.workerExpenses, 123456);
  assert.deepEqual(accepted.newFarm!.provenance.options.seeds, before.random);
  assert.deepEqual(accepted.setup.terrainHistory, draft.getSnapshot().preview.terrainHistory);
  const clone = CustomFarmSetup.restart(before, settings, assets); assert.deepEqual(clone.accept(), accepted);
  const liveBefore = game.save(null), cancelled = CustomFarmSetup.restart(stateOf(game), settings, assets);
  cancelled.generateWorld(); cancelled.cancel(); assert.throws(() => cancelled.accept(), /closed/); assert.equal(game.save(null), liveBefore);
  const broken = CustomFarmSetup.restart(before, settings, { ...assets, crops: [] });
  const previewBefore = structuredClone(broken.getSnapshot());
  for (let i = 0; i < 2; i++) { assert.throws(() => broken.accept(), /Missing starting crop/); assert.deepEqual(broken.getSnapshot(), previewBefore); }
  assert.deepEqual(before, stateOf(load(writeNativeSave(before, null))));
  before.setup.terrainHistory = null; assert.throws(() => CustomFarmSetup.restart(before, settings, assets), /terrain history/);
});

test('native v20 retains raw preview bytes, validates their bounds and migrates older saves without replay', () => {
  const draft = CustomFarmSetup.fresh(options, assets); draft.generateWorld();
  const state = draft.accept(), text = writeNativeSave(state, null), document = JSON.parse(text);
  assert.equal(document.version, 23); assert.deepEqual(document.runtime.setup.previewRaw, { ds1521: 201, ds23db: 201 });
  assert.deepEqual(readNativeSave(text).state, state);
  for (const value of [0, 255]) {
    const next = structuredClone(document); next.runtime.setup.previewRaw = { ds1521: value, ds23db: 255 - value };
    assert.deepEqual(readNativeSave(JSON.stringify(next)).state.setup.previewRaw, next.runtime.setup.previewRaw);
  }
  for (const change of [(s: any) => delete s.runtime.setup.previewRaw, (s: any) => s.runtime.setup.previewRaw.ds1521 = -1,
    (s: any) => s.runtime.setup.previewRaw.ds23db = 256, (s: any) => s.runtime.setup.previewRaw = {},
    (s: any) => s.runtime.setup.previewRaw.ds1521 = 0.5]) {
    const bad = structuredClone(document); change(bad); assert.throws(() => readNativeSave(JSON.stringify(bad)), /preview/);
  }
  const legacy = structuredClone(document); legacy.version = 19; delete legacy.runtime.setup.previewRaw;
  const migrated = readNativeSave(JSON.stringify(legacy)).state;
  assert.equal(migrated.setup.previewRaw, null); assert.deepEqual(migrated.random, state.random);
  assert.deepEqual(migrated.setup.terrainHistory, state.setup.terrainHistory);
  assert.deepEqual(migrated.scenario, { ...state.scenario, farm: { ...state.scenario.farm, equipmentPacingByte: null } });
  legacy.version = 18; delete legacy.runtime.setup;
  assert.equal(readNativeSave(JSON.stringify(legacy)).state.setup.previewRaw, null);
});

test('accepted preview boundaries reject malformed maps/sites/streams without mutating their source', () => {
  const preview = CustomFarmSetup.fresh(options, assets).getSnapshot().preview;
  for (const change of [(s: any) => s.world.cells.pop(), (s: any) => s.world.cells[0].terrain = 65536,
    (s: any) => s.world.cells[0].attribute = -1, (s: any) => s.locations = null,
    (s: any) => s.locations.player.regionX = 10, (s: any) => s.locations.town.regionY = 12,
    (s: any) => s.random.bounded = -1, (s: any) => s.terrainHistory.pop(), (s: any) => s.raw.ds1521 = 256]) {
    const bad = structuredClone(preview); change(bad); const before = structuredClone(bad);
    assert.throws(() => copyLocatedTerrainPreview(bad)); assert.deepEqual(bad, before);
  }
});
