import { beginTerrainPreview } from '../src/simulation/terrain-preview';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../src/simulation/game';
import { readScenario } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { readCrop } from '../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { climateForSetup } from '../src/formats/new-farm';
import { FarmRandom } from '../src/simulation/random';
import { initializeStartupWeather } from '../src/simulation/weather';
import { initializeStartingTraffic } from '../src/simulation/starting-traffic';
import { createTrafficState } from '../src/formats/traffic';
import { newFarmAssets, newFarmOptions } from './support/new-farm';

const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops }, selection = { precipitation: 0, temperature: 3, wind: 1 };
const restore = (text: string) => GameSimulation.load(text, crops, assets.townLayouts).simulation;
const parsed = (game: GameSimulation) => JSON.parse(game.save(null));

test('all loaded restart outcomes reset before loading, retain date/history, finalize climate/town and avoid the in-game resume callback', () => {
  const generated = GameSimulation.createNew(newFarmOptions, assets);
  const state = readNativeSave(generated.save(null)).state;
  state.scenario.farm.workerExpenses = 12345; state.finances.accounts.buildingBookValue = 76543;
  state.finances.accounts.taxExpenses = 333; state.finances.homestead.rank = 4;
  state.finances.taxFailures = 7; state.finances.loanRate = 19;
  state.scenario.farm.animationTicks = 1000; state.scenario.farm.timerTicks = 2; state.dayTicks = 17;
  state.weather.soilMoisture = 5; state.weather.moistureBalance = 0; state.weather.wind = 27;
  state.weather.nextForecast = [4, 3, 2, 1, 0, 1, 2];
  state.weather.windYear = 4; state.weather.temperatureYear = 3; state.weather.precipitationYear = 2;
  state.traffic.records[0][1] = 213; state.traffic.lastTick = 555;
  state.scenario.irrigation.flow = [{ x: 94, y: 93, strength: 255 }]; state.scenario.irrigation.active = true;
  state.animalFrame.lastMoveTick = 777; state.disasters.frameDelay = 23;
  state.paused = false; state.speed = 4; state.daysAdvanced = 123;
  const old = restore(writeNativeSave(state, null)), before = old.save(null);
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), file = readScenario(bytes), fileFinances = readFinancialState(bytes);
    const game = old.restartRegion(bytes, selection, assets), next = readNativeSave(game.save(null)).state;
    assert.deepEqual(next.scenario.sourceBytes, Uint8Array.from(bytes)); assert.equal(next.scenario.origin, 'original');
    assert.equal(next.newFarm, null); assert.deepEqual(next.retainedSetup, state.newFarm);
    const preliminary = beginTerrainPreview(state.scenario.regionalConditions, state.random, state.setup.terrainHistory!, 5, 'restart');
    assert.deepEqual(next.setup, { ...state.setup, terrainHistory: preliminary.terrainHistory, previewRaw: preliminary.raw });
    assert.deepEqual(next.scenario.farm.calendar, file.farm.calendar);
    assert.deepEqual(next.scenario.climate, climateForSetup(assets.climate, selection));
    assert.equal(next.scenario.farm.cash, 40000); assert.equal(next.scenario.farm.workerExpenses, 12345);
    assert.equal(next.finances.accounts.buildingBookValue, 76543); assert.equal(next.finances.homestead.rank, 255);
    assert.equal(next.finances.taxFailures, 7); assert.equal(next.finances.loanRate, 19);
    assert.deepEqual(next.finances.loan, fileFinances.loan);
    assert.equal(next.finances.debt.balanceDue, 0); assert.equal(next.finances.debt.balanceCountdown, 0);
    assert.deepEqual(next.scenario.fields.map(f => f.bytes), file.fields.map(f => f.bytes));
    assert.deepEqual(next.scenario.schedule.bytes, file.schedule.bytes);
    assert.equal(next.dayTicks, (file.farm.animationTicks - 983) & 65535);
    assert.equal(next.equipmentAnimationTick, file.farm.animationTicks); assert.equal(next.animalFrame.lastMoveTick, 777);
    assert.equal(next.scenario.farm.speed, file.farm.speed); assert.equal(next.scenario.farm.dayDelayTicks, file.farm.dayDelayTicks);
    assert.equal(next.scenario.irrigation.delay, file.irrigation.delay); assert.equal(next.disasters.frameDelay, 23);
    assert.equal(next.scenario.irrigation.lastTick, file.farm.animationTicks);
    assert.equal(next.scenario.irrigation.active, false); assert.deepEqual(next.scenario.irrigation.flow, []);
    assert.deepEqual(next.scenario.irrigation.sources, file.irrigation.sources);
    assert.deepEqual(next.weather.forecast, state.weather.nextForecast); assert.equal(next.weather.wind, 27);
    assert.equal(next.weather.soilMoisture, 5); assert.equal(next.weather.precipitationDays, file.farm.precipitationDays);
    assert.deepEqual([next.weather.windYear, next.weather.temperatureYear, next.weather.precipitationYear], [0, 0, 0]);
    assert.deepEqual(next.market.history.map(h => h.slice(0, 29)), state.market.history.map(h => h.slice(0, 29)));
    assert.deepEqual(next.market.history.map(h => h[29]), next.cropMarketPrices);
    assert.equal(next.traffic.activeCount, 8); assert.equal(next.traffic.records[0][1], 213); assert.equal(next.traffic.lastTick, 555);
    const random = new FarmRandom(preliminary.random), weather = { ...structuredClone(state.weather), windYear: 0, temperatureYear: 0, precipitationYear: 0 };
    initializeStartupWeather(weather, next.scenario.climate, file.farm.calendar, random, structuredClone(file.cells));
    const traffic = createTrafficState({ ...next.traffic, records: next.traffic.records.map(r => [0, ...r.slice(1)]), activeCount: 0 });
    initializeStartingTraffic(traffic, next.finances.town.activeSite, random);
    assert.deepEqual(next.random, random.snapshot()); // No new market history or menu resume draws.
    assert.equal(next.paused, true); assert.equal(next.speed, 4); assert.equal(next.daysAdvanced, 0);
    assert.equal(next.pendingTown, null); assert.equal(next.aircraftFlight, null); assert.equal(next.finances.defaultDecision, null);
    assert.deepEqual(parsed(restore(game.save(null))), parsed(game)); assert.equal(old.save(null), before);
  }
});

test('loaded restart survives repeated source replacements and days, and rejects invalid assets or files atomically', () => {
  const old = GameSimulation.createNew(newFarmOptions, assets), before = old.save(null);
  const a = old.restartRegion(source('SCEN6.SSM'), selection, assets), b = restore(a.save(null));
  for (let day = 0; day < 35; day++) { a.dispatch({ type: 'advance-day' }); b.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(parsed(a), parsed(b));
  const second = a.restartRegion(source('SCEN7.SSM'), selection, assets);
  assert.deepEqual(parsed(second), parsed(restore(a.save(null)).restartRegion(source('SCEN7.SSM'), selection, assets)));
  for (const bytes of [source('SCEN6.SSM').subarray(0, -1), new Uint8Array(139072)]) assert.throws(() => old.restartRegion(bytes, selection, assets));
  assert.throws(() => old.restartRegion(source('SCEN6.SSM'), { ...selection, wind: 4 }, assets));
  assert.throws(() => old.restartRegion(source('SCEN6.SSM'), selection, { ...assets, crops: [] }), /Missing simulation crop/);
  assert.equal(old.save(null), before);
  // The full chooser now consumes preliminary draws even for a numbered farm.
  // Legacy missing history cannot be recovered from the current RNG words.
  const legacy = parsed(a); legacy.version = 18; legacy.runtime.retainedSetup = null; delete legacy.runtime.setup;
  const unknown = restore(JSON.stringify(legacy)), oldCheckpoint = unknown.save(null);
  assert.throws(() => unknown.restartRegion(source('SCEN4.SSM'), selection, assets), /no retained terrain history/);
  assert.equal(unknown.save(null), oldCheckpoint);
  assert.deepEqual(parsed(restore(oldCheckpoint)), parsed(unknown));
});
