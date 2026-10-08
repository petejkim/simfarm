import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { flightPosition, MAX_FLIGHT_INPUTS, type FlightControl } from '../src/simulation/aircraft-flight';
import { aircraftFuel, aircraftPayload } from '../src/simulation/aircraft';

function ready(paused = true) {
  const f = aircraftFixture(); f.state.scenario.farm.dayDelayTicks = 1000;
  f.state.dayTicks = 3; f.state.paused = paused;
  const game = f.load(); game.dispatch({ type: 'buy-aircraft' });
  for (const kind of ['fuel', 'load'] as const) game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind } });
  return { ...f, game };
}
const launch = (game: ReturnType<typeof ready>['game']) => game.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 });
const saved = (game: ReturnType<typeof ready>['game']) => JSON.parse(game.save(4));

test('live flight advances both original clocks while suspending ordinary farm phases and commands', () => {
  const { game } = ready(); launch(game); const before = saved(game), view = game.getSnapshot();
  assert.equal(view.paused, false); assert.equal(view.aircraftFlight?.resumePaused, true);
  assert.deepEqual(view.lastFlightStartResult, { ok: true });
  for (const command of [
    { type: 'advance-day' }, { type: 'buy-aircraft' }, { type: 'borrow', amount: 1000 },
    { type: 'service-aircraft', slot: 1, action: { kind: 'fuel' } }, { type: 'set-auto-clear', enabled: true },
    { type: 'start-flight', slot: 1, columns: 40, rows: 30 },
  ] as const) game.dispatch(command);
  assert.deepEqual(saved(game), before);
  game.tick(100); const after = saved(game), s = game.getSnapshot();
  assert.equal(s.scenario.farm.timerTicks, 100); assert.equal(s.scenario.farm.animationTicks, 100);
  assert.deepEqual(s.scenario.farm.calendar, view.scenario.farm.calendar);
  assert.equal(s.daysAdvanced, view.daysAdvanced); assert.equal(after.runtime.dayTicks, 3);
  for (const key of ['random', 'weather', 'animalFrame', 'equipmentAnimationTick', 'finances'])
    assert.deepEqual(after.runtime[key], before.runtime[key]);
  for (const key of ['fields', 'animals', 'buildings', 'inventory', 'chemicals'])
    assert.equal(after.scenario.records[key], before.scenario.records[key]);
  assert.equal(aircraftFuel(s.scenario.equipment[1]), 253); assert.equal(s.scenario.equipment[1].condition, 2);
  const checkpoint = game.save(4); s.aircraftFlight!.inputs.push('end'); s.aircraftFlight!.cameraX = 80;
  assert.equal(game.save(4), checkpoint); // Snapshot cannot steer or corrupt canonical state.
});

test('v12 resumes fractional flight ticks and queued controls exactly across pause, speed changes, wrap and frame partitioning', () => {
  const { game, crops } = ready(); launch(game);
  game.dispatch({ type: 'flight-control', control: 'spray-on' }); game.tick(7.375);
  for (const control of ['left', 'right', 'climb', 'spray-off', 'spray-on'] as const) game.dispatch({ type: 'flight-control', control });
  const checkpoint = game.save(4), restored = GameSimulation.load(checkpoint, crops).simulation;
  assert.equal(saved(game).version, 12); assert.equal(saved(game).runtime.elapsed, 0.375);
  game.tick(111.625); for (const ms of [0.625, 1, 30, 0.5, 79.5]) restored.tick(ms);
  assert.deepEqual(saved(restored), saved(game));
  for (const g of [game, restored]) {
    g.dispatch({ type: 'set-paused', paused: true }); const paused = g.save(4); g.tick(5000); assert.equal(g.save(4), paused);
    g.dispatch({ type: 'set-speed', speed: 4 }); g.dispatch({ type: 'flight-control', control: 'left' });
    const tick = g.getSnapshot().scenario.farm.animationTicks;
    g.dispatch({ type: 'step-flight' }); assert.equal(g.getSnapshot().scenario.farm.animationTicks, (tick + 2) & 65535);
    g.dispatch({ type: 'set-paused', paused: false }); g.tick(10.375);
  }
  assert.deepEqual(saved(restored), saved(game));
  const state = readNativeSave(checkpoint).state, flight = state.aircraftFlight!;
  state.scenario.farm.animationTicks = 65535; state.scenario.farm.timerTicks = 65535;
  flight.lastFrameTick = 65534; flight.lastWearTick = 65528; flight.lastFuelTick = 65528; flight.lastSprayTick = 65528;
  const wrap = GameSimulation.load(writeNativeSave(state, 4), crops).simulation;
  wrap.tick(2); assert.equal(wrap.getSnapshot().scenario.farm.animationTicks, 1);
  assert.deepEqual(saved(GameSimulation.load(wrap.save(4), crops).simulation), saved(wrap));
});

test('queued landing restores prior pause without advancing leftover wall time; running flight returns to the ordinary calendar', () => {
  const { game, crops } = ready(); launch(game); game.dispatch({ type: 'flight-control', control: 'end' });
  const restored = GameSimulation.load(game.save(4), crops).simulation;
  game.tick(1000); restored.tick(1); restored.tick(1); restored.tick(998);
  assert.deepEqual(saved(game), saved(restored));
  assert.equal(game.getSnapshot().aircraftFlight, null); assert.equal(game.getSnapshot().paused, true);
  assert.equal(game.getSnapshot().lastFlightEnd?.kind, 'landed');
  assert.equal(game.getSnapshot().scenario.farm.animationTicks, 2); assert.equal(saved(game).runtime.dayTicks, 3);
  const running = ready(false); launch(running.game); running.game.dispatch({ type: 'flight-control', control: 'end' });
  running.game.tick(1000); assert.equal(running.game.getSnapshot().paused, false);
  assert.equal(running.game.getSnapshot().daysAdvanced, 1); assert.equal(running.game.getSnapshot().aircraftFlight, null);
});

test('paused step lands without an extra farm tick, and a saved airborne crash releases parking and removes book value once', () => {
  const f = ready(); launch(f.game); f.game.tick(1); f.game.dispatch({ type: 'set-paused', paused: true });
  f.game.dispatch({ type: 'flight-control', control: 'end' }); f.game.dispatch({ type: 'step-flight' });
  assert.equal(f.game.getSnapshot().scenario.farm.animationTicks, 2); assert.equal(saved(f.game).runtime.dayTicks, 3);
  const { game, crops } = ready(); launch(game); game.tick(40); // Westward travel has left the airport.
  assert.ok(flightPosition(game.getSnapshot().aircraftFlight!).x < 16);
  game.dispatch({ type: 'flight-control', control: 'end' }); const before = saved(game), restored = GameSimulation.load(game.save(4), crops).simulation;
  for (const g of [game, restored]) { g.tick(2); assert.equal(g.getSnapshot().lastFlightEnd?.kind, 'crashed'); }
  assert.deepEqual(saved(game), saved(restored));
  assert.equal(game.getSnapshot().scenario.equipment[1].active, false);
  assert.equal(game.getSnapshot().finances.accounts.assets.equipmentBookValue, (before.runtime.finances.accounts.assets.equipmentBookValue - 6000) >>> 0);
  const after = game.save(4); game.dispatch({ type: 'step-flight' }); game.tick(3000); assert.equal(game.save(4), after);
});

test('flight checkpoint boundaries, modal exclusions, control capacity and v11 migration reject malformed state without changing a live farm', () => {
  const { game, crops } = ready(); const legacy = saved(game); legacy.version = 11; delete legacy.runtime.aircraftFlight;
  assert.equal(GameSimulation.load(JSON.stringify(legacy), crops).simulation.getSnapshot().aircraftFlight, null);
  const before = game.save(4); game.dispatch({ type: 'start-flight', slot: 1, columns: 7, rows: 16 });
  assert.equal(game.save(4), before); assert.deepEqual(game.getSnapshot().lastFlightStartResult, { ok: false, reason: 'invalid-viewport' });
  launch(game); game.dispatch({ type: 'set-paused', paused: true });
  for (let i = 0; i < MAX_FLIGHT_INPUTS + 2; i++) game.dispatch({ type: 'flight-control', control: 'left' });
  assert.equal(game.getSnapshot().aircraftFlight!.inputs.length, MAX_FLIGHT_INPUTS);
  const checkpoint = game.save(4), data = saved(game);
  assert.throws(() => game.dispatch({ type: 'flight-control', control: 'bad' as FlightControl }), /flight control/);
  for (const [key, value] of [
    ['slot', 0], ['slot', 127], ['columns', 7], ['rows', 81], ['cameraX', 77], ['cameraY', -1], ['offsetX', 8], ['offsetY', -6],
    ['heading', 8], ['altitude', 0], ['altitude', 101], ['spraying', 1], ['sprayFrame', 4], ['active', false],
    ['lastFrameTick', 65534], ['lastFuelTick', 65400], ['lastWearTick', 65536], ['lastSprayTick', -1],
    ['turbulence', 0], ['spin', 65536], ['resumePaused', null], ['inputs', ['bad']], ['inputs', Array(33).fill('left')],
  ]) {
    const bad = structuredClone(data); bad.runtime.aircraftFlight[key as string] = value;
    assert.throws(() => GameSimulation.load(JSON.stringify(bad), crops), /flight/);
  }
  for (const value of [undefined, {}, [], 0]) {
    const bad = structuredClone(data); bad.runtime.aircraftFlight = value;
    assert.throws(() => readNativeSave(JSON.stringify(bad)), /flight/);
  }
  const decision = structuredClone(data); decision.runtime.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  assert.throws(() => readNativeSave(JSON.stringify(decision)), /flight/);
  const badHome = readNativeSave(checkpoint).state; badHome.scenario.regionalConditions[(2 * 12 + 2) * 7] &= ~64;
  assert.throws(() => readNativeSave(writeNativeSave(badHome, 4)), /flight aircraft/);
  assert.equal(game.save(4), checkpoint);
  assert.equal(aircraftPayload(game.getSnapshot().scenario.equipment[1]), 255);
});

test('live spraying treats the field actually flown over and continues its toxicity, pressure and payload cadence after reload', () => {
  const f = ready(), state = readNativeSave(f.game.save(4)).state, field = state.scenario.fields[1];
  field.bytes.fill(0); field.bytes[7] = 1; field.bytes[10] = 8; field.bytes[11] = 16; field.bytes[12] = 8; field.bytes[13] = 8;
  field.bytes[20] = 100; field.bytes[32] = 10; field.bytes[60] = 101;
  const game = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
  launch(game); game.dispatch({ type: 'flight-control', control: 'spray-on' }); game.tick(8.5);
  assert.equal(game.getSnapshot().scenario.fields[1].bytes[20], 100); // Fourth frame is still over the airport.
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (const g of [game, restored]) {
    g.tick(7.5); const field = g.getSnapshot().scenario.fields[1];
    assert.equal(field.bytes[20], 0); assert.equal(field.bytes[32], 12); assert.equal(field.bytes[60], 50);
    assert.equal(aircraftPayload(g.getSnapshot().scenario.equipment[1]), 254);
    assert.equal(g.getSnapshot().daysAdvanced, state.daysAdvanced);
  }
  assert.deepEqual(saved(restored), saved(game));
});

test('engine requests occur once per original flight iteration and audio subscribers cannot change saved flight continuation', () => {
  const f = ready(); launch(f.game); const silent = GameSimulation.load(f.game.save(4), f.crops).simulation;
  const sounds: string[] = []; f.game.subscribeEvents(event => { if (event.type === 'sound') sounds.push(event.sound); });
  f.game.tick(1); assert.deepEqual(sounds, []); f.game.tick(5); silent.tick(6);
  assert.deepEqual(sounds, ['plane', 'plane', 'plane']); assert.deepEqual(saved(f.game), saved(silent));
  f.game.dispatch({ type: 'set-paused', paused: true }); f.game.tick(1000); assert.equal(sounds.length, 3);
});
