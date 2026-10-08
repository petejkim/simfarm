import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { bulldozeFixture, bulldozeTargets } from './support/bulldoze';
import { GameSimulation } from './support/game';
import { checkManualRemoval } from '../src/simulation/manual-removal';
import { worldIndex } from '../src/formats/scenario';

test('live bulldozing removes purchased supplies/chemicals, repairs networks and shoreline, and resumes all affected bytes/RNG exactly', () => {
  const f = bulldozeFixture(), game = f.load(), copy = GameSimulation.load(game.save(4), f.crops).simulation;
  for (const g of [game, copy]) {
    const before = g.getSnapshot(), events: unknown[] = []; g.subscribeEvents(e => events.push(e));
    for (const [x, y] of bulldozeTargets) {
      const quote = checkManualRemoval(g.getSnapshot().scenario, x, y); assert.ok(quote.ok);
      g.dispatch({ type: 'remove-object', x, y, kind: quote.kind, slot: quote.slot, tile: quote.tile });
      assert.deepEqual(g.getSnapshot().lastRemovalResult, quote);
    }
    const s = g.getSnapshot(), cell = (x: number, y: number) => s.scenario.cells[worldIndex(x, y)];
    assert.equal(s.scenario.farm.cash, before.scenario.farm.cash - bulldozeTargets.length * 25);
    assert.equal(s.finances.annual.otherExpenses, before.finances.annual.otherExpenses + bulldozeTargets.length * 25);
    assert.equal(s.scenario.farm.workerExpenses, before.scenario.farm.workerExpenses);
    assert.equal(s.scenario.farm.salesAccumulator, before.scenario.farm.salesAccumulator);
    assert.ok(s.scenario.inventory.every(i => !i.active)); assert.ok(s.scenario.chemicals.every(c => !c.active));
    assert.equal(s.finances.clearing.count, 3); assert.equal(cell(21, 20).terrain, 178); assert.equal(cell(25, 20).terrain, 151);
    assert.equal(cell(29, 20).terrain, 99); assert.equal(cell(33, 20).terrain, 151); assert.equal(cell(32, 21).terrain, 98);
    assert.equal(cell(32, 20).terrain & 0x2000, 0); assert.equal(cell(40, 40).terrain & 0x3000, 0x3000);
    assert.deepEqual(events, bulldozeTargets.map((_, i) => ({ type: 'sound', sound: i < 3 ? 'explode' : 'bulldoze' })));
    const saved = g.save(4); assert.ok(s.lastRemovalResult?.ok); s.lastRemovalResult.slot = -1; assert.equal(g.save(4), saved);
    for (let d = 0; d < 35; d++) g.dispatch({ type: 'advance-day' }); assert.equal(g.getSnapshot().finances.clearing.count, 0);
  }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(copy.save(4)));
  assert.equal(GameSimulation.load(game.save(4), f.crops).simulation.getSnapshot().lastRemovalResult, null);
});

test('terrain identity and town gates reject without cash, RNG, audio, or save mutation', () => {
  const f = bulldozeFixture(), game = f.load(), events: unknown[] = []; game.subscribeEvents(e => events.push(e));
  const before = game.save(4);
  for (const tile of [undefined, 536]) {
    game.dispatch({ type: 'remove-object', kind: 'terrain', slot: worldIndex(40, 40), x: 40, y: 40, tile });
    assert.deepEqual(game.getSnapshot().lastRemovalResult, { ok: false, reason: 'target-changed' }); assert.equal(game.save(4), before);
  }
  game.dispatch({ type: 'remove-object', kind: 'terrain', slot: worldIndex(50, 50), x: 50, y: 50, tile: 535 });
  assert.deepEqual(game.getSnapshot().lastRemovalResult, { ok: false, reason: 'town-owned' }); assert.equal(game.save(4), before); assert.deepEqual(events, []);
});
