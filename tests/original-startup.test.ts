import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readCrop } from '../src/formats/crop';
import { readScenario } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { GameSimulation } from '../src/simulation/game';
import { createNewFarmState } from '../src/simulation/create-farm';
import { restartGeneratedFarm } from '../src/simulation/restart-farm';
import { beginTerrainPreview } from '../src/simulation/terrain-preview';
import { generateFarmTerrain } from '../src/simulation/terrain-generation';
import { selectStartingLocations } from '../src/simulation/starting-property';
import { FarmRandom } from '../src/simulation/random';
import { TerrainRandom, initialTerrainHistory } from '../src/simulation/terrain-random';
import { transferOriginalFarm } from '../src/simulation/original-load';
import { newFarmAssets, newFarmOptions as options, newFarmExe as exe } from './support/new-farm';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const load = (text: string) => GameSimulation.load(text, crops, assets.townLayouts).simulation;
const state = (game: GameSimulation) => readNativeSave(game.save(null)).state;
const cold = () => new GameSimulation(readScenario(source('SCEN4.SSM')), crops, assets.townLayouts);

test('result1 opens the ordinary dialog, runs generated main startup, and reads SSM only in the subsequent button callback', () => {
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o: number, hex: string) => assert.equal(exe.subarray(o, o + hex.length / 2).toString('hex'), hex);
  exact(0x3245a, '9a3012e6249a2612e624b001a2c466a2be66b801005e5fc9cb');
  exact(0x40ee1, '807eb001740b807eb00374059a3a12e624');
  exact(0x3fa0d, '807ef601753468906168c6ac9a2810e62483c4048e0656cd26a3d0ab268916d2ab52509a1e10e62483c4048e064acd26c6068801019a2a13e624');
  exact(0x8f3b6 + 40, 'e813e624f213e624');
  exact(0x43138, '837e0a00740dff760aff7608ff76060ee8b5fa');
  exact(0x2343, '8e06f2c526803ec466027444');
  exact(0x2393, '8e06f2c526803ec466027503e91901');
  exact(0x24ef, '9abc0a981b');
  exact(0x2560, 'c746be00006a048e0600c626a130d5c1e003508e0602c626a19275c1e003509a3a16ab0983c406ff46be837ebe087cd5');
  exact(0x43257, '0ee8e12183c4040bc07470');
  exact(0x43272, '2ac08e06e8ce26a2be668e06e4ce26a288019a3413e624');
  exact(0x431e5, '8e06e8ce26803ebe6600740a8e06eace26c606940102');
});

test('all cold startup saves retain two generations and temporary market/weather/traffic before applying file state', () => {
  const preliminary = beginTerrainPreview(new Uint8Array(1008), options.seeds, initialTerrainHistory(options.seeds.simulation), 8, 'cold');
  const random = new FarmRandom(preliminary.random), terrain = new TerrainRandom(random, preliminary.terrainHistory);
  const world = generateFarmTerrain(preliminary.world.regionalConditions, preliminary.terrain, random, terrain);
  const sites = selectStartingLocations(world, random); assert.ok(sites.ok);
  const preview = { ...preliminary, world, locations: sites.locations, random: random.snapshot(), terrainHistory: terrain.snapshot() };
  const climate = { precipitation: 0, temperature: 0, wind: 0 };
  const temporary = createNewFarmState({ ...options, climate, river: true, lake: false }, assets, preview);
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), untouched = Buffer.from(bytes), file = readScenario(bytes);
    const game = GameSimulation.openOriginalSave(bytes, options, assets), actual = state(game);
    const expected = transferOriginalFarm(temporary, bytes, crops);
    assert.deepEqual(actual, readNativeSave(writeNativeSave(expected, null)).state);
    assert.deepEqual(actual.setup.climateSelection, climate); assert.deepEqual(actual.random, temporary.random);
    assert.deepEqual(actual.setup.terrainHistory, terrain.snapshot()); assert.equal(actual.traffic.activeCount, 8);
    assert.deepEqual(actual.traffic.records, temporary.traffic.records);
    assert.deepEqual(actual.weather, { ...temporary.weather, precipitationDays: file.farm.precipitationDays });
    assert.deepEqual(actual.market.history.map(row => row.slice(0, 29)), temporary.market.history.map(row => row.slice(0, 29)));
    assert.deepEqual(actual.scenario.climate, file.climate); assert.deepEqual(actual.scenario.farm.calendar, file.farm.calendar);
    assert.equal(actual.scenario.farm.cash, file.farm.cash); assert.equal(actual.newFarm, null);
    assert.deepEqual(actual.retainedSetup, temporary.newFarm); assert.deepEqual(bytes, untouched);
    const restored = load(game.save(null));
    for (let day = 0; day < 7; day++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
    assert.equal(game.save(null), restored.save(null));
  }
});

test('retained startup uses prior climate choices and reset omissions, then loaded pause depth controls resume with no second startup', () => {
  const prior = state(cold()); prior.setup.climateSelection = { precipitation: 3, temperature: 0, wind: 2 };
  prior.weather.soilMoisture = 5; prior.weather.moistureBalance = 0; prior.weather.nextForecast = [0, 1, 2, 3, 4, 3, 2];
  prior.scenario.farm.workerExpenses = 123456; prior.finances.accounts.buildingBookValue = 234567;
  prior.scenario.farm.animationTicks = 1000; prior.dayTicks = 17; prior.disasters.frameDelay = 43;
  const game = load(writeNativeSave(prior, null)), before = game.save(null);
  const preliminary = beginTerrainPreview(prior.scenario.regionalConditions, prior.random, prior.setup.terrainHistory!, 5, 'restart');
  const random = new FarmRandom(preliminary.random), terrain = new TerrainRandom(random, preliminary.terrainHistory);
  const world = generateFarmTerrain(preliminary.world.regionalConditions, preliminary.terrain, random, terrain);
  const sites = selectStartingLocations(world, random); assert.ok(sites.ok);
  const preview = { ...preliminary, world, locations: sites.locations, random: random.snapshot(), terrainHistory: terrain.snapshot() };
  const temporary = restartGeneratedFarm(prior, { ...options, climate: prior.setup.climateSelection, river: false, lake: false }, assets, preview);
  for (const depth of [0, 1, 2, 255]) {
    const bytes = Buffer.from(source('SCEN6.SSM')); bytes[0x21719] = depth; bytes[0x21718] = 0;
    bytes.writeUInt16LE(333, 0x2171a); bytes.writeUInt16LE(1010, 0x216f7); bytes.writeUInt16LE(7, 0x216f9);
    const next = game.restartOriginalSave(bytes, options.date, assets), actual = state(next);
    assert.deepEqual(actual, readNativeSave(writeNativeSave(transferOriginalFarm(temporary, bytes, crops), null)).state);
    assert.equal(actual.scenario.farm.workerExpenses, 123456); assert.equal(actual.finances.accounts.buildingBookValue, 234567);
    assert.equal(actual.dayTicks, 27); assert.equal(actual.scenario.irrigation.lastTick, 0);
    assert.equal(actual.scenario.farm.dayDelayTicks, depth === 1 ? 256 : 333);
    assert.equal(actual.disasters.frameDelay, depth === 1 ? 4 : 43);
    assert.deepEqual(actual.setup.climateSelection, prior.setup.climateSelection);
    assert.deepEqual(actual.setup.sourceArchive, prior.scenario.sourceBytes);
    assert.notDeepEqual(actual.random, state(game.importOriginal(bytes, crops).simulation).random);
    const restored = load(next.save(null));
    for (let day = 0; day < 7; day++) { next.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
    assert.equal(next.save(null), restored.save(null)); assert.equal(game.save(null), before);
  }
});

test('unknown setup history, malformed files and missing temporary crops fail atomically; ordinary import remains available', () => {
  const game = cold(), before = game.save(null), bytes = source('SCEN6.SSM');
  for (const field of ['climateSelection', 'terrainHistory'] as const) {
    const prior = state(game); prior.setup[field] = null; const legacy = load(writeNativeSave(prior, null)), checkpoint = legacy.save(null);
    assert.throws(() => legacy.restartOriginalSave(bytes, options.date, assets), field === 'climateSelection' ? /climate selection/ : /terrain history/);
    assert.equal(legacy.save(null), checkpoint); assert.ok(legacy.importOriginal(bytes, crops));
    assert.ok(GameSimulation.openOriginalSave(bytes, options, assets));
  }
  for (const input of [bytes.subarray(0, -1), new Uint8Array(139072)]) {
    assert.throws(() => game.restartOriginalSave(input, options.date, assets));
    assert.throws(() => GameSimulation.openOriginalSave(input, options, assets));
  }
  const withoutStartingCrop = crops.filter(c => `${c.id}.crp` !== assets.records.cropFiles[0]);
  assert.throws(() => GameSimulation.openOriginalSave(bytes, options, { ...assets, crops: withoutStartingCrop }), /Missing starting crop/);
  assert.throws(() => game.restartOriginalSave(bytes, { year: 1993, dayOfWeek: 7 }, assets));
  assert.equal(game.save(null), before);
});
