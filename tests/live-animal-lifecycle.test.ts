import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { GameSimulation } from './support/game';
import { breedingFixture, replacementBirthFixture } from './support/animal-lifecycle';

test('a source-stored cow matures at month end, starts pregnancy and gives birth after the full41-week gestation', () => {
  const f = breedingFixture(), game = f.load();
  game.dispatch({ type: 'advance-day' });
  let s = game.getSnapshot(), parent = s.scenario.animals[1];
  assert.equal(parent.ageWeeks, 81); assert.equal(parent.bytes[18], 1); assert.equal(parent.flags & 3, 3);
  assert.equal(parent.bytes[28], 0); assert.deepEqual(s.scenario.farm.calendar, { day: 0, week: 0, month: 1, season: 0, year: 1993 });
  for (let d = 0; d < 40 * 7; d++) game.dispatch({ type: 'advance-day' });
  s = game.getSnapshot(); parent = s.scenario.animals[1];
  assert.equal(parent.bytes[28], 40); assert.equal(s.scenario.animals.filter(a => a.active).length, 1);
  const saved = game.save(4), restored = GameSimulation.load(saved, f.crops).simulation;
  for (let d = 0; d < 7; d++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  s = game.getSnapshot(); assert.equal(s.scenario.animals.filter(a => a.active).length, 2);
  assert.equal(s.scenario.animals[1].bytes[28], 0); assert.equal(s.scenario.animals[2].ageWeeks, 0);
  assert.deepEqual(s.animalLifecycleNotices, [{ kind: 'born', slot: 2, animalType: 161, parentSlot: 1 }]);
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  const next = game.save(4); s.animalLifecycleNotices[0].animalType = 160; s.scenario.animals[2].bytes.fill(0);
  assert.equal(game.save(4), next);
  assert.deepEqual(GameSimulation.load(next, f.crops).simulation.getSnapshot().animalLifecycleNotices, []);
}, 15000);

test('weekly old-age removal frees capacity before births, retains notice identity and freezes under financial decisions', () => {
  const f = replacementBirthFixture(), game = f.load(), before = game.getSnapshot();
  game.tick(1000); assert.equal(game.getSnapshot().scenario.animals[1].type, 160); // Paused.
  game.dispatch({ type: 'advance-day' }); const s = game.getSnapshot();
  assert.deepEqual(s.animalLifecycleNotices, [{ kind: 'old-age', slot: 1, animalType: 160 }, { kind: 'born', slot: 1, animalType: 161, parentSlot: 2 }]);
  assert.equal(s.scenario.animals[1].type, 161); assert.equal(s.scenario.animals[1].ageWeeks, 0);
  assert.equal(s.finances.accounts.assets.animalDefinitions[0].count, 0);
  assert.equal(s.finances.accounts.assets.animalDefinitions[1].count, 2);
  assert.equal(s.scenario.farm.cash, before.scenario.farm.cash);
  assert.equal(s.finances.statistics.ds3e5c, before.finances.statistics.ds3e5c + 480);
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (let d = 0; d < 14; d++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
  f.state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  const blocked = f.load(), frozen = blocked.save(4);
  blocked.dispatch({ type: 'advance-day' }); blocked.tick(5000); assert.equal(blocked.save(4), frozen);
});
