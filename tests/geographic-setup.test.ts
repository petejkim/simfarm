import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readCrop } from '../src/formats/crop';
import { readScenario } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { climateForSetup } from '../src/formats/new-farm';
import { createTrafficState } from '../src/formats/traffic';
import { GameSimulation } from '../src/simulation/game';
import { beginTerrainPreview, locateTerrainPreview } from '../src/simulation/terrain-preview';
import { generateFarmTerrain } from '../src/simulation/terrain-generation';
import { selectStartingLocations } from '../src/simulation/starting-property';
import { createNewFarmState } from '../src/simulation/create-farm';
import { restartGeneratedFarm } from '../src/simulation/restart-farm';
import { FarmRandom } from '../src/simulation/random';
import { TerrainRandom, initialTerrainHistory } from '../src/simulation/terrain-random';
import { initializeWeather } from '../src/simulation/weather';
import { initializeStartingTraffic } from '../src/simulation/starting-traffic';
import { newFarmAssets, newFarmOptions as options, newFarmExe as exe } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const state = (g: GameSimulation) => readNativeSave(g.save(null)).state;
const load = (text: string) => GameSimulation.load(text, crops, assets.townLayouts).simulation;
const { seeds, ...settings } = options;

test('geographic branches pin preliminary order, second generation without custom soil writer, loaded skips and cold calendar timestamp', () => {
  const exact = (offset: number, hex: string) => assert.equal(exe.subarray(offset, offset + hex.length / 2).toString('hex'), hex);
  exact(0x3f8aa, '0ee8d0099a7a13e624');
  exact(0x32314, '803ec466027503e90f02');
  exact(0x32327, '9a3012e6249a2612e624c606c46603');
  exact(0x40ee7, '807eb00374059a3a12e624');
  exact(0x337a6, 'a0b667c0e0028e061ecb26a26401');
  assert.equal(exe.readUInt16LE(0x846f0 + 0x1f8e), 0);
  exact(0xc8a9, '26a1a0132b068e1f3b068c1f7703');
  exact(0x45fe3, '68a013'); exact(0x45ffb, '689e13');
});

test('unmarked cold geography generates twice with initial soil/water, selects sites once and applies the chosen climate afterward', () => {
  const initial = beginTerrainPreview(new Uint8Array(1008), seeds, initialTerrainHistory(seeds.simulation), 8, 'cold');
  const random = new FarmRandom(initial.random), terrain = new TerrainRandom(random, initial.terrainHistory);
  const world = generateFarmTerrain(initial.world.regionalConditions, initial.terrain, random, terrain);
  const sites = selectStartingLocations(world, random); assert.ok(sites.ok);
  const accepted = { ...initial, world, random: random.snapshot(), terrainHistory: terrain.snapshot(), locations: sites.locations };
  assert.notDeepEqual(accepted.terrainHistory, initial.terrainHistory);
  for (const precipitation of [0, 3]) {
    const selected = { ...options, climate: { ...options.climate, precipitation }, river: false, lake: true };
    const game = GameSimulation.createGeographic(selected, assets), actual = state(game);
    const expected = createNewFarmState({ ...selected, river: true, lake: false }, assets, accepted);
    assert.deepEqual(JSON.parse(game.save(null)), JSON.parse(writeNativeSave(expected, null)));
    assert.equal(actual.weather.soilMoisture, 8); assert.deepEqual(actual.scenario.climate, climateForSetup(assets.climate, selected.climate));
    assert.equal(actual.newFarm!.provenance.options.river, true); assert.equal(actual.newFarm!.provenance.options.lake, false);
    assert.deepEqual(actual.setup.previewRaw, { ds1521: 201, ds23db: 201 });
    assert.equal(load(game.save(null)).save(null), game.save(null));
  }
});

test('unmarked restart retains soil/history and unknown source bytes through both generations and saved continuation', () => {
  const prior = state(new GameSimulation(readScenario(source('SCEN4.SSM')), crops, assets.townLayouts));
  prior.weather.soilMoisture = 5; prior.weather.moistureBalance = 0; prior.scenario.farm.workerExpenses = 123456;
  const game = load(writeNativeSave(prior, null)), before = game.save(null);
  const selected = { ...settings, climate: { ...settings.climate, precipitation: 0 }, river: true, lake: true };
  const preliminary = beginTerrainPreview(prior.scenario.regionalConditions, prior.random, prior.setup.terrainHistory!, 5, 'restart');
  const random = new FarmRandom(preliminary.random), terrain = new TerrainRandom(random, preliminary.terrainHistory);
  const world = generateFarmTerrain(preliminary.world.regionalConditions, { soilMoisture: 5, river: false, lake: false }, random, terrain);
  const sites = selectStartingLocations(world, random); assert.ok(sites.ok);
  const expected = restartGeneratedFarm(prior, { ...selected, river: false, lake: false }, assets,
    { ...preliminary, world, locations: sites.locations, random: random.snapshot(), terrainHistory: terrain.snapshot() });
  const a = game.restartGeographic(selected, assets), actual = state(a);
  assert.deepEqual(JSON.parse(a.save(null)), JSON.parse(writeNativeSave(expected, null))); assert.equal(game.save(null), before);
  assert.equal(actual.weather.soilMoisture, 5); assert.equal(actual.scenario.farm.workerExpenses, 0);
  assert.deepEqual(actual.setup.sourceArchive, Uint8Array.from(source('SCEN4.SSM')));
  const b = load(a.save(null));
  for (let day = 0; day < 14; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
  assert.equal(a.save(null), b.save(null));
});

test('all cold numbered farms discard preliminary terrain but retain its RNG/history before one loaded startup', () => {
  const selection = { precipitation: 0, temperature: 3, wind: 1 }, climate = climateForSetup(assets.climate, selection);
  const preliminary = beginTerrainPreview(new Uint8Array(1008), seeds, initialTerrainHistory(seeds.simulation), 8, 'cold');
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), saved = readScenario(bytes);
    // Default generated crops need not be present: result2 does not load them.
    const catalog = crops.filter(c => saved.cropFiles.includes(`${c.id}.crp`));
    const game = GameSimulation.openGeographicRegion(bytes, selection, seeds, { ...assets, crops: catalog }), actual = state(game);
    assert.equal(actual.newFarm, null); assert.equal(actual.retainedSetup, null);
    assert.deepEqual(actual.setup, { terrainHistory: preliminary.terrainHistory, previewRaw: preliminary.raw, sourceArchive: null, climateSelection: selection });
    assert.deepEqual(actual.scenario.sourceBytes, Uint8Array.from(bytes)); assert.deepEqual(actual.scenario.farm.calendar, saved.farm.calendar);
    assert.deepEqual(actual.scenario.fields.map(f => f.bytes), saved.fields.map(f => f.bytes));
    assert.deepEqual(actual.scenario.schedule.bytes, saved.schedule.bytes); assert.deepEqual(actual.scenario.climate, climate);
    assert.equal(actual.scenario.farm.cash, 40000); assert.equal(actual.scenario.farm.workerExpenses, assets.runtime.farm.workerExpenses);
    assert.equal(actual.finances.accounts.buildingBookValue, assets.runtime.finances.accounts.buildingBookValue);
    assert.ok(actual.market.history.every(row => row.slice(0, 29).every(n => n === 0)));
    assert.deepEqual(actual.market.history.map(row => row[29]), actual.cropMarketPrices);
    assert.equal(actual.dayTicks, saved.farm.animationTicks); assert.equal(actual.equipmentAnimationTick, saved.farm.animationTicks);
    assert.equal(actual.scenario.irrigation.lastTick, saved.farm.animationTicks);
    assert.equal(actual.traffic.delay, bytes.readUInt16LE(0x2171e));
    const random = new FarmRandom(preliminary.random);
    const weather = initializeWeather(climate, saved.farm.calendar, saved.farm.precipitationDays, random, structuredClone(saved.cells), 8);
    const traffic = createTrafficState({ ...assets.traffic, delay: actual.traffic.delay });
    initializeStartingTraffic(traffic, actual.finances.town.activeSite, random);
    assert.deepEqual(actual.weather, weather); assert.deepEqual(actual.random, random.snapshot()); assert.equal(actual.random.simulation, seeds.simulation);
    const a = load(game.save(null)), b = load(a.save(null));
    for (let day = 0; day < 7; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
    assert.equal(a.save(null), b.save(null));
  }
});

test('cold loaded clocks use animation independently of machinery; unknown-history restarts and invalid files fail atomically', () => {
  const bytes = Buffer.from(source('SCEN4.SSM')); bytes.writeUInt16LE(1010, 0x216f7); bytes.writeUInt16LE(7, 0x216f9); bytes.writeUInt16LE(333, 0x2171e);
  const a = GameSimulation.openGeographicRegion(bytes, settings.climate, seeds, assets), initial = state(a);
  assert.equal(initial.dayTicks, 1010); assert.equal(initial.scenario.irrigation.lastTick, 1010); assert.equal(initial.traffic.delay, 333);
  a.dispatch({ type: 'advance-day' });
  assert.equal(state(a).scenario.farm.animationTicks, 1011); assert.equal(state(a).scenario.farm.timerTicks, 8);
  const legacy = JSON.parse(a.save(null)); legacy.version = 18; delete legacy.runtime.setup;
  const old = load(JSON.stringify(legacy)), before = old.save(null);
  assert.throws(() => old.restartRegion(bytes, settings.climate, assets), /terrain history/);
  assert.throws(() => old.restartGeographic(settings, assets), /terrain history/); assert.equal(old.save(null), before);
  const prior = GameSimulation.createNew(options, assets), checkpoint = prior.save(null);
  for (const invalid of [bytes.subarray(0, -1), new Uint8Array(139072)]) {
    assert.throws(() => GameSimulation.openGeographicRegion(invalid, settings.climate, seeds, assets));
    assert.throws(() => prior.restartRegion(invalid, settings.climate, assets));
  }
  assert.throws(() => GameSimulation.openGeographicRegion(bytes, { ...settings.climate, wind: 4 }, seeds, assets));
  assert.equal(prior.save(null), checkpoint);
  // Numbered result2 never chooses sites on the discarded preliminary map.
  // SF-151's extreme water map would reject at site selection; loading succeeds.
  const extreme = state(prior); extreme.weather.soilMoisture = -128; extreme.weather.moistureBalance = 0;
  const rejectedMap = beginTerrainPreview(extreme.scenario.regionalConditions, extreme.random, extreme.setup.terrainHistory!, -128, 'restart');
  assert.throws(() => locateTerrainPreview(rejectedMap), /No starting property/);
  const retained = load(writeNativeSave(extreme, null)), untouched = retained.save(null);
  const numbered = retained.restartRegion(bytes, settings.climate, assets);
  assert.equal(state(numbered).weather.soilMoisture, -128);
  assert.deepEqual(state(numbered).scenario.sourceBytes, Uint8Array.from(bytes));
  assert.equal(retained.save(null), untouched);
});
