import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { worldIndex } from '../src/formats/scenario';
import { GameSimulation } from './support/game';
import { shopFixture } from './support/livestock';

// Full checkpoint round trips validate purchased bytes and finance postings through the real game.
test('live machinery purchases go to ground/storage, age and preserve detached snapshots and exact v10 continuation', () => {
  const f = shopFixture(), game = f.load();
  game.dispatch({ type: 'build', buildingType: 67, x: 20, y: 20 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  for (let equipmentType = 0; equipmentType < 8; equipmentType++) {
    game.dispatch({ type: 'buy-equipment', equipmentType, x: equipmentType < 4 ? 10 + equipmentType * 2 : 20,
      y: equipmentType < 4 ? 10 : 20 });
    assert.ok(game.getSnapshot().lastEquipmentPurchaseResult?.ok);
  }
  const snapshot = game.getSnapshot(), saved = game.save(4);
  assert.equal(snapshot.scenario.equipment.filter(e => e.active).length, 8);
  assert.equal(snapshot.scenario.equipment.filter(e => e.active && (e.flags & 4)).length, 4);
  snapshot.scenario.equipment[1].bytes.fill(0); snapshot.finances.accounts.equipmentExpenses = 999;
  if (snapshot.lastEquipmentPurchaseResult?.ok) snapshot.lastEquipmentPurchaseResult.price = 999;
  assert.equal(game.save(4), saved);
  const restored = GameSimulation.load(saved, f.crops).simulation;
  assert.equal(restored.getSnapshot().lastEquipmentPurchaseResult, null);
  for (let d = 0; d < 35; d++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(game.save(4)));
  assert.deepEqual(game.getSnapshot().scenario.equipment.filter(e => e.active).map(e => e.condition), new Array(8).fill(2));
});

test('live machinery commands charge original tree costs, reject atomically and obey default decisions', () => {
  const f = shopFixture(); f.state.scenario.farm.cash = 424; f.state.scenario.farm.autoClear = true;
  f.state.scenario.cells[worldIndex(10, 10)].terrain = 535;
  const rejected = f.load(), saved = rejected.save(4);
  rejected.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  assert.equal(rejected.save(4), saved);
  assert.deepEqual(rejected.getSnapshot().lastEquipmentPurchaseResult, { equipmentType: 0, ok: false, reason: 'insufficient-cash' });
  f.state.scenario.farm.cash = 425; const success = f.load(), worker = success.getSnapshot().scenario.farm.workerExpenses;
  success.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 }); assert.ok(success.getSnapshot().lastEquipmentPurchaseResult?.ok);
  assert.equal(success.getSnapshot().scenario.farm.cash, 0); assert.equal(success.getSnapshot().scenario.farm.workerExpenses, worker + 25);
  f.state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  const blocked = f.load(), prior = blocked.save(4);
  blocked.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 20, y: 20 });
  assert.equal(blocked.save(4), prior); assert.equal(blocked.getSnapshot().lastEquipmentPurchaseResult, null);
});

test('the native equipment table holds 255 machines, saves them in v29 and pads original 127-record checkpoints', () => {
  const f = shopFixture(); f.state.scenario.farm.cash = 0x7fffffff;
  const game = f.load(); let bought = 0;
  for (let y = 2; y < 90 && bought < 256; y += 2) for (let x = 2; x < 90 && bought < 256; x += 2) {
    game.dispatch({ type: 'buy-equipment', equipmentType: 0, x, y });
    const result = game.getSnapshot().lastEquipmentPurchaseResult;
    if (result?.ok) { bought++; assert.equal(result.slot, bought); }
    else { assert.equal(bought, 255); assert.equal(result?.reason, 'no-equipment-slots'); bought = 256; }
  }
  assert.equal(bought, 256, 'the 256th purchase is rejected');
  const snapshot = game.getSnapshot();
  assert.equal(snapshot.scenario.equipment.length, 256);
  assert.equal(snapshot.scenario.equipment.filter(e => e.active).length, 255);
  const saved = JSON.parse(game.save(4));
  assert.equal(saved.version, 29); assert.equal(saved.scenario.records.equipment.length, 256 * 56 * 2);
  const restored = GameSimulation.load(JSON.stringify(saved), f.crops).simulation;
  assert.equal(restored.save(4), JSON.stringify(saved));
  for (let day = 0; day < 8; day++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  assert.equal(restored.save(4), game.save(4));
  // A pre-v29 checkpoint carries the original 127 records; loading pads the rest with empty slots.
  const legacy = JSON.parse(f.load().save(4)); legacy.version = 28;
  legacy.scenario.records.equipment = legacy.scenario.records.equipment.slice(0, 127 * 56 * 2);
  const padded = GameSimulation.load(JSON.stringify(legacy), f.crops).simulation.getSnapshot().scenario.equipment;
  assert.equal(padded.length, 256); assert.ok(padded.slice(127).every(e => !e.active && e.bytes.every(b => b === 0)));
});

test('machines above slot 127 store in buildings through the one-byte content slot and survive checkpoints', () => {
  const f = shopFixture(); f.state.scenario.farm.cash = 0x7fffffff;
  const game = f.load();
  game.dispatch({ type: 'build', buildingType: 67, x: 60, y: 60 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  let bought = 0;
  for (let y = 2; y < 50 && bought < 199; y += 2) for (let x = 2; x < 90 && bought < 199; x += 2) {
    game.dispatch({ type: 'buy-equipment', equipmentType: 0, x, y }); if (game.getSnapshot().lastEquipmentPurchaseResult?.ok) bought++;
  }
  assert.equal(bought, 199);
  game.dispatch({ type: 'buy-equipment', equipmentType: 4, x: 60, y: 60 });
  const result = game.getSnapshot().lastEquipmentPurchaseResult;
  assert.ok(result?.ok && result.slot === 200 && result.buildingSlot !== null);
  const building = game.getSnapshot().scenario.buildings[result.buildingSlot!];
  assert.ok(Array.from({ length: 12 }, (_, i) => building.content(i).slot).includes(200));
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  assert.equal(restored.save(4), game.save(4));
  for (let day = 0; day < 8; day++) { game.dispatch({ type: 'advance-day' }); restored.dispatch({ type: 'advance-day' }); }
  assert.equal(restored.save(4), game.save(4));
});
