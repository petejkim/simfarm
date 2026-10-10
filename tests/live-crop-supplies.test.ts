import { TREATMENTS } from '../src/simulation/field-treatment';
import { readScenario } from '../src/formats/scenario';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { GameSimulation } from './support/game';
import { shopFixture } from './support/livestock';
import { disasterFixture } from './support/disasters';
import { aircraftFixture } from './support/aircraft';
import { CROP_SUPPLY_TYPES } from '../src/simulation/crop-supply-purchase';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import type { GameEvent } from '../src/simulation/events';

const parsed = (g: ReturnType<typeof GameSimulation.load>['simulation']) => JSON.parse(g.save(4));

test('live supply purchases retain every product and original accounting through v14, detached snapshots and35-day continuation', () => {
  const f = shopFixture(), g = f.load(), events: GameEvent[] = []; g.subscribeEvents(e => events.push(e));
  for (let n = 0; n < 3; n++) g.dispatch({ type: 'build', buildingType: 69, x: 10 + n * 10, y: 10 });
  const before = parsed(g), cash = g.getSnapshot().scenario.farm.cash;
  let total = 0;
  for (const [i, productType] of CROP_SUPPLY_TYPES.entries()) {
    const w = g.getSnapshot().scenario, d = productType >= 220 ? w.chemicalDefinitions[productType - 220] : w.seedDefinitions[productType - 192];
    total += d.price;
    g.dispatch({ type: 'buy-crop-supply', productType, x: 10 + Math.floor(i / 10) * 10, y: 10 });
    assert.ok(g.getSnapshot().lastCropSupplyPurchaseResult?.ok);
    assert.deepEqual(parsed(GameSimulation.load(g.save(4), f.crops).simulation), parsed(g));
  }
  assert.equal(g.getSnapshot().scenario.farm.cash, cash - total); assert.deepEqual(parsed(g).runtime.random, before.runtime.random);
  assert.deepEqual(events, CROP_SUPPLY_TYPES.flatMap(() => [{ type: 'sound', sound: 'plopitem' }, { type: 'sound', sound: 'ploptool' }]));
  const save = g.save(4), snapshot = g.getSnapshot(); snapshot.scenario.inventory[1].bytes.fill(0);
  if (snapshot.lastCropSupplyPurchaseResult?.ok) snapshot.lastCropSupplyPurchaseResult.price = 999;
  assert.equal(g.save(4), save);
  const copy = GameSimulation.load(save, f.crops).simulation; assert.equal(copy.getSnapshot().lastCropSupplyPurchaseResult, null);
  for (let d = 0; d < 35; d++) { g.dispatch({ type: 'advance-day' }); copy.dispatch({ type: 'advance-day' }); }
  assert.deepEqual(parsed(g), parsed(copy)); assert.equal(parsed(copy).version, 22);
});

test('purchased seeds and all four chemicals feed live planting and treatment orders without paying automatic purchase surcharges', () => {
  const f = disasterFixture(); f.state.scenario.farm.autoBuySeeds = false;
  const g = f.load(); g.dispatch({ type: 'build', buildingType: 67, x: 10, y: 10 });
  for (const productType of [196,220,221,222,223]) { g.dispatch({ type: 'buy-crop-supply', productType, x: 10, y: 10 }); assert.ok(g.getSnapshot().lastCropSupplyPurchaseResult?.ok); }
  const copy = GameSimulation.load(g.save(4), f.crops).simulation;
  for (const game of [g,copy]) {
    const before = game.getSnapshot().scenario.farm;
    game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 4 }); assert.ok(game.getSnapshot().lastPlantResult?.ok);
    assert.equal(game.getSnapshot().scenario.inventory.filter(i => i.active && i.type === 196).length,0);
    for (let d=0;d<10 && game.getSnapshot().scenario.fields[1].state!==4;d++) game.dispatch({ type:'advance-day' });
    assert.equal(game.getSnapshot().scenario.fields[1].state,4);
    for (const [i,treatment] of TREATMENTS.entries()) {
      game.dispatch({ type:'treat-field',fieldSlot:1,treatment });
      assert.ok(game.getSnapshot().lastTreatmentResult?.ok, treatment);
      assert.equal(game.getSnapshot().scenario.chemicals.filter(c=>c.active && c.type===220+i).length,0);
      for(let d=0;d<10 && game.getSnapshot().scenario.fields[1].state!==4;d++)game.dispatch({type:'advance-day'});
      assert.equal(game.getSnapshot().scenario.fields[1].state,4);
    }
    assert.equal(game.getSnapshot().scenario.farm.seedExpenses,before.seedExpenses);
    assert.equal(game.getSnapshot().scenario.farm.chemicalExpenses,before.chemicalExpenses);
  }
  assert.deepEqual(parsed(g),parsed(copy));
});

test('supply commands reject atomically and remain silent during pending defaults, town choice and modal flight', () => {
  const f = shopFixture(), g = f.load(), events: GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
  const saved = g.save(4);g.dispatch({type:'buy-crop-supply',productType:192,x:10,y:10});assert.equal(g.save(4),saved);
  assert.deepEqual(g.getSnapshot().lastCropSupplyPurchaseResult,{productType:192,ok:false,reason:'storage-required'});
  assert.deepEqual(events,[{type:'sound',sound:'uhoh'}]);
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};
  const blocked=f.load(), before=blocked.save(4);blocked.dispatch({type:'buy-crop-supply',productType:220,x:10,y:10});
  assert.equal(blocked.save(4),before);assert.equal(blocked.getSnapshot().lastCropSupplyPurchaseResult,null);
  const air=aircraftFixture(), flight=air.load();flight.dispatch({type:'buy-aircraft'});flight.dispatch({type:'service-aircraft',slot:1,action:{kind:'fuel'}});
  flight.dispatch({type:'start-flight',slot:1,columns:20,rows:16});flight.dispatch({type:'set-paused',paused:true});
  const inFlight=flight.save(4);flight.dispatch({type:'buy-crop-supply',productType:220,x:10,y:10});assert.equal(flight.save(4),inFlight);
  // Use a real annual town prompt so the checkpoint's modal invariants remain valid.
  const state=readNativeSave(new GameSimulation(readScenario(f.state.scenario.sourceBytes!),f.crops).save(4)).state;state.scenario.schedule.bytes.fill(0);state.finances.town.townRevenue=50000;state.scenario.farm.calendar={day:6,week:3,month:11,year:1993,season:3};
  state.dayTicks=state.scenario.farm.dayDelayTicks;
  const annual=GameSimulation.load(writeNativeSave(state,4),f.crops).simulation;annual.dispatch({type:'advance-day'});
  assert.ok(annual.getSnapshot().pendingTown);const prior=annual.save(4);const blockedEvents:GameEvent[]=[];
  annual.subscribeEvents(e=>blockedEvents.push(e));annual.dispatch({type:'buy-crop-supply',productType:192,x:10,y:10});assert.equal(annual.save(4),prior);assert.deepEqual(blockedEvents,[]);
});
