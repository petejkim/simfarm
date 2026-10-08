import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { Binary } from '../src/formats/binary';
import { worldIndex } from '../src/formats/scenario';
import { GameSimulation } from './support/game';
import { weeklyAgingFixture } from './support/weekly-aging';
import type { GameEvent } from '../src/simulation/events';

test('weekly equipment sale and chemical aging compose with live clearing, original ledgers, audio and exact saved continuation', () => {
  const f = weeklyAgingFixture(), game = f.load(), before = game.getSnapshot(), events: GameEvent[] = [];
  game.subscribeEvents(e => events.push(e)); game.dispatch({ type: 'advance-day' }); const s = game.getSnapshot();
  const value = s.scenario.equipmentDefinitions[0].price >>> 3;
  assert.equal(s.scenario.equipment[1].active, false); assert.equal(s.scenario.farm.cash, before.scenario.farm.cash + value);
  assert.equal(s.finances.accounts.assets.equipmentIncome, before.finances.accounts.assets.equipmentIncome + value);
  assert.equal(s.scenario.cells[worldIndex(10, 10)].terrain & 0x7ff, 664);
  assert.equal(s.scenario.chemicals[1].bytes[9], 0); assert.equal(new Binary(s.scenario.chemicals[1].bytes).u16(10), 0);
  assert.deepEqual(events, [{ type: 'sound', sound: 'explode' }]);
  assert.deepEqual(s.equipmentAgingNotices, [{ kind: 'sold', slot: 1, equipmentType: 0, x: 10, y: 10, value, outdoor: true }]);
  const saved = game.save(4), restored = GameSimulation.load(saved, f.crops).simulation;
  assert.deepEqual(restored.getSnapshot().equipmentAgingNotices, []);
  s.equipmentAgingNotices[0].x = 95; assert.equal(game.save(4), saved);
  for (let d = 0; d < 14; d++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  assert.equal(game.save(4), restored.save(4)); assert.equal(events.length, 1);
  assert.equal(game.getSnapshot().finances.clearing.count, 0);
});

test('paused and financial-choice farms do not age; a busy worn machine remains eligible for later source retries', () => {
  const f = weeklyAgingFixture(); f.equipment.flags |= 1;
  const game = f.load(), before = game.save(4); game.tick(10000); assert.equal(game.save(4), before);
  game.dispatch({ type: 'advance-day' }); const s = game.getSnapshot();
  assert.equal(s.scenario.equipment[1].active, true); assert.equal(s.scenario.equipment[1].condition, 255);
  assert.equal(s.equipmentAgingNotices[0].kind, 'deferred'); assert.equal(s.scenario.farm.cash, f.state.scenario.farm.cash);
  f.state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  const blocked = f.load(), frozen = blocked.save(4); blocked.dispatch({ type: 'advance-day' }); blocked.tick(1000);
  assert.equal(blocked.save(4), frozen);
});
