import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { breedingFixture } from './support/animal-lifecycle';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { checkManualAssetSale } from '../src/simulation/manual-asset-sale';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { worldIndex } from '../src/formats/scenario';

const saved = (game: { save(id: number): string }) => JSON.parse(game.save(4));
test('breeding produces a saleable newborn, stored parent sales release their stall, and receipts survive exact native continuation', () => {
  const f = breedingFixture(); f.state.scenario.animals[1].flags |= 3; f.state.scenario.animals[1].bytes[28] = 40;
  const game = f.load(); game.dispatch({ type: 'advance-day' });
  assert.equal(game.getSnapshot().scenario.animals[2].active, true);
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (const g of [game, restored]) {
    for (const slot of [2, 1]) {
      const s = g.getSnapshot(), quote = checkManualAssetSale(s.scenario, s.finances, 'animal', slot, s.weather.soilMoisture); assert.ok(quote.ok);
      const cash = s.scenario.farm.cash, income = s.finances.accounts.assets.livestockIncome;
      g.dispatch({ type: 'sell-asset', kind: 'animal', slot });
      assert.deepEqual(g.getSnapshot().lastAssetSaleResult, { ...quote, kind: 'animal' });
      assert.equal(g.getSnapshot().scenario.farm.cash, cash + quote.value);
      assert.equal(g.getSnapshot().finances.accounts.assets.livestockIncome, income + quote.value);
    }
    const s = g.getSnapshot(); assert.equal(s.scenario.animals.filter(a => a.active).length, 0);
    const barn = s.scenario.buildings.find(b => b.active && b.type === 68)!;
    for (let i = 0; i < 9; i++) assert.equal(barn.content(i).slot, 0);
    assert.equal(s.finances.accounts.assets.animalDefinitions[1].count, 0);
    const before = g.save(4); s.lastAssetSaleResult!.ok = false; assert.equal(g.save(4), before);
    g.dispatch({ type: 'sell-asset', kind: 'animal', slot: 1 }); assert.equal(g.save(4), before);
    for (let d = 0; d < 35; d++) g.dispatch({ type: 'advance-day' });
  }
  assert.deepEqual(saved(game), saved(restored));
  assert.equal(GameSimulation.load(game.save(4), f.crops).simulation.getSnapshot().lastAssetSaleResult, null);
});

test('live equipment sales free ground, storage and airport parking, retain raw bytes and post income/book value without destruction effects', () => {
  const f = aircraftFixture(), game = f.load();
  game.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 4, x: 40, y: 40 });
  game.dispatch({ type: 'buy-aircraft' }); assert.ok(game.getSnapshot().lastAircraftPurchaseResult?.ok);
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (const g of [game, restored]) {
    const events: unknown[] = []; g.subscribeEvents(e => events.push(e));
    const clearing = JSON.stringify(g.getSnapshot().finances.clearing);
    for (const slot of [1, 2, 3]) {
      const s = g.getSnapshot(), e = s.scenario.equipment[slot], raw = Uint8Array.from(e.bytes), price = s.scenario.equipmentDefinitions[e.type].price;
      const book = s.finances.accounts.assets.equipmentBookValue;
      g.dispatch({ type: 'sell-asset', kind: 'equipment', slot }); assert.ok(g.getSnapshot().lastAssetSaleResult?.ok);
      raw[2] &= ~32; assert.deepEqual(g.getSnapshot().scenario.equipment[slot].bytes, raw);
      assert.equal(g.getSnapshot().finances.accounts.assets.equipmentBookValue, (book - price) >>> 0);
    }
    const s = g.getSnapshot(); assert.equal(s.scenario.cells[worldIndex(10, 10)].terrain & 0x800, 0);
    assert.equal(s.scenario.cells[worldIndex(21, 22)].terrain & 0x7ff, 23);
    assert.equal(s.scenario.regionalConditions[(2 * 12 + 2) * 7] & 64, 0);
    const storage = s.scenario.buildings.find(b => b.active && b.type === 67)!;
    for (let i = 0; i < 9; i++) assert.equal(storage.content(i).slot, 0);
    assert.equal(JSON.stringify(s.finances.clearing), clearing); assert.deepEqual(events, []);
    g.dispatch({ type: 'buy-aircraft' }); assert.ok(g.getSnapshot().lastAircraftPurchaseResult?.ok);
  }
  assert.deepEqual(saved(game), saved(restored));
});

test('manual commands reject unavailable, rented and busy assets atomically and remain blocked during flight/default', () => {
  const f = aircraftFixture(), game = f.load(); game.dispatch({ type: 'buy-aircraft' });
  const state = readNativeSave(game.save(4)).state;
  for (const [flags, reason] of [[0x60, 'rented-equipment'], [0x21, 'asset-busy']] as const) {
    state.scenario.equipment[1].flags = flags;
    const g = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation, before = g.save(4);
    g.dispatch({ type: 'sell-asset', kind: 'equipment', slot: 1 }); assert.equal(g.save(4), before);
    assert.deepEqual(g.getSnapshot().lastAssetSaleResult, { ok: false, kind: 'equipment', reason });
  }
  game.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 }); const flying = game.save(4);
  game.dispatch({ type: 'sell-asset', kind: 'equipment', slot: 1 }); assert.equal(game.save(4), flying);
  assert.equal(game.getSnapshot().lastAssetSaleResult, null);
  state.scenario.equipment[1].flags = 32; state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
  const blocked = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation, before = blocked.save(4);
  blocked.dispatch({ type: 'sell-asset', kind: 'equipment', slot: 1 }); assert.equal(blocked.save(4), before);
});
