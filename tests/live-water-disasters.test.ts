import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { waterDisasterFixture } from './support/water-disasters';
import { disasterFixture } from './support/disasters';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { worldIndex } from '../src/formats/scenario';
import type { GameEvent } from '../src/simulation/events';
import { readFileSync } from 'node:fs';
import { readScenario } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';

const saved = (g: ReturnType<typeof GameSimulation.load>['simulation']) => JSON.parse(g.save(4));

test('live flood saves mid-scan, destroys fields and storage, retains unknown words and ends with exact35-day continuation', () => {
  const f = waterDisasterFixture(), g = f.load(), events: GameEvent[] = []; g.subscribeEvents(e => events.push(e));
  const cash = g.getSnapshot().scenario.farm.cash;
  g.dispatch({ type: 'start-disaster', kind: 'flood' });
  assert.deepEqual(events, [{type:'disaster-notice',id:'flood'}, { type: 'sound', sound: 'flood' }]);
  assert.equal(g.getSnapshot().waterDisasters.scanning, true); assert.equal(g.getSnapshot().weather.precipitationBonus, 4);
  const paused = g.save(4); g.tick(20000); assert.equal(g.save(4), paused);
  g.dispatch({ type: 'set-paused', paused: false }); g.tick(2000.5);
  const snap = g.getSnapshot(); assert.equal(snap.scenario.fields[1].active, false); assert.equal(snap.scenario.buildings[1].active, true);
  assert.deepEqual([snap.waterDisasters.scanX, snap.waterDisasters.scanY], [21, 74]);
  assert.equal(snap.scenario.farm.cash, cash); assert.equal(events.filter(e => e.type === 'sound' && e.sound === 'explode').length, 1);
  const original = g.save(4); snap.waterDisasters.scanX = 90; assert.equal(g.save(4), original);
  const state = readNativeSave(original).state; state.waterDisasters.rawFF6C = 0x1234; state.waterDisasters.rawFF6E = 0xabcd;
  const a = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
  const checkpoint = a.save(4), b = GameSimulation.load(checkpoint, f.crops).simulation;
  const restoredEvents: GameEvent[] = []; b.subscribeEvents(e => restoredEvents.push(e));
  assert.equal(saved(a).version, 26); assert.equal(b.save(4), checkpoint);
  a.tick(1201); b.tick(400); b.tick(801); assert.deepEqual(saved(a), saved(b));
  for (const game of [a, b]) {
    game.dispatch({ type: 'set-disasters-enabled', enabled: false });
    const before = game.save(4); game.dispatch({ type: 'start-disaster', kind: 'drought' }); assert.equal(game.save(4), before);
    game.dispatch({ type: 'set-speed', speed: 4 }); game.tick(400);
    assert.equal(game.getSnapshot().scenario.buildings[1].active, false); assert.equal(game.getSnapshot().scenario.equipment[1].active, false);
    assert.equal(game.getSnapshot().scenario.farm.cash, cash);
    game.dispatch({ type: 'set-paused', paused: true });
    for (let day = 0; day < 35; day++) game.dispatch({ type: 'advance-day' });
  }
  assert.deepEqual(saved(a), saved(b));
  assert.equal(b.getSnapshot().disasters.flags & 4, 0); assert.equal(b.getSnapshot().waterDisasters.counter, -8);
  assert.equal(b.getSnapshot().waterDisasters.scanning, false); assert.equal(b.getSnapshot().waterDisasters.rawFF6C, 0x1234);
  assert.equal(b.getSnapshot().waterDisasters.rawFF6E, 0xabcd); assert.equal(b.getSnapshot().weather.precipitationBonus, 0);
  assert.equal(restoredEvents.filter(e => e.type === 'sound' && e.sound === 'flood').length, 0);
  assert.equal(restoredEvents.filter(e => e.type === 'sound' && e.sound === 'explode').length, 1);
  assert.ok(b.getSnapshot().disasterNotices.some(n => n.includes('receded')));
});

test('live drought changes original shoreline tiles without start audio and resumes its next-week recovery from a checkpoint', () => {
  const f = waterDisasterFixture(), g = f.load(), events: GameEvent[] = []; g.subscribeEvents(e => events.push(e));
  const cash = g.getSnapshot().scenario.farm.cash;
  g.dispatch({ type: 'start-disaster', kind: 'drought' });
  assert.equal(g.getSnapshot().disasters.flags & 2, 2); assert.deepEqual(events,[{type:'disaster-notice',id:'drought'}]);
  assert.equal(g.getSnapshot().scenario.cells[worldIndex(20, 19)].terrain, 0x101c);
  const copy = GameSimulation.load(g.save(4), f.crops).simulation;
  for (const game of [g, copy]) for (let day = 0; day < 7; day++) game.dispatch({ type: 'advance-day' });
  assert.deepEqual(saved(g), saved(copy)); assert.equal(g.getSnapshot().disasters.flags & 2, 0);
  assert.equal(g.getSnapshot().scenario.cells[worldIndex(20, 19)].terrain & 0x3000, 0x3000);
  assert.equal(g.getSnapshot().scenario.fields[1].active, true); assert.equal(g.getSnapshot().scenario.buildings[1].active, true);
  assert.equal(g.getSnapshot().scenario.farm.cash, cash); assert.ok(g.getSnapshot().disasterNotices.some(n => n.includes('drought has ended')));
});

test('weekly moisture requests and flood counters retain original strict thresholds, ordering, disabled starts and inactive counter quirk', () => {
  for (const [moisture, initialFlag, counter, enabled, expectedFlags, expectedCounter] of [
    [14, 0, 0, true, 4, 0], [13, 0, 0, true, 0, 0], [-1, 0, 0, true, 2, 0], [0, 0, 0, true, 0, 0],
    [14, 0, 0, false, 0, 0], [-1, 0, 0, false, 0, 0], [14, 0, -8, true, 0, -8],
    [9, 4, 2, true, 4, 3], [9, 4, 3, true, 0, -8], [10, 4, 3, true, 4, 4], [12, 4, 8, true, 0, -8],
    [3, 2, 0, false, 0, 0], [2, 2, 0, true, 2, 0],
  ] as const) {
    const f = disasterFixture(); Object.assign(f.state.scenario.farm.calendar, { day: 6, week: 0, month: 0 }); f.state.dayTicks = 64;
    f.state.weather.soilMoisture = moisture; f.state.weather.moistureBalance = 0;
    f.state.disasters.flags = initialFlag; f.state.disasters.enabled = enabled; f.state.waterDisasters.counter = counter;
    const game = f.load(); game.dispatch({ type: 'advance-day' });
    assert.equal(game.getSnapshot().disasters.flags & 6, expectedFlags, `moisture${moisture},flag${initialFlag},counter${counter}`);
    assert.equal(game.getSnapshot().waterDisasters.counter, expectedCounter);
  }
});

test('v14 rejects malformed water runtime; v13 migration preserves flags, moisture bonus, map and RNG without inventing a scan', () => {
  const f = waterDisasterFixture(), g = f.load(); g.dispatch({ type: 'start-disaster', kind: 'flood' });
  const save = saved(g), original = g.save(4);
  for (const patch of [{ counter: 128 }, { counter: -129 }, { scanning: 1 }, { scanning: true, scanX: 94 },
    { scanY: 94 }, { scanX: 0.5 }, { rawFF6C: -1 }, { rawFF6E: 65536 }]) {
    const bad = structuredClone(save); Object.assign(bad.runtime.waterDisasters, patch);
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), f.crops)); assert.equal(g.save(4), original);
  }
  const missing = structuredClone(save); delete missing.runtime.waterDisasters;
  assert.throws(() => GameSimulation.load(JSON.stringify(missing), f.crops));
  missing.version = 13; missing.runtime.disasters.flags |= 0x100; missing.runtime.disasterFlags |= 0x100;
  const loaded = GameSimulation.load(JSON.stringify(missing), f.crops).simulation, migrated = saved(loaded);
  assert.deepEqual(migrated.runtime.random, missing.runtime.random);
  assert.deepEqual(migrated.scenario, { ...missing.scenario, farm: { ...missing.scenario.farm, equipmentPacingByte: null } });
  assert.deepEqual(migrated.runtime.weather, missing.runtime.weather); assert.equal(migrated.runtime.disasters.flags, 0x104);
  assert.deepEqual(migrated.runtime.waterDisasters, { counter: 0, scanning: false, scanX: 0, scanY: 0, rawFF6C: 0, rawFF6E: 0 });
  assert.equal(loaded.getSnapshot().disasterNotices.length, 0); assert.equal(loaded.getSnapshot().lastDisasterResult, null);
});

test('modal flight suspends a flood unless the original tornado-gated disaster call runs; new moisture-event commands remain blocked', () => {
  const f = aircraftFixture(), g = f.load(); g.dispatch({ type: 'buy-aircraft' });
  g.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'fuel' } });
  g.dispatch({ type: 'start-disaster', kind: 'flood' }); g.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 });
  g.dispatch({ type: 'set-paused', paused: true }); const original = g.save(4);
  g.dispatch({ type: 'start-disaster', kind: 'drought' }); g.dispatch({ type: 'start-disaster', kind: 'flood' });
  assert.equal(g.save(4), original); g.dispatch({ type: 'step-flight' }); assert.equal(g.getSnapshot().waterDisasters.scanY, 0);
  const state = readNativeSave(g.save(4)).state; state.disasters.flags |= 1;
  Object.assign(state.disasters.tornado, { x: 70, y: 70 });
  const active = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
  active.dispatch({ type: 'step-flight' });
  assert.ok(active.getSnapshot().waterDisasters.scanY > 0); assert.equal(active.getSnapshot().daysAdvanced, 0);
  GameSimulation.load(active.save(4), f.crops);
});

test('all eight source farms remain loadable through a live flood and70 days of original work, drainage and weather', () => {
  const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
  for (let id = 0; id < 8; id++) {
    const world = readScenario(source(`SCEN${id}.SSM`));
    const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
    const g = new GameSimulation(world, crops); g.dispatch({ type: 'start-disaster', kind: 'flood' });
    for (let day = 0; day < 70; day++) {
      g.dispatch({ type: 'advance-day' });
      if (day === 0 || day === 2 || day === 27 || day === 34 || day === 62 || day === 69) {
        const checkpoint = g.save(id);
        assert.deepEqual(JSON.parse(GameSimulation.load(checkpoint, crops).simulation.save(id)), JSON.parse(checkpoint));
      }
    }
    assert.equal(g.getSnapshot().daysAdvanced, 70, `farm${id} completed every day`);
    assert.equal(g.getSnapshot().disasters.flags & 4, 0, `farm${id} drained by its ninth weekly counter update`);
    assert.equal(g.getSnapshot().waterDisasters.counter, -8);
  }
}, 60000);
