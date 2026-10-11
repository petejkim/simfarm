import {createInventoryItem} from '../src/simulation/harvest-storage';
import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { GameSimulation } from './support/game';
import { supplyMovementFixture } from './support/supply-movement';
import { aircraftFixture } from './support/aircraft';
import { checkSupplyPickup } from '../src/simulation/manual-supply-move';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { worldIndex } from '../src/formats/scenario';

test('live supply transfers preserve exact v12 records, quantities, storage, accounts and continuation on every action', () => {
  const f = supplyMovementFixture(), game = f.load(), cash = game.getSnapshot().scenario.farm.cash;
  const events: unknown[] = []; game.subscribeEvents(e => events.push(e));
  for (const [sx, sy, x, y] of [[10, 10, 30, 30], [12, 10, 30, 30], [14, 10, 40, 40], [16, 10, 20, 20], [18, 10, 22, 20]]) {
    const random = readNativeSave(game.save(4)).state.random;
    const before = game.getSnapshot(), selected = checkSupplyPickup(before.scenario, before.finances, sx, sy); assert.ok(selected.ok);
    game.dispatch({ type: 'move-supply', selected, x, y }); const s = game.getSnapshot(); assert.ok(s.lastSupplyMoveResult?.ok);
    assert.equal(s.scenario.farm.cash, cash); assert.deepEqual(s.finances, before.finances); assert.deepEqual(readNativeSave(game.save(4)).state.random, random);
    const saved = game.save(4), loaded = GameSimulation.load(saved, f.crops).simulation;
    assert.equal(loaded.save(4), saved); assert.equal(loaded.getSnapshot().lastSupplyMoveResult, null);
    s.lastSupplyMoveResult.x = 95; assert.equal(game.save(4), saved);
  }
  assert.deepEqual(events, []);
  const w = game.getSnapshot().scenario;
  assert.deepEqual(w.inventory.slice(1, 5).map(i => [i.x, i.y, i.quantity]), [[30, 30, 40], [30, 31, 40], [20, 20, 256], [22, 20, 512]]);
  assert.deepEqual([w.chemicals[1].x, w.chemicals[1].y], [40, 40]);
  // Move a stored harvest into equipment storage (SF-118), then use the existing sale command.
  game.dispatch({ type: 'toggle-building-interior', x: 30, y: 30, slot: 1 });
  const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, 30, 31); assert.ok(selected.ok);
  game.dispatch({ type: 'move-supply', selected, x: 40, y: 40 }); assert.ok(game.getSnapshot().lastSupplyMoveResult?.ok);
  game.dispatch({ type: 'sell-harvest', inventorySlot: 2 }); assert.ok(game.getSnapshot().lastSaleResult?.ok);
  const restored = GameSimulation.load(game.save(4), f.crops).simulation;
  for (let day = 0; day < 35; day++) for (const g of [game, restored]) g.dispatch({ type: 'advance-day' });
  assert.deepEqual(JSON.parse(game.save(4)), JSON.parse(restored.save(4)));
});

test('zero feed removal and stale/invalid commands retain exact boundaries through canonical snapshots and saves', () => {
  const f = supplyMovementFixture(), w = f.state.scenario;
  w.inventory[4].bytes[2] = w.inventory[4].bytes[3] = 0;
  const game = f.load(), first = game.getSnapshot(), selected = checkSupplyPickup(first.scenario, first.finances, 18, 10); assert.ok(selected.ok);
  const saved = game.save(4); game.dispatch({ type: 'move-supply', selected, x: -1, y: 20 });
  assert.equal(game.save(4), saved); assert.deepEqual(game.getSnapshot().lastSupplyMoveResult, { ok: false, reason: 'outside-map' });
  game.dispatch({ type: 'move-supply', selected: { ...selected, type: 299 }, x: 20, y: 20 }); assert.equal(game.save(4), saved);
  game.dispatch({ type: 'move-supply', selected, x: 20, y: 20 }); const after = game.getSnapshot(); assert.ok(after.lastSupplyMoveResult?.ok && after.lastSupplyMoveResult.deleted);
  assert.equal(after.scenario.inventory[4].active, false); assert.equal(after.finances.accounts.otherDefinitions[12].count, 0);
  assert.equal(after.scenario.cells[worldIndex(20, 20)].terrain & 0x7ff, 15);
  const moved = game.save(4); game.dispatch({ type: 'move-supply', selected, x: 30, y: 30 }); assert.equal(game.save(4), moved);
  assert.equal(GameSimulation.load(moved, f.crops).simulation.save(4), moved);
});

test('flight, town and default states block supply movement without feedback or saved state changes', () => {
  const f = aircraftFixture(), base = f.load(); base.dispatch({ type: 'buy-aircraft' });
  base.dispatch({ type: 'buy-livestock', productType: 299, x: 10, y: 10 });
  const s = base.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, 10, 10); assert.ok(selected.ok);
  for (const mode of ['flight', 'town', 'default']) {
    const state = readNativeSave(base.save(4)).state;
    if (mode === 'town') {
      const site = state.finances.town.activeSite; state.pendingTown = { phase: 'annual-reset', site: { ...site }, resumeRunning: false };
      state.scenario.regionalConditions[(site.regionX * 12 + site.regionY) * 7 + 1] = 2; state.scenario.farm.salesAccumulator = 0;
    }
    if (mode === 'default') state.finances.defaultDecision = { status: 'pending', originalExitCode: 0 };
    const g = GameSimulation.load(writeNativeSave(state, 4), f.crops).simulation;
    if (mode === 'flight') g.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 });
    const before = g.save(4); g.dispatch({ type: 'move-supply', selected, x: 20, y: 20 });
    assert.equal(g.save(4), before); assert.equal(g.getSnapshot().lastSupplyMoveResult, null);
  }
});

test('source supply drop failures warn once, preserve saves and keep native-only guards silent',()=>{
  for(const x of [10,12,14,16,18])for(const failure of ['not-owned','blocked-terrain','native-occupied'] as const){
    const f=supplyMovementFixture(),cell=f.state.scenario.cells[worldIndex(60,60)];
    if(failure==='not-owned')cell.overlay&=~0x800;
    else if(failure==='blocked-terrain')cell.terrain=150;
    else cell.terrain=0x800|15;
    const game=f.load(),s=game.getSnapshot(),selected=checkSupplyPickup(s.scenario,s.finances,x,10);assert.ok(selected.ok);
    const before=game.save(4),events:unknown[]=[];game.subscribeEvents(e=>events.push(e));
    game.dispatch({type:'move-supply',selected,x:60,y:60});
    assert.equal(game.save(4),before);assert.equal(game.getSnapshot().lastSupplyMoveResult?.ok,false);
    assert.deepEqual(events,failure==='native-occupied'&&x===16?[]:[{type:'sound',sound:'uhoh'}]);
    const loaded=GameSimulation.load(before,f.crops).simulation;assert.equal(loaded.getSnapshot().lastSupplyMoveResult,null);
  }
  const f=supplyMovementFixture(),game=f.load(),s=game.getSnapshot(),selected=checkSupplyPickup(s.scenario,s.finances,18,10);assert.ok(selected.ok);
  const before=game.save(4),events:unknown[]=[];game.subscribeEvents(e=>events.push(e));
  game.dispatch({type:'move-supply',selected,x:30,y:30});assert.deepEqual(events,[{type:'sound',sound:'uhoh'}]);assert.equal(game.save(4),before);
  events.length=0;game.dispatch({type:'move-supply',selected,x:-1,y:30});assert.deepEqual(events,[]);assert.equal(game.save(4),before);
});


test('full source storage rejects supply delivery with sound and no withdrawal',()=>{
  const f=supplyMovementFixture(),w=f.state.scenario,b=w.buildings[1];
  for(let x=0;x<3;x++)for(let y=0;y<3;y++){
    const item=createInventoryItem(w,192,40,9,b.x+x,b.y+y);assert.ok(item);
    w.seedDefinitions[0].count++;b.setContent(x*3+y,832,192,item.slot);
  }
  const game=f.load(),s=game.getSnapshot(),selected=checkSupplyPickup(s.scenario,s.finances,10,10);assert.ok(selected.ok);
  const before=game.save(4),events:unknown[]=[];game.subscribeEvents(e=>events.push(e));
  game.dispatch({type:'move-supply',selected,x:30,y:30});
  assert.deepEqual(game.getSnapshot().lastSupplyMoveResult,{ok:false,reason:'no-storage-space'});
  assert.equal(game.save(4),before);assert.deepEqual(events,[{type:'sound',sound:'uhoh'}]);
});
