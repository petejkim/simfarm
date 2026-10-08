import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameSimulation } from './support/game';
import { breedingFixture } from './support/animal-lifecycle';
import { aircraftFixture } from './support/aircraft';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { checkManualRemoval } from '../src/simulation/manual-removal';

test('a newly planted growing field can be removed, cleared, saved mid-animation and replanted through live commands', () => {
  const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
  const w = readScenario(source('SCEN4.SSM')), crops = w.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  w.farm.cash = 100000;
  const game = new GameSimulation(w, crops);
  game.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 });
  game.dispatch({ type: 'set-auto-clear', enabled: true });
  game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  const created = game.getSnapshot().lastNewFieldResult; assert.ok(created?.ok);
  const command = { type: 'remove-object', kind: 'field', slot: created.slot, x: 1, y: 17 } as const;
  const busy = game.save(4); game.dispatch(command); assert.equal(game.save(4), busy);
  assert.deepEqual(game.getSnapshot().lastRemovalResult, { ok: false, reason: 'field-busy' });
  game.dispatch({ type: 'advance-day' }); assert.equal(game.getSnapshot().scenario.fields[created.slot].state, 4);
  const before = game.getSnapshot(), raw = Uint8Array.from(before.scenario.fields[created.slot].bytes);
  const events: unknown[] = []; game.subscribeEvents(e => events.push(e)); game.dispatch(command);
  const after = game.getSnapshot(); assert.ok(after.lastRemovalResult?.ok); raw[7] &= ~1;
  assert.deepEqual(after.scenario.fields[created.slot].bytes, raw);
  assert.deepEqual(after.scenario.schedule.bytes, before.scenario.schedule.bytes);
  assert.equal(after.scenario.farm.cash, before.scenario.farm.cash - 25);
  assert.equal(after.finances.annual.otherExpenses, (before.finances.annual.otherExpenses + 25) >>> 0);
  assert.equal(after.farmReport.expenses, before.farmReport.expenses + 25);
  assert.equal(after.scenario.farm.salesAccumulator, before.scenario.farm.salesAccumulator);
  assert.equal(after.finances.clearing.count, 64);
  assert.equal(after.scenario.cells[worldIndex(0, 16)].terrain & 0x7ff, 664);
  assert.deepEqual(events, [{ type: 'sound', sound: 'explode' }]);
  const saved = game.save(4); after.lastRemovalResult.slot = 97; assert.equal(game.save(4), saved);
  game.dispatch(command); assert.equal(game.save(4), saved); assert.equal(events.length, 1);
  const restored = GameSimulation.load(saved, crops).simulation; assert.equal(restored.getSnapshot().lastRemovalResult, null);
  for (const g of [game, restored]) {
    g.dispatch({ type: 'advance-day' }); assert.equal(g.getSnapshot().finances.clearing.count, 0);
    g.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 }); assert.ok(g.getSnapshot().lastNewFieldResult?.ok);
    g.dispatch({ type: 'advance-day' }); assert.equal(g.getSnapshot().scenario.fields[created.slot].state, 4);
  }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
});

test('live building demolition destroys stored livestock and machinery, removes a pump, and saves exact clearing/account continuation', () => {
  const f = breedingFixture(), game = f.load();
  game.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 40, y: 40 }); assert.ok(game.getSnapshot().lastEquipmentPurchaseResult?.ok);
  game.dispatch({ type: 'build', buildingType: 70, x: 60, y: 60 }); assert.ok(game.getSnapshot().lastBuildingResult?.ok);
  const before = game.getSnapshot(), restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (const g of [game, restored]) {
    for (const [x, y] of [[21, 21], [41, 41], [60, 60]]) {
      const quote = checkManualRemoval(g.getSnapshot().scenario, x, y); assert.ok(quote.ok);
      g.dispatch({ type: 'remove-object', x, y, kind: quote.kind, slot: quote.slot }); assert.deepEqual(g.getSnapshot().lastRemovalResult, quote);
    }
    const s = g.getSnapshot(); assert.equal(s.scenario.animals[1].active, false); assert.equal(s.scenario.equipment[1].active, false);
    assert.equal(s.scenario.irrigation.sourceCount, 0); assert.equal(s.scenario.farm.cash, before.scenario.farm.cash - 75);
    assert.equal(s.scenario.farm.salesAccumulator, before.scenario.farm.salesAccumulator);
    assert.equal(s.finances.accounts.assets.equipmentIncome, before.finances.accounts.assets.equipmentIncome);
    assert.equal(s.finances.accounts.assets.livestockIncome, before.finances.accounts.assets.livestockIncome);
    assert.equal(s.finances.accounts.buildingBookValue, 0);
    for (let d = 0; d < 35; d++) g.dispatch({ type: 'advance-day' });
    assert.equal(g.getSnapshot().finances.clearing.count, 0);
  }
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
});

test('flight, town and default modal states block removal without feedback, audio, or checkpoint changes', () => {
  const f = aircraftFixture(), base = f.load(); base.dispatch({ type: 'buy-aircraft' });
  base.dispatch({ type: 'build', buildingType: 64, x: 40, y: 40 }); const b = base.getSnapshot().lastBuildingResult; assert.ok(b?.ok);
  for (const mode of ['flight', 'town', 'default']) {
    const state = readNativeSave(base.save(4)).state;
    if (mode === 'town') {
      const site = state.finances.town.activeSite;
      state.pendingTown = { phase: 'annual-reset', site: { ...site }, resumeRunning: false };
      state.scenario.regionalConditions[(site.regionX * 12 + site.regionY) * 7 + 1] = 2;
      state.scenario.farm.salesAccumulator = 0;
    }
    if (mode === 'default') state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
    const g = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
    if (mode === 'flight') { g.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 }); assert.ok(g.getSnapshot().aircraftFlight); }
    const before = g.save(4), events: unknown[] = []; g.subscribeEvents(e => events.push(e));
    g.dispatch({ type: 'remove-object', kind: 'building', slot: b.slot, x: 40, y: 40 });
    assert.equal(g.save(4), before); assert.equal(g.getSnapshot().lastRemovalResult, null); assert.deepEqual(events, []);
  }
});
