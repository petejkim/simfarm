import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation, originalTownLayouts } from './support/game';
import { readNativeSave } from '../src/formats/native-save';
import { aircraftChemical, aircraftFuel, aircraftPayload } from '../src/simulation/aircraft';
import { constructTownDistrict } from '../src/simulation/town-construction';

test('live aircraft purchase and service change canonical records/accounts and v12 preserves shared selection and future wear', () => {
  const f = aircraftFixture();
  constructTownDistrict(f.state.scenario, f.state.finances.town, originalTownLayouts, { regionX: 3, regionY: 2 }, 5);
  const game = f.load(); game.dispatch({ type: 'buy-aircraft' }); assert.ok(game.getSnapshot().lastAircraftPurchaseResult?.ok);
  game.dispatch({ type: 'buy-aircraft' }); assert.ok(game.getSnapshot().lastAircraftPurchaseResult?.ok);
  game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'fuel' } });
  game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'load' } });
  game.dispatch({ type: 'service-aircraft', slot: 2, action: { kind: 'chemical', chemicalType: 223 } });
  const snapshot = game.getSnapshot(), saved = game.save(4);
  assert.equal(snapshot.aircraftService.selectedChemical, 223);
  assert.deepEqual([aircraftFuel(snapshot.scenario.equipment[1]), aircraftPayload(snapshot.scenario.equipment[1]), aircraftChemical(snapshot.scenario.equipment[1])], [255, 255, 221]);
  snapshot.aircraftService.selectedChemical = 222; snapshot.scenario.equipment[1].bytes.fill(0);
  assert.equal(game.save(4), saved);
  assert.equal(JSON.parse(saved).version, 27);
  const restored = GameSimulation.load(saved, f.crops).simulation;
  assert.equal(restored.getSnapshot().lastAircraftPurchaseResult, null); assert.equal(restored.getSnapshot().lastAircraftServiceResult, null);
  assert.equal(restored.getSnapshot().aircraftService.selectedChemical, 223);
  for (const g of [game, restored]) {
    g.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'chemical', chemicalType: 222 } });
    g.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'load' } });
    for (let d = 0; d < 35; d++) g.dispatch({ type: 'advance-day' });
    assert.equal(g.getSnapshot().scenario.equipment[1].condition, 2);
    g.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'repair' } });
    assert.ok(g.getSnapshot().lastAircraftServiceResult?.ok); assert.equal(g.getSnapshot().scenario.equipment[1].condition, 0);
  }
  assert.deepEqual(JSON.parse(restored.save(4)), JSON.parse(game.save(4)));
});

test('current aircraft selection validates, v10 migrates once, failed commands/default do not mutate checkpoints', () => {
  const f = aircraftFixture(), game = f.load(); game.dispatch({ type: 'buy-aircraft' });
  let before = game.save(4); game.dispatch({ type: 'buy-aircraft' });
  assert.deepEqual(game.getSnapshot().lastAircraftPurchaseResult, { ok: false, reason: 'no-parking' }); assert.equal(game.save(4), before);
  game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'chemical', chemicalType: 220 } }); assert.equal(game.save(4), before);
  game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'chemical', chemicalType: 222 } });
  const save = JSON.parse(game.save(4));
  for (const value of [null, {}, { selectedChemical: 220 }, { selectedChemical: 224 }, { selectedChemical: 221.5 }])
    assert.throws(() => readNativeSave(JSON.stringify({ ...save, runtime: { ...save.runtime, aircraftService: value } })), /aircraft/);
  save.version = 10; delete save.runtime.aircraftService;
  const old = GameSimulation.load(JSON.stringify(save), f.crops).simulation;
  assert.equal(old.getSnapshot().aircraftService.selectedChemical, 221);
  assert.equal(old.getSnapshot().scenario.equipment[1].active, true);
  old.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'chemical', chemicalType: 223 } });
  assert.equal(GameSimulation.load(old.save(4), f.crops).simulation.getSnapshot().aircraftService.selectedChemical, 223);
  f.state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 }; const blocked = f.load(); before = blocked.save(4);
  blocked.dispatch({ type: 'buy-aircraft' }); blocked.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'fuel' } });
  assert.equal(blocked.save(4), before); assert.equal(blocked.getSnapshot().lastAircraftPurchaseResult, null);
});
