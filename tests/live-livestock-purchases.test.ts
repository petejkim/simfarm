import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { worldIndex } from '../src/formats/scenario';
import { GameSimulation } from './support/game';
import { shopFixture } from './support/livestock';

test('live shop commands purchase a herd and supplies, consume them and persist all records/accounts/random state', () => {
  const f = shopFixture(), game = f.load();
  for (const [productType, x, y] of [[161, 10, 10], [299, 12, 10], [300, 12, 11]]) {
    game.dispatch({ type: 'buy-livestock', productType, x, y }); assert.ok(game.getSnapshot().lastLivestockResult?.ok);
  }
  assert.equal(game.getSnapshot().scenario.farm.cash, 100000 - 480 - 15 - 100);
  assert.equal(game.getSnapshot().scenario.inventory[1].quantity, 256);
  assert.equal(game.getSnapshot().scenario.inventory[2].quantity, 512);
  const initial = game.save(4), snapshot = game.getSnapshot();
  snapshot.scenario.inventory[1].bytes.fill(0); snapshot.finances.accounts.otherDefinitions[11].count = 500;
  if (snapshot.lastLivestockResult?.ok) snapshot.lastLivestockResult.price = 999;
  assert.equal(game.save(4), initial);
  for (let day = 0; day < 4; day++) game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.inventory[1].quantity, 252);
  assert.equal(game.getSnapshot().scenario.inventory[2].quantity, 496);
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  assert.equal(restored.getSnapshot().lastLivestockResult, null);
  for (let day = 0; day < 21; day++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(game.save(4)));
  for (const [productType, x, y] of [[160, 20, 20], [162, 22, 20], [163, 24, 20]]) {
    game.dispatch({ type: 'buy-livestock', productType, x, y }); assert.ok(game.getSnapshot().lastLivestockResult?.ok);
  }
  assert.deepEqual(game.getSnapshot().scenario.animals.filter(a => a.active).map(a => a.type).sort(), [160, 161, 162, 163]);
});

test('shop commands reject atomically, respect financial decisions and keep source tree cost in the live accounts', () => {
  const f = shopFixture(); f.state.scenario.farm.cash = 39;
  f.state.scenario.cells[worldIndex(20, 20)].terrain = 535;
  f.state.scenario.farm.autoClear = true;
  const game = f.load(), before = game.save(4);
  game.dispatch({ type: 'buy-livestock', productType: 299, x: 20, y: 20 });
  assert.deepEqual(game.getSnapshot().lastLivestockResult, { productType: 299, ok: false, reason: 'insufficient-cash' });
  assert.equal(game.save(4), before);
  f.state.scenario.farm.cash = 40; const success = f.load(), worker = success.getSnapshot().scenario.farm.workerExpenses;
  success.dispatch({ type: 'buy-livestock', productType: 299, x: 20, y: 20 });
  assert.equal(success.getSnapshot().scenario.farm.cash, 0);
  assert.equal(success.getSnapshot().scenario.farm.workerExpenses, worker + 25);
  const occupied = success.save(4);
  success.dispatch({ type: 'buy-livestock', productType: 300, x: 20, y: 20 });
  assert.equal(success.save(4), occupied);
  f.state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  const blocked = f.load(), saved = blocked.save(4);
  blocked.dispatch({ type: 'buy-livestock', productType: 299, x: 30, y: 30 });
  assert.equal(blocked.save(4), saved); assert.equal(blocked.getSnapshot().lastLivestockResult, null);
});
