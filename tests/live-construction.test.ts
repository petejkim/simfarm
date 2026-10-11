import { declineTownEvents } from './support/town-events';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { GameSimulation } from './support/game';
import { readNativeSave } from '../src/formats/native-save';

const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
function farm(id = 4) {
  const scenario = readScenario(source(`SCEN${id}.SSM`));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  for (let x = 0; x < 4; x++) for (let y = 12; y < 16; y++) scenario.cells[worldIndex(x, y)] = { terrain: 15, overlay: 0x800, attribute: 0 };
  scenario.farm.cash = 100000;
  return { scenario, crops };
}

test('live construction updates canonical accounts, detached snapshots and native checkpoints on every farm', () => {
  for (let id = 0; id < 8; id++) {
    const { scenario, crops } = farm(id), game = new GameSimulation(scenario, crops);
    const before = game.getSnapshot();
    game.dispatch({ type: 'build', buildingType: 65, x: 0, y: 12 });
    const after = game.getSnapshot(), result = after.lastBuildingResult; assert.ok(result?.ok);
    assert.equal(after.scenario.farm.cash, before.scenario.farm.cash - 2400);
    assert.equal(after.finances.accounts.buildingBookValue, before.finances.accounts.buildingBookValue + 2400);
    assert.equal(after.finances.annual.ds3e90, before.finances.annual.ds3e90 + 2400);
    assert.equal(after.farmReport.expenses, before.farmReport.expenses + 2400);
    const text = game.save(id), restored = GameSimulation.load(text, crops).simulation;
    assert.deepEqual(JSON.parse(restored.save(id)), JSON.parse(text));
    assert.equal(restored.getSnapshot().lastBuildingResult, null);
    after.scenario.buildings[result.slot].bytes.fill(0); after.finances.annual.ds3e90 = 123;
    assert.equal(game.save(id), text);
    game.dispatch({ type: 'build', buildingType: 65, x: 0, y: 12 });
    assert.deepEqual(game.getSnapshot().lastBuildingResult, { ok: false, reason: 'occupied' });
    assert.equal(game.save(id), text);
    for (const sim of [game, restored]) sim.dispatch({ type: 'advance-day' });
    assert.deepEqual(JSON.parse(game.save(id)), JSON.parse(restored.save(id)));
  }
});

test('a newly planted crop completes harvest into purchased storage and sells after reload', () => {
  const { scenario, crops } = farm(), game = new GameSimulation(scenario, crops);
  game.dispatch({ type: 'build', buildingType: 64, x: 0, y: 15 });
  const built = game.getSnapshot().lastBuildingResult; assert.ok(built?.ok);
  game.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 });
  game.dispatch({ type: 'set-auto-clear', enabled: true });
  game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  const field = game.getSnapshot().lastNewFieldResult; assert.ok(field?.ok);
  game.dispatch({ type: 'advance-day' });
  game.dispatch({ type: 'treat-field', fieldSlot: field.slot, treatment: 'fertilizer' });
  assert.ok(game.getSnapshot().lastTreatmentResult?.ok);
  for (let day = 0; game.getSnapshot().daysAdvanced < 84 && day < 84; day++) {
    game.dispatch({ type: 'advance-day' });
    declineTownEvents(game);
  }
  assert.equal(game.getSnapshot().daysAdvanced, 84);
  game.dispatch({ type: 'harvest-field', fieldSlot: field.slot }); assert.ok(game.getSnapshot().lastHarvestResult?.ok);
  const restored = GameSimulation.load(game.save(4), crops).simulation;
  for (const sim of [game, restored]) sim.dispatch({ type: 'advance-day' });
  assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(game.save(4)));
  const s = restored.getSnapshot(), content = s.scenario.buildings[built.slot].content(0);
  assert.equal(content.type, 168); assert.ok(content.slot > 0);
  const item = s.scenario.inventory[content.slot]; assert.equal(item.active, true); assert.deepEqual([item.x, item.y], [0, 15]);
  assert.ok(s.storedHarvestValues[item.slot]! > 0);
  const loaded = GameSimulation.load(restored.save(4), crops).simulation;
  loaded.dispatch({ type: 'sell-harvest', inventorySlot: item.slot });
  const final = loaded.getSnapshot(); assert.ok(final.lastSaleResult?.ok);
  assert.ok(final.scenario.farm.cash > s.scenario.farm.cash);
  assert.deepEqual(final.scenario.buildings[built.slot].content(0), { graphic: 217, type: -1, slot: 0 });
}, 15000);

test('pending annual and terminal default decisions block construction without any mutation', () => {
  const { scenario, crops } = farm(), base = new GameSimulation(scenario, crops);
  for (const kind of ['town', 'default']) {
    const { state } = readNativeSave(base.save(4));
    if (kind === 'town') state.pendingTown = { phase: 'annual-reset', site: { ...state.finances.town.activeSite }, resumeRunning: false };
    else state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
    const game = new GameSimulation(state.scenario, crops, state.random, state), before = game.save(4);
    game.dispatch({ type: 'build', buildingType: 64, x: 0, y: 15 });
    assert.equal(game.save(4), before); assert.equal(game.getSnapshot().lastBuildingResult, null);
  }
});
