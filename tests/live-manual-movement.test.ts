import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { shopFixture } from './support/livestock';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { checkEquipmentPickup } from '../src/simulation/manual-equipment-move';

test('live opening and equipment orders preserve full in-transit and in-storage v12 continuation without replaying feedback', () => {
  const f = shopFixture(), game = f.load();
  game.dispatch({ type: 'build', buildingType: 67, x: 20, y: 20 });
  game.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 4, x: 20, y: 20 });
  game.dispatch({ type: 'toggle-building-interior', x: 21, y: 21, slot: 1 });
  const opened = game.save(4), reopened = GameSimulation.load(opened, f.crops).simulation;
  assert.equal(reopened.save(4), opened); assert.equal(reopened.getSnapshot().lastBuildingInteriorResult, null);
  const selected = checkEquipmentPickup(game.getSnapshot().scenario, 20, 21); assert.ok(selected.ok);
  const cash = game.getSnapshot().scenario.farm.cash, events: unknown[] = []; game.subscribeEvents(e => events.push(e));
  game.dispatch({ type: 'move-equipment', selected, x: 40, y: 40 });
  assert.ok(game.getSnapshot().lastEquipmentMoveResult?.ok); assert.deepEqual(events, []);
  const s = game.getSnapshot(); assert.equal(s.scenario.equipment[1].timestamp, s.scenario.farm.timerTicks);
  assert.equal(s.scenario.buildings[1].content(0).slot, 0); assert.equal(s.scenario.farm.cash, cash);
  game.dispatch({ type: 'set-paused', paused: false }); game.tick(1000); game.dispatch({ type: 'set-paused', paused: true });
  assert.equal(game.getSnapshot().scenario.equipment[1].flags & 2, 2);
  const saved = game.save(4), copy = GameSimulation.load(saved, f.crops).simulation;
  assert.equal(copy.save(4), saved); assert.equal(copy.getSnapshot().lastEquipmentMoveResult, null);
  const feedback = game.getSnapshot().lastEquipmentMoveResult; assert.ok(feedback?.ok); feedback.slot = 99;
  assert.equal(game.save(4), saved);
  for (let day = 0; day < 35; day++) for (const g of [game, copy]) g.dispatch({ type: 'advance-day' });
  assert.deepEqual(JSON.parse(copy.save(4)), JSON.parse(game.save(4)));
  assert.notEqual(game.getSnapshot().lastEquipmentMoveResult, feedback);
  assert.equal(game.getSnapshot().scenario.equipment[1].flags & 4, 4);
  assert.equal(game.getSnapshot().scenario.buildings[2].content(0).slot, 1);
});

test('live trailer towing checkpoints resume exactly and rejects repeat orders without mutating canonical state', () => {
  const f = shopFixture(), game = f.load();
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 1, x: 11, y: 10 });
  const selected = checkEquipmentPickup(game.getSnapshot().scenario, 11, 10); assert.ok(selected.ok);
  game.dispatch({ type: 'move-equipment', selected, x: 60, y: 60 });
  const ordered = game.save(4); game.dispatch({ type: 'move-equipment', selected, x: 30, y: 30 });
  assert.equal(game.save(4), ordered); assert.deepEqual(game.getSnapshot().lastEquipmentMoveResult, { ok: false, reason: 'equipment-busy' });
  assert.deepEqual(game.getSnapshot().editStatuses,[61]);
  game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.equipment[1].attachment, 2);
  const saved = game.save(4), copy = GameSimulation.load(saved, f.crops).simulation; assert.equal(copy.save(4), saved);
  for (let day = 0; day < 20; day++) for (const g of [game, copy]) g.dispatch({ type: 'advance-day' });
  const w = game.getSnapshot().scenario;
  assert.deepEqual([w.equipment[2].x, w.equipment[2].y, w.equipment[2].parent], [60, 60, 0]);
  assert.deepEqual([w.equipment[1].x, w.equipment[1].y, w.equipment[1].attachment], [10, 10, 0]);
  assert.deepEqual(JSON.parse(copy.save(4)), JSON.parse(game.save(4)));
});

test('flight, town and default states block manual movement and interior commands without checkpoint or feedback changes', () => {
  const f = aircraftFixture(), base = f.load(); base.dispatch({ type: 'buy-aircraft' });
  base.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  base.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  const selected = checkEquipmentPickup(base.getSnapshot().scenario, 10, 10); assert.ok(selected.ok);
  for (const mode of ['flight', 'town', 'default']) {
    const state = readNativeSave(base.save(4)).state;
    if (mode === 'town') {
      const site = state.finances.town.activeSite;
      state.pendingTown = { phase: 'annual-reset', site: { ...site }, resumeRunning: false };
      state.scenario.regionalConditions[(site.regionX * 12 + site.regionY) * 7 + 1] = 2; state.scenario.farm.salesAccumulator = 0;
    }
    if (mode === 'default') state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
    const g = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
    if (mode === 'flight') g.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 });
    const before = g.save(4);
    g.dispatch({ type: 'move-equipment', selected, x: 30, y: 30 });
    g.dispatch({ type: 'toggle-building-interior', x: 40, y: 40, slot: 1 });
    assert.equal(g.save(4), before); assert.equal(g.getSnapshot().lastEquipmentMoveResult, null);
    assert.equal(g.getSnapshot().lastBuildingInteriorResult, null);
  }
});
