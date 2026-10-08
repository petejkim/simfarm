import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { GameSimulation } from './support/game';
import { livestockFixture, shopFixture } from './support/livestock';
import { disasterFixture } from './support/disasters';
import { newFarmAssets, newFarmOptions } from './support/new-farm';
import { FarmRandom } from '../src/simulation/random';
import { updateWeeklyMarket } from '../src/simulation/market';
const source = (n: string) => readFileSync(new URL(`../../simfarm-dos/${n}`, import.meta.url));
const parsed = (g: ReturnType<typeof GameSimulation.load>['simulation'], id: number | null = 4) => JSON.parse(g.save(id));

test('all original imports load base-price heads over cold history without generating new-farm histories', () => {
  for (let id = 0; id < 8; id++) {
    const world = readScenario(source(`SCEN${id}.SSM`));
    const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
    const game = new GameSimulation(world, crops), s = game.getSnapshot();
    assert.equal(s.market.mood, 0); assert.equal(s.market.rawBC72, 0); assert.equal(s.newFarm, null);
    for (let i = 0; i < 16; i++) {
      const base = crops[i].rawDefinition[34] | crops[i].rawDefinition[35] << 8;
      assert.deepEqual(s.market.history[i], [...Array(29).fill(0), base]);
      assert.equal(s.cropMarketPrices[i], base);
      assert.equal(s.scenario.harvestDefinitions[i].price, world.harvestDefinitions[i].price);
    }
    const checkpoint = game.save(id); s.market.history[0].fill(65535); s.market.mood = 255;
    assert.equal(game.save(id), checkpoint);
    assert.deepEqual(parsed(GameSimulation.load(checkpoint, crops).simulation, id), parsed(game, id));
  }
});

test('manual new-field and replanting commands change only history; failed orders and paused ticks are inert', () => {
  for (const newField of [false, true]) {
    const f = disasterFixture(), g = f.load(), before = g.getSnapshot();
    g.dispatch(newField ? { type: 'create-field', x: 40, y: 40, cropSlot: 0 } : { type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
    const after = g.getSnapshot(); assert.ok(newField ? after.lastNewFieldResult?.ok : after.lastPlantResult?.ok);
    assert.equal(after.market.history[0][29], 113); assert.deepEqual(after.cropMarketPrices, before.cropMarketPrices);
    assert.deepEqual(after.scenario.seedDefinitions.map(d => d.price), before.scenario.seedDefinitions.map(d => d.price));
    const checkpoint = g.save(4); g.tick(5000); assert.equal(g.save(4), checkpoint);
    g.dispatch({ type: 'plant-field', fieldSlot: newField ? (after.lastNewFieldResult as { slot: number }).slot : 1, cropSlot: 0 });
    assert.equal(g.save(4), checkpoint);
  }
});

test('weekly market follows animal aging and precedes scheduled planting, using the updated seed quote', () => {
  const f = livestockFixture(64), s = f.state;
  s.scenario.farm.calendar.day = 6; s.dayTicks = 63; s.disasters.enabled = false;
  s.scenario.climate.wind.fill(5); s.random.simulation = 9029;
  // One growing field with a planting order in the incoming week.
  const field = s.scenario.fields[1]; field.bytes[7] = 1; field.bytes[2] = 4;
  field.bytes[3] = 0; field.bytes[14] = 0; field.bytes.fill(0, 42, 48); field.bytes.fill(0, 64, 68);
  s.scenario.schedule.set(1, 0, 832);
  const expected = readNativeSave(writeNativeSave(s, 4)).state, random = new FarmRandom(s.random);
  random.nextSimulation(); // Calendar0xc899.
  assert.notEqual(random.nextSimulation() & 127, 75); // Aging's one vocal gate; no extra vocal draw for this seed.
  updateWeeklyMarket(expected.scenario, expected.crops, expected.market, random);
  const trade = expected.scenario.cropDefinitions.map(d => d.price), seed = expected.scenario.seedDefinitions[0].price;
  const g = f.load(); g.dispatch({ type: 'advance-day' }); const after = g.getSnapshot();
  assert.equal(after.scenario.animals[1].ageWeeks, s.scenario.animals[1].ageWeeks + 1);
  assert.equal(after.scenario.fields[1].state, 3); assert.equal(after.scenario.farm.seedExpenses - s.scenario.farm.seedExpenses, seed + 20);
  assert.deepEqual(after.scenario.cropDefinitions.map(d => d.price), trade);
  expected.market.history[0][29] = (trade[0] - ((trade[0] << 16 >> 16) >> 2)) & 65535;
  assert.deepEqual(after.market, expected.market); assert.equal(after.scenario.harvestDefinitions[0].price, trade[0]);
  assert.equal(after.scenario.seedDefinitions[0].price, seed);
});

test('manual disaster callbacks preserve trade quotes until the weekly boundary and survive restore without replay', () => {
  for (const kind of ['wind', 'frost', 'drought', 'flood'] as const) {
    const f = shopFixture(), s = f.state; s.scenario.farm.calendar.day = 6; s.dayTicks = 15;
    s.scenario.climate.wind.fill(5); s.weather.soilMoisture = 8;
    const g = f.load(), before = g.getSnapshot(); g.dispatch({ type: 'start-disaster', kind });
    assert.notDeepEqual(g.getSnapshot().market.history, before.market.history);
    assert.deepEqual(g.getSnapshot().cropMarketPrices, before.cropMarketPrices);
    const checkpoint = g.save(4), restored = GameSimulation.load(checkpoint, f.crops).simulation;
    assert.equal(restored.save(4), checkpoint);
    for (const game of [g, restored]) { game.dispatch({ type: 'set-disasters-enabled', enabled: false }); game.dispatch({ type: 'advance-day' }); }
    const after = g.getSnapshot();
    assert.deepEqual(parsed(g), parsed(restored));
    assert.deepEqual(after.market.history.map(h => h[29]), after.cropMarketPrices);
    assert.deepEqual(after.scenario.harvestDefinitions.map(d => d.price), after.cropMarketPrices);
    assert.deepEqual(after.scenario.seedDefinitions.map(d => d.price), after.cropMarketPrices.map(p => Math.max(5, p >>> 2)));
  }
});

test('v1–15 scenario migrations preserve prices/RNG, mark missing history and replace unknown samples over time', () => {
  const f = shopFixture(), current = parsed(f.load());
  for (let version = 1; version <= 15; version++) {
    const old = structuredClone(current); old.version = version; delete old.runtime.market;
    const g = GameSimulation.load(JSON.stringify(old), f.crops).simulation, migrated = parsed(g);
    assert.deepEqual(migrated.runtime.random, old.runtime.random); assert.deepEqual(migrated.runtime.cropMarketPrices, old.runtime.cropMarketPrices);
    assert.equal(migrated.runtime.market.mood, 0); assert.equal(migrated.runtime.market.rawBC72, 0);
    for (let slot = 0; slot < 16; slot++) assert.deepEqual(migrated.runtime.market.history[slot], [...Array(29).fill(null), old.runtime.cropMarketPrices[slot]]);
    assert.deepEqual(parsed(GameSimulation.load(g.save(4), f.crops).simulation), parsed(g));
  }
  const old = structuredClone(current); old.version = 15; delete old.runtime.market;
  const g = GameSimulation.load(JSON.stringify(old), f.crops).simulation; g.dispatch({ type: 'set-disasters-enabled', enabled: false });
  for (let day = 0; day < 29 * 7; day++) g.dispatch({ type: 'advance-day' });
  assert.ok(g.getSnapshot().market.history.every(h => h.every(p => p !== null)));
});

test('v15 generated migration retains existing histories/mode without startup replay, while v16 rejects malformed market state', () => {
  const g = GameSimulation.createNew(newFarmOptions, newFarmAssets), before = parsed(g, null), old = structuredClone(before);
  old.version = 15; old.runtime.newFarm.marketHistory = old.runtime.market.history; old.runtime.newFarm.marketMood = 255;
  delete old.runtime.market;
  for (const change of [
    (s: any) => delete s.runtime.newFarm.marketHistory, (s: any) => s.runtime.newFarm.marketHistory[0][29] = null,
    (s: any) => s.runtime.newFarm.marketMood = 256,
  ]) {
    const bad = structuredClone(old); change(bad);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), newFarmAssets.crops), /market/);
  }
  const migrated = GameSimulation.load(JSON.stringify(old), newFarmAssets.crops).simulation;
  assert.deepEqual(parsed(migrated, null).runtime.random, before.runtime.random);
  assert.deepEqual(migrated.getSnapshot().market, { history: before.runtime.market.history, mood: 255, rawBC72: 0 });
  assert.deepEqual(migrated.getSnapshot().cropMarketPrices, before.runtime.cropMarketPrices);
  assert.equal(parsed(migrated, null).runtime.newFarm.marketHistory, undefined);
  const valid = migrated.save(null), saved = JSON.parse(valid);
  for (const change of [
    (s: any) => delete s.runtime.market, (s: any) => s.runtime.market.history.pop(),
    (s: any) => s.runtime.market.history[0].pop(), (s: any) => s.runtime.market.history[0][29] = null,
    (s: any) => s.runtime.market.history[1][0] = -1, (s: any) => s.runtime.market.history[1][0] = 65536,
    (s: any) => s.runtime.market.mood = 256, (s: any) => s.runtime.market.rawBC72 = -1,
  ]) {
    const bad = structuredClone(saved); change(bad);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), newFarmAssets.crops), /market/); assert.equal(migrated.save(null), valid);
  }
  for (const rawBC72 of [0, 12, 13, 127, 128, 255]) {
    const s = readNativeSave(valid).state; s.market.rawBC72 = rawBC72;
    const a = GameSimulation.load(writeNativeSave(s, null), newFarmAssets.crops).simulation;
    a.dispatch({ type: 'set-disasters-enabled', enabled: false }); a.dispatch({ type: 'set-paused', paused: false }); a.tick(123.456);
    const b = GameSimulation.load(a.save(null), newFarmAssets.crops).simulation;
    for (let day = 0; day < 35; day++) for (const game of [a, b]) game.dispatch({ type: 'advance-day' });
    assert.deepEqual(parsed(a, null), parsed(b, null));
  }
});
