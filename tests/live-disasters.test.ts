import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { disasterFixture } from './support/disasters';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { purchaseBuilding } from '../src/simulation/building-placement';
import { purchaseEquipment } from '../src/simulation/equipment-purchase';
import { damageDisasterCell } from '../src/simulation/disaster-damage';
import { flightPosition } from '../src/simulation/aircraft-flight';
import type { GameEvent } from '../src/simulation/events';

const saved = (g: ReturnType<typeof GameSimulation.load>['simulation']) => JSON.parse(g.save(4));
const loss = (b: Uint8Array) => b[18] | b[19] << 8;

test('live locusts damage a real field, checkpoint every clock/RNG phase, pause, change speed and expire identically', () => {
  const f = disasterFixture(), game = f.load(), events: GameEvent[] = []; game.subscribeEvents(e => events.push(e));
  game.dispatch({ type: 'start-disaster', kind: 'swarm' });
  assert.deepEqual(events, [{ type: 'sound', sound: 'swarm' }]); assert.equal(game.getSnapshot().disasters.flags, 32);
  const before = game.save(4); game.tick(5000); assert.equal(game.save(4), before);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(320.125);
  assert.ok(loss(game.getSnapshot().scenario.fields[1].bytes) >= 1024);
  const checkpoint = game.save(4), restored = GameSimulation.load(checkpoint, f.crops).simulation;
  assert.equal(saved(game).version, 22); const restoredEvents: GameEvent[] = []; restored.subscribeEvents(e => restoredEvents.push(e));
  game.getSnapshot().disasters.swarm.x = 90; game.getSnapshot().disasterNotices.push('changed'); assert.equal(game.save(4), checkpoint);
  game.tick(300.25); restored.tick(100); restored.tick(200.25); assert.deepEqual(saved(game), saved(restored));
  for (const g of [game, restored]) {
    g.dispatch({ type: 'set-disasters-enabled', enabled: false }); assert.equal(g.getSnapshot().disasters.flags & 32, 32);
    g.dispatch({ type: 'set-speed', speed: 4 }); g.tick(2500);
  }
  assert.equal(game.getSnapshot().disasters.flags & 32, 0); assert.deepEqual(saved(game), saved(restored));
  assert.equal(restoredEvents.filter(e => e.type === 'sound' && e.sound === 'swarm').length, 0);
  assert.ok(game.getSnapshot().disasterNotices.some(n => n.includes('dispersed')));
});

test('source July requests and weekly wind start real disasters, and low wind stops tornado only after its minimum age', () => {
  for (const [seed, flag] of [[17, 32], [440, 1], [196, 8]]) {
    const f = disasterFixture(); Object.assign(f.state.scenario.farm.calendar, { day: 6, week: 0, month: 6 });
    f.state.random.simulation = seed; f.state.dayTicks = 64;
    const game = f.load(); game.dispatch({ type: 'advance-day' });
    assert.equal(game.getSnapshot().disasters.flags & flag, flag, `source seed${seed}`);
    assert.ok(game.getSnapshot().disasterNotices.length > 0);
  }
  const f = disasterFixture(); f.state.scenario.climate.wind.fill(80);
  Object.assign(f.state.scenario.farm.calendar, { day: 6, week: 0 }); f.state.dayTicks = 64;
  const game = f.load(); game.dispatch({ type: 'advance-day' }); assert.equal(game.getSnapshot().disasters.flags & 9, 9);
  const state = readNativeSave(game.save(4)).state; state.scenario.climate.wind.fill(5); state.weather.windAnomaly = 0;
  for (const age of [1919, 1920]) {
    state.scenario.farm.animationTicks = (state.disasters.tornado.startedTick + age - 1) & 65535;
    Object.assign(state.scenario.farm.calendar, { day: 6, week: 1 }); state.dayTicks = 64;
    const g = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation; g.dispatch({ type: 'advance-day' });
    assert.equal(Boolean(g.getSnapshot().disasters.flags & 1), age < 1920); assert.equal(g.getSnapshot().disasters.flags & 8, 0);
  }
});

test('tornado damage destroys an occupied building; native interruption removes dangling jobs/links without credit and survives continuation', () => {
  const f = disasterFixture(), w = f.state.scenario, a = f.state.finances, field = w.fields[1];
  assert.ok(purchaseBuilding(w, a, 67, 10, 10, 0).ok); assert.ok(purchaseEquipment(w, a, 0, 10, 10, 0).ok);
  assert.ok(purchaseEquipment(w, a, 1, 40, 40, 0).ok);
  const tractor = w.equipment[1], implement = w.equipment[2];
  tractor.flags |= 9; tractor.bytes[48] = 1; field.equipment = tractor.slot; field.pendingEquipment = implement.slot;
  field.bytes[2] = 3; field.bytes[3] = 3; field.bytes[6] = 0; implement.flags |= 9;
  tractor.attachment = implement.slot; implement.parent = tractor.slot;
  const cash = w.farm.cash, book = a.accounts.assets.equipmentBookValue, price = w.equipmentDefinitions[0].price;
  const damage = damageDisasterCell(w, a, 10, 10, 0); assert.ok(damage.ok); assert.equal(damage.buildingSlot, 1);
  assert.equal(tractor.active, false); assert.equal(implement.active, true); assert.equal(implement.parent, 0); assert.equal(implement.flags & 11, 0);
  assert.equal(field.state, 0); assert.equal(field.equipment, 0); assert.equal(field.pendingEquipment, 0);
  assert.equal(w.farm.cash, cash); assert.equal(a.accounts.assets.equipmentBookValue, (book - price) >>> 0);
  const game = f.load(), restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (const g of [game, restored]) for (let i = 0; i < 35; i++) g.dispatch({ type: 'advance-day' });
  assert.deepEqual(saved(game), saved(restored));
  // The canonical moving callback also destroys a real building at its offset.
  const live = disasterFixture(); assert.ok(purchaseBuilding(live.state.scenario, live.state.finances, 65, 10, 10, 0).ok);
  live.state.disasters.flags = 1; Object.assign(live.state.disasters.tornado, { frame: 3, x: 8, y: 7 });
  const moving = live.load(); moving.dispatch({ type: 'advance-day' }); assert.equal(moving.getSnapshot().scenario.buildings[1].active, false);
  GameSimulation.load(moving.save(4), live.crops);
});

test('tornado continues during modal flight and feeds the original turbulence/crash test while calendar stays suspended', () => {
  const f = aircraftFixture(), game = f.load(); game.dispatch({ type: 'buy-aircraft' });
  game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'fuel' } });
  game.dispatch({ type: 'start-disaster', kind: 'tornado' });
  game.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 });
  const state = readNativeSave(game.save(4)).state; Object.assign(state.disasters.tornado, { x: 60, y: 60 });
  const g = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation, before = g.save(4), days = g.getSnapshot().daysAdvanced;
  g.dispatch({ type: 'start-disaster', kind: 'swarm' }); g.dispatch({ type: 'set-disasters-enabled', enabled: false }); assert.equal(g.save(4), before);
  g.tick(400); assert.ok(g.getSnapshot().disasters.tornado.lastTick > 0); assert.equal(g.getSnapshot().daysAdvanced, days);
  const near = readNativeSave(g.save(4)).state, p = flightPosition(near.aircraftFlight!);
  Object.assign(near.disasters.tornado, { x: p.x, y: p.y });
  const crash = GameSimulation.load(writeNativeSave(near, 4), f.crops).simulation; crash.tick(125);
  assert.equal(crash.getSnapshot().lastFlightEnd?.cause, 'tornado'); assert.equal(crash.getSnapshot().aircraftFlight, null);
  assert.equal(crash.getSnapshot().daysAdvanced, days); GameSimulation.load(crash.save(4), f.crops);
});

test('v13 validates disaster state and flag alias; v12 migrates flags without inventing a moving effect or consuming RNG', () => {
  const f = disasterFixture(), g = f.load(); g.dispatch({ type: 'start-disaster', kind: 'swarm' });
  const save = saved(g), original = g.save(4);
  for (const mutate of [(s: typeof save) => { s.runtime.disasters.tornado.x = 96; },
    (s: typeof save) => { s.runtime.disasters.flags = 33; s.runtime.disasterFlags = 33; },
    (s: typeof save) => { s.runtime.disasters.swarm.fieldSlot = 0; },
    (s: typeof save) => { s.runtime.disasters.swarm.frame = 4; },
    (s: typeof save) => { s.runtime.disasters.enabled = 1; },
    (s: typeof save) => { s.runtime.disasterFlags = 0; }]) {
    const bad = structuredClone(save); mutate(bad); assert.throws(() => GameSimulation.load(JSON.stringify(bad), f.crops)); assert.equal(g.save(4), original);
  }
  save.version = 12; delete save.runtime.disasters; save.runtime.disasterFlags = 0x129;
  const restored = GameSimulation.load(JSON.stringify(save), f.crops).simulation;
  assert.equal(restored.getSnapshot().disasters.flags, 0x108); assert.equal(restored.getSnapshot().disasters.swarm.fieldSlot, 0);
  assert.deepEqual(saved(restored).runtime.random, save.runtime.random);
});
