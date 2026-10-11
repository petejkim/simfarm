import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { livestockFixture, shopFixture } from './support/livestock';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import type { GameEvent } from '../src/simulation/events';

function fixture(month = 5, animals = false) {
  const f = animals ? livestockFixture(1) : shopFixture();
  f.state.scenario.farm.dayDelayTicks = 0;
  Object.assign(f.state.scenario.farm.calendar, { day: 6, week: 3, month });
  f.state.scenario.farm.messages = true;
  f.state.finances.town.recreationCount = 1;
  f.state.finances.town.recreationCoordinates.set([72, 72]);
  f.state.disasters.enabled = false;
  return f;
}
const saved = (game: InstanceType<typeof GameSimulation>) => JSON.parse(game.save(4));

test('calendar entries pause at the source boundary and resume exact day/tick once after checkpoint', () => {
  for (const [month, animals, kind] of [[5, false, 'rodeo-entry'], [8, true, 'fair-entry'], [8, false, 'fair-announcement']] as const) {
    for (const running of [false, true]) {
      const f = fixture(month, animals), game = f.load(), events: GameEvent[] = [];
      game.subscribeEvents(e => events.push(e));
      if (running) { game.dispatch({ type: 'set-paused', paused: false }); game.tick(4000); }
      else game.dispatch({ type: 'advance-day' });
      const pending = saved(game), state = game.getSnapshot();
      assert.equal(state.townEvent.pending?.kind, kind);
      assert.equal(state.townEvent.continuation?.phase, 'weekly-rollover');
      assert.equal(state.townEvent.continuation?.resumeRunning, running);
      assert.equal(state.paused, true); assert.equal(state.daysAdvanced, 0);
      assert.equal(state.scenario.farm.timerTicks, 1); assert.equal(state.scenario.farm.animationTicks, 1);
      assert.equal(state.scenario.farm.calendar.month, month + 1);
      assert.deepEqual(events.filter(e => e.type === 'music'), [{ type: 'music', track: month === 5 ? 'rodeo' : 'carnival' }]);
      for (const command of [{ type: 'advance-day' }, { type: 'set-paused', paused: false }, { type: 'borrow', amount: 1000 }] as const) game.dispatch(command);
      game.tick(4000); assert.deepEqual(saved(game), pending);
      const restored = GameSimulation.load(JSON.stringify(pending), f.crops).simulation;
      const replay: GameEvent[] = []; restored.subscribeEvents(e => replay.push(e));
      const cash = state.scenario.farm.cash, expenses = pending.runtime.finances.annual.otherExpenses;
      game.dispatch({ type: 'resolve-town-event', accept: true }); restored.dispatch({ type: 'resolve-town-event', accept: true });
      assert.deepEqual(saved(restored), saved(game));
      const after = game.getSnapshot(), fee = kind === 'fair-announcement' ? 0 : month === 5 ? 500 : 200;
      assert.equal(after.scenario.farm.cash, cash - fee);
      assert.equal(saved(game).runtime.finances.annual.otherExpenses, expenses + fee);
      assert.equal(after.daysAdvanced, 1); assert.equal(after.paused, !running);
      assert.equal(after.scenario.farm.timerTicks, 1); assert.equal(after.townEvent.pending, null);
      assert.equal(after.townEvent.continuation, null);
      assert.equal(after.townEvent.weeksRemaining, month === 5 ? 2 : 3);
      assert.equal(replay.filter(e => e.type === 'music').length, 0);
      const complete = saved(game); game.dispatch({ type: 'resolve-town-event', accept: true }); assert.deepEqual(saved(game), complete);
    }
  }
});

test('live event gates and decline retain source bank, fees and countdown differences', () => {
  for (const gate of ['messages', 'recreation', 'cash', 'date', 'decline'] as const) {
    const f = fixture();
    if (gate === 'messages') f.state.scenario.farm.messages = false;
    if (gate === 'recreation') f.state.finances.town.recreationCount = 0;
    if (gate === 'cash') f.state.scenario.farm.cash = 999;
    if (gate === 'date') f.state.scenario.farm.calendar.month = 4;
    const game = f.load(), events: GameEvent[] = []; game.subscribeEvents(e => events.push(e));
    game.dispatch({ type: 'advance-day' });
    if (gate === 'decline') game.dispatch({ type: 'resolve-town-event', accept: false });
    const state = game.getSnapshot();
    assert.equal(state.daysAdvanced, 1); assert.equal(state.townEvent.pending, null);
    assert.equal(state.townEvent.participation, 0);
    assert.equal(state.townEvent.weeksRemaining, gate === 'decline' ? 2 : 0);
    assert.equal(state.townEvent.artworkMode, gate === 'cash' || gate === 'decline' ? 1 : 0);
    assert.equal(state.scenario.farm.cash, gate === 'cash' ? 999 : 100000);
    assert.equal(events.filter(e => e.type === 'music').length, gate === 'decline' ? 1 : 0);
  }
});

test('weekly results retain drawn outcomes and delay prizes/cleanup until acknowledgement', () => {
  for (const mode of [1, 2] as const) {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 16 && outcomes.size < 2; seed++) {
      const f = fixture(9); f.state.scenario.farm.calendar.week = 0;
      Object.assign(f.state.townEvent, { mode, artworkMode: mode, weeksRemaining: 1, participation: mode === 1 ? 1000 : 1, animalType: 2 });
      f.state.random.simulation = seed;
      const game = f.load(); game.dispatch({ type: 'advance-day' });
      const pending = game.getSnapshot().townEvent.pending;
      assert.ok(pending && (pending.kind === 'fair-result' || pending.kind === 'rodeo-result'));
      outcomes.add(pending.won);
      assert.equal(game.getSnapshot().townEvent.continuation?.phase, 'weekly-water');
      const checkpoint = saved(game), copy = GameSimulation.load(JSON.stringify(checkpoint), f.crops).simulation;
      assert.equal(checkpoint.scenario.farm.cash, 100000);
      assert.equal(checkpoint.runtime.daysAdvanced, 0);
      game.dispatch({ type: 'resolve-town-event', accept: true }); copy.dispatch({ type: 'resolve-town-event', accept: true });
      assert.deepEqual(saved(copy), saved(game));
      const after = saved(game);
      assert.equal(after.scenario.farm.cash, 100000 + (pending.won ? 1000 : 0));
      assert.equal(after.runtime.daysAdvanced, 1); assert.equal(after.scenario.farm.timerTicks, 1);
      assert.equal(after.runtime.townEvent.mode, 0); assert.equal(after.runtime.townEvent.artworkMode, 0);
      assert.equal(after.runtime.townEvent.animalType, mode === 2 ? 255 : 2);
    }
    assert.equal(outcomes.size, 2);
  }
});

test('result-to-entry chaining keeps one tick suspended across both modal boundaries', () => {
  const f = fixture(8);
  Object.assign(f.state.townEvent, { mode: 1, artworkMode: 1, weeksRemaining: 1, participation: 1000 });
  const game = f.load(); game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().townEvent.pending?.kind, 'rodeo-result');
  game.dispatch({ type: 'resolve-town-event', accept: true });
  assert.equal(game.getSnapshot().townEvent.pending?.kind, 'fair-announcement');
  assert.equal(game.getSnapshot().daysAdvanced, 0);
  const copy = GameSimulation.load(game.save(4), f.crops).simulation;
  game.dispatch({ type: 'resolve-town-event', accept: true }); copy.dispatch({ type: 'resolve-town-event', accept: true });
  assert.deepEqual(saved(copy), saved(game));
  assert.equal(game.getSnapshot().daysAdvanced, 1); assert.equal(game.getSnapshot().scenario.farm.timerTicks, 1);
});

test('pending native event checkpoints reject mismatched phase/date and modal ownership; version26 migrates without loss', () => {
  const f = fixture(), game = f.load(), old = saved(game);
  old.version = 26; delete old.runtime.townEvent.continuation;
  assert.deepEqual(readNativeSave(JSON.stringify(old)).state.townEvent, f.state.townEvent);
  game.dispatch({ type: 'advance-day' });
  const good = saved(game);
  for (const change of [
    (o: any) => { delete o.runtime.townEvent.continuation; },
    (o: any) => { o.runtime.townEvent.continuation.phase = 'weekly-water'; },
    (o: any) => { o.runtime.townEvent.continuation.before.day = 5; },
    (o: any) => { o.runtime.townEvent.continuation.before.month = 4; },
    (o: any) => { o.runtime.paused = false; },
    (o: any) => { o.runtime.dayTicks = 1; },
    (o: any) => { o.runtime.elapsed = 0.5; },
    (o: any) => { o.runtime.townEvent.pending = null; },
  ]) {
    const bad = structuredClone(good); change(bad); assert.throws(() => readNativeSave(JSON.stringify(bad)));
  }
  const state = readNativeSave(JSON.stringify(good)).state; state.paused = false;
  assert.throws(() => writeNativeSave(state, 4));
});

test('ordinary accepted entries count down two/three weeks to a single result', () => {
  for (const [month, weeks] of [[5, 2], [8, 3]] as const) {
    const f = fixture(month, month === 8), game = f.load();
    game.dispatch({ type: 'advance-day' }); game.dispatch({ type: 'resolve-town-event', accept: true });
    for (let day = 1; day < weeks * 7; day++) {
      game.dispatch({ type: 'advance-day' });
      assert.equal(game.getSnapshot().townEvent.pending, null);
    }
    game.dispatch({ type: 'advance-day' });
    assert.equal(game.getSnapshot().townEvent.pending?.kind, month === 5 ? 'rodeo-result' : 'fair-result');
    assert.equal(game.getSnapshot().daysAdvanced, weeks * 7);
    game.dispatch({ type: 'resolve-town-event', accept: true });
    assert.equal(game.getSnapshot().daysAdvanced, weeks * 7 + 1);
    assert.equal(game.getSnapshot().townEvent.weeksRemaining, 0);
  }
});

test('an imported year-end result transfers its tick tail to the annual town choice', () => {
  const f = fixture(11);
  Object.assign(f.state.townEvent, { mode: 1, artworkMode: 1, weeksRemaining: 1, participation: 1000 });
  f.state.finances.town.townRevenue = 50000;
  const game = f.load(); game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().townEvent.pending?.kind, 'rodeo-result');
  game.dispatch({ type: 'resolve-town-event', accept: true });
  assert.equal(game.getSnapshot().pendingTown?.resumeTickTail, true);
  const copy = GameSimulation.load(game.save(4), f.crops).simulation;
  game.dispatch({ type: 'choose-town', choice: 'residential' }); copy.dispatch({ type: 'choose-town', choice: 'residential' });
  assert.deepEqual(saved(copy), saved(game));
  assert.equal(game.getSnapshot().pendingTown, null); assert.equal(game.getSnapshot().daysAdvanced, 1);
  assert.equal(game.getSnapshot().scenario.farm.timerTicks, 1);
});
