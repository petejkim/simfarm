import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { coldTrafficDefaults, createTrafficState, readTrafficDefaults, snapshotTraffic } from '../src/formats/traffic';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { initializeWeather } from '../src/simulation/weather';
import { FarmRandom } from '../src/simulation/random';
import { initializeStartingTraffic } from '../src/simulation/starting-traffic';
import { advanceTraffic } from '../src/simulation/traffic';
import { GameSimulation } from './support/game';
import { trafficFixture } from './support/traffic';
import { newFarmAssets, newFarmOptions } from './support/new-farm';
const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
const parsed = (g: ReturnType<typeof GameSimulation.load>['simulation'], id: number | null = 4) => JSON.parse(g.save(id));

test('fresh original farms allocate eight source vehicles after weather, without modifying the input or restored RNG', () => {
  const exe = source('SIMFARM.EXE'); assert.deepEqual(coldTrafficDefaults(), readTrafficDefaults(exe));
  assert.equal(exe.subarray(0x2565, 0x2587).toString('hex'), '6a048e0600c626a130d5c1e003508e0602c626a19275c1e003509a3a16ab0983c406');
  for (let id = 0; id < 8; id++) {
    const w = readScenario(source(`SCEN${id}.SSM`)), cells = structuredClone(w.cells);
    const crops = w.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
    const random = new FarmRandom({ visual: 27, simulation: 9029, bounded: 51 });
    initializeWeather(w.climate, w.farm.calendar, w.farm.precipitationDays, random, w.cells);
    const t = createTrafficState(coldTrafficDefaults());
    initializeStartingTraffic(t, { regionX: w.farm.townRegionX, regionY: w.farm.townRegionY }, random);
    const game = new GameSimulation(w, crops), before = game.save(id);
    assert.deepEqual(game.getSnapshot().traffic, snapshotTraffic(t)); assert.deepEqual(parsed(game, id).runtime.random, random.snapshot());
    assert.deepEqual(w.cells, cells); assert.deepEqual(game.getSnapshot().scenario.cells, cells);
    game.getSnapshot().traffic.records[0].fill(0); assert.equal(game.save(id), before);
    assert.deepEqual(parsed(GameSimulation.load(before, crops).simulation, id), JSON.parse(before));
  }
});

test('canonical traffic updates original map pixels and RNG once at the frame boundary, with pause and exact continuation', () => {
  const f = trafficFixture(), expected = readNativeSave(writeNativeSave(f.state, 4)).state;
  const t = createTrafficState(expected.traffic), random = new FarmRandom(expected.random);
  advanceTraffic(expected.scenario, t, random, { animationTick: 16, notices: [] });
  const game = f.load(), initial = game.save(4); game.tick(1000); assert.equal(game.save(4), initial);
  game.dispatch({ type: 'advance-day' }); const after = game.getSnapshot();
  assert.deepEqual(after.traffic, snapshotTraffic(t)); assert.equal(after.traffic.records[0][2], 21);
  assert.deepEqual(after.scenario.cells[worldIndex(21, 20)], expected.scenario.cells[worldIndex(21, 20)]);
  assert.deepEqual(parsed(game).runtime.random.visual, random.snapshot().visual);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(0.375);
  const copy = GameSimulation.load(game.save(4), f.crops).simulation;
  for (let day = 0; day < 35; day++) for (const g of [game, copy]) g.dispatch({ type: 'advance-day' });
  assert.deepEqual(parsed(game), parsed(copy));
  assert.ok(game.getSnapshot().traffic.lastTick !== 16);
});

test('weekly spawning uses current town coordinates, heading0 and the first free slot; full tables consume no allocation draw', () => {
  for (const full of [false, true]) {
    const f = trafficFixture(), s = f.state;
    s.scenario.farm.calendar.day = 6; s.scenario.farm.townRegionX = 7; s.scenario.farm.townRegionY = 8;
    s.traffic = coldTrafficDefaults(); s.traffic.delay = 65535; s.traffic.lastTick = 16;
    if (full) { s.traffic.activeCount = 16; for (const r of s.traffic.records) r[0] = 1; }
    const expected = new FarmRandom(s.random).nextVisual() & 3, before = structuredClone(s.traffic);
    const g = f.load(); g.dispatch({ type: 'advance-day' }); const after = g.getSnapshot().traffic;
    if (full) assert.deepEqual(after, before);
    else { assert.equal(after.activeCount, 1); assert.deepEqual(after.records[0], [3, 0, 56, 0, 64, 0, 0, expected]); }
  }
});

test('traffic collision follows the animal phase, preserves breeding, emits both source smack requests and never replays on restore', () => {
  const moving = trafficFixture(true); moving.state.dayTicks = 0; moving.state.animalFrame.lastMoveTick = 0;
  const departing = moving.load(), silent: unknown[] = []; departing.subscribeEvents(e => silent.push(e));
  departing.dispatch({ type: 'set-paused', paused: false }); departing.tick(62.5); // One tick at16 ticks/day.
  const escaped = departing.getSnapshot();
  assert.deepEqual([escaped.scenario.animals[1].x, escaped.scenario.animals[1].y, escaped.scenario.animals[1].flags], [20, 19, 0x22]);
  assert.equal(escaped.traffic.records[0][0], 0x83); assert.equal(escaped.traffic.records[0][2], 21);
  assert.deepEqual(silent, []); // Moving the car before livestock would hit the departing animal.
  const f = trafficFixture(true), game = f.load(), events: unknown[] = []; game.subscribeEvents(e => events.push(e));
  game.dispatch({ type: 'advance-day' }); const s = game.getSnapshot(), a = s.scenario.animals[1];
  assert.equal(a.flags, 0x2a); assert.equal(a.bytes[30] | a.bytes[31] << 8, 16);
  assert.equal(s.traffic.records[0][0], 0x81); assert.equal(s.traffic.records[0][2], 21);
  assert.equal(s.scenario.cells[worldIndex(21, 20)].overlay & 2047, 1040);
  assert.deepEqual(events, [{ type: 'sound', sound: 'smack' }, { type: 'sound', sound: 'smack' }]);
  const copy = GameSimulation.load(game.save(4), f.crops).simulation, restoredEvents: unknown[] = [];
  copy.subscribeEvents(e => restoredEvents.push(e)); copy.dispatch({ type: 'set-paused', paused: true });
  assert.deepEqual(restoredEvents, []); assert.equal(copy.save(4), game.save(4));
});

test('v1–16 original migrations preserve map/RNG with empty traffic and v15–16 generated migrations retain all traffic bytes', () => {
  const f = trafficFixture(), current = parsed(f.load());
  for (let version = 1; version <= 16; version++) {
    const old = structuredClone(current); old.version = version; delete old.runtime.traffic;
    // Historical schemas require phase < delay; equality became valid in v18.
    old.runtime.dayTicks = old.scenario.farm.dayDelayTicks - 1;
    const g = GameSimulation.load(JSON.stringify(old), f.crops).simulation, next = parsed(g);
    assert.deepEqual(next.runtime.traffic, coldTrafficDefaults()); assert.deepEqual(next.runtime.random, old.runtime.random);
    assert.equal(next.runtime.dayTicks, old.runtime.dayTicks);
    assert.equal(next.scenario.world, old.scenario.world); assert.equal(next.version, 22);
  }
  const game = GameSimulation.createNew(newFarmOptions, newFarmAssets), before = parsed(game, null);
  for (const version of [15, 16]) {
    const old = structuredClone(before); old.version = version; old.runtime.newFarm.traffic = old.runtime.traffic; delete old.runtime.traffic;
    if (version === 15) { old.runtime.newFarm.marketMood = old.runtime.market.mood; old.runtime.newFarm.marketHistory = old.runtime.market.history; delete old.runtime.market; }
    const next = parsed(GameSimulation.load(JSON.stringify(old), newFarmAssets.crops).simulation, null);
    assert.deepEqual(next.runtime.traffic, before.runtime.traffic); assert.deepEqual(next.runtime.random, before.runtime.random);
    assert.equal(next.runtime.newFarm.traffic, undefined); assert.equal(next.scenario.world, before.scenario.world);
  }
});

test('v17 traffic rejects malformed live bytes/counts/clocks atomically while retaining inactive payloads', () => {
  const f = trafficFixture(), game = f.load(), current = parsed(game), checkpoint = game.save(4);
  for (const change of [
    (s: any) => delete s.runtime.traffic, (s: any) => s.runtime.traffic.records.pop(),
    (s: any) => s.runtime.traffic.activeCount++, (s: any) => s.runtime.traffic.records[0][2] = 96,
    (s: any) => s.runtime.traffic.records[0][4] = 96, (s: any) => s.runtime.traffic.records[0][6] = 8,
    (s: any) => s.runtime.traffic.records[0][7] = 4, (s: any) => s.runtime.traffic.records[0][1] = 256,
    (s: any) => s.runtime.traffic.delay = -1, (s: any) => s.runtime.traffic.lastTick = 65536,
  ]) {
    const bad = structuredClone(current); change(bad); assert.throws(() => GameSimulation.load(JSON.stringify(bad), f.crops), /traffic/);
    assert.equal(game.save(4), checkpoint);
  }
  const s = readNativeSave(checkpoint).state; s.traffic.records[15].fill(255); s.traffic.records[15][0] = 254;
  const restored = GameSimulation.load(writeNativeSave(s, 4), f.crops).simulation;
  assert.deepEqual(restored.getSnapshot().traffic.records[15], s.traffic.records[15]);
});
