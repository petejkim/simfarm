import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { livestockFixture } from './support/livestock';
import { GameSimulation } from './support/game';
import type { GameEvent } from '../src/simulation/events';

test('live pointer input follows source distance/direction, stays external to checkpoints and clears without advancing time', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  assert.equal(exe.subarray(0x12041, 0x12048).toString('hex'), 'c1f80426034750');
  assert.equal(exe.subarray(0x120f5, 0x120fa).toString('hex'), '3d32007d4c');
  const f = livestockFixture(), animal = f.state.scenario.animals[1]; animal.bytes[13] = animal.bytes[14] = 0;
  const game = f.load(), input = { x: 9, y: 10 }, before = game.save(4), revision = game.getSnapshot().revision;
  game.dispatch({ type: 'set-map-pointer', pointer: input }); input.x = 11;
  assert.equal(game.save(4), before); assert.equal(game.getSnapshot().revision, revision);
  for (const p of [{ x: -1, y: 10 }, { x: 96, y: 1 }, { x: 1.5, y: 1 }, { x: 1, y: NaN }])
    assert.throws(() => game.dispatch({ type: 'set-map-pointer', pointer: p }), /pointer/);
  const restored = GameSimulation.load(before, f.crops).simulation;
  restored.dispatch({ type: 'set-map-pointer', pointer: { x: 9, y: 10 } });
  for (const g of [game, restored]) { g.dispatch({ type: 'set-paused', paused: false }); g.tick(16); }
  assert.deepEqual([game.getSnapshot().scenario.animals[1].x, game.getSnapshot().scenario.animals[1].y], [11, 10]);
  assert.equal(game.save(4), restored.save(4));
  game.dispatch({ type: 'set-map-pointer', pointer: null });
  const coldInput = GameSimulation.load(game.save(4), f.crops).simulation;
  for (let i = 0; i < 4; i++) { game.tick(16); coldInput.tick(16); }
  assert.equal(game.save(4), coldInput.save(4));
  // Resource seeking keeps priority over avoidance.
  animal.bytes[14] = 4; const thirsty = f.load();
  thirsty.dispatch({ type: 'set-map-pointer', pointer: { x: 11, y: 10 } });
  thirsty.dispatch({ type: 'set-paused', paused: false }); thirsty.tick(16);
  assert.equal(thirsty.getSnapshot().scenario.animals[1].x, 11);
});

test('live collision and weekly vocal events preserve source filenames/RNG, detached delivery and muted continuation', () => {
  for (const type of [160, 161, 162, 163]) {
    const f = livestockFixture(), a = f.state.scenario.animals[1]; a.bytes[6] = type; a.flags |= 8;
    a.bytes[13] = a.bytes[14] = a.bytes[30] = a.bytes[31] = 0;
    for (const d of f.state.finances.accounts.assets.animalDefinitions) d.count = Number(d.type === type);
    f.state.scenario.farm.animationTicks = f.state.scenario.farm.timerTicks = f.state.animalFrame.lastMoveTick = 640;
    f.state.animalFrame.lastCentreTick = 640;
    const game = f.load(), muted = f.load(), seen: GameEvent[] = [], second: GameEvent[] = [];
    const unsubscribe = game.subscribeEvents(event => { seen.push({ ...event }); if (event.type === 'sound') event.sound = 'boos'; });
    game.subscribeEvents(event => second.push(event));
    for (const g of [game, muted]) { g.dispatch({ type: 'set-paused', paused: false }); g.tick(16); }
    const sound = ['horse1', 'cow1', 'pig', 'sheep1'][type - 160];
    assert.deepEqual(seen, [{ type: 'sound', sound }]); assert.deepEqual(second, seen);
    assert.equal(game.save(4), muted.save(4)); unsubscribe(); game.tick(16); muted.tick(16);
    assert.equal(game.save(4), muted.save(4)); assert.equal(second.length, 1);
  }
  const f = livestockFixture(16); f.state.scenario.farm.calendar.day = 6;
  f.state.random.simulation = 300; // Calendar draws150; weekly draw75 triggers0xc16b.
  const game = f.load(), seen: GameEvent[] = []; game.subscribeEvents(e => seen.push(e));
  game.dispatch({ type: 'advance-day' }); assert.deepEqual(seen, [{ type: 'sound', sound: 'cow1' }]);
  const restored = GameSimulation.load(game.save(4), f.crops).simulation, replay: GameEvent[] = [];
  restored.subscribeEvents(e => replay.push(e)); restored.dispatch({ type: 'set-paused', paused: true }); assert.deepEqual(replay, []);
});

test('live need-related deaths increment shared report bytes without producing an invented death sound', () => {
  const f = livestockFixture(16); f.state.scenario.animals[1].bytes[14] = 255;
  f.state.scenario.inventory[1].bytes[10] = 0; f.state.finances.statistics.fieldPresence[6] = 254;
  const game = f.load(), events: GameEvent[] = []; game.subscribeEvents(e => events.push(e));
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.animals[1].active, false);
  assert.equal(game.getSnapshot().finances.statistics.fieldPresence[6], 255); assert.deepEqual(events, []);
  assert.equal(GameSimulation.load(game.save(4), f.crops).simulation.save(4), game.save(4));
});
