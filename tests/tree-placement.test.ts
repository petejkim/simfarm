import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { checkTreePlacement, placeTree } from '../src/simulation/tree-placement';
import { FarmRandom } from '../src/simulation/random';
import { worldIndex } from '../src/formats/scenario';
import { shopFixture } from './support/livestock';
import { GameSimulation } from './support/game';
import type { GameEvent } from '../src/simulation/events';

test('Trees palette, definition, grass gates, count and visual draw match pinned executable bytes', () => {
  const exe = readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE', import.meta.url));
  assert.equal(createHash('sha256').update(exe).digest('hex'), '8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const exact = (o:number,h:string) => assert.equal(exe.subarray(o,o+h.length/2).toString('hex'),h);
  assert.equal(0x1f950+exe.readUInt16LE(0x22352+16*2),0x21c16);
  exact(0x21c57,'26c747020400c746f22301');
  exact(0x8baea,'3e00230100000a0001010103000000000000');
  assert.equal(exe.readUInt16LE(0x4ec60+0x8da),131);
  exact(0x24ac1,'3bc8724c');exact(0x1ce6d,'3bc172a1');exact(0x1cf17,'26f687254c08');
  exact(0x1cb59,'8946fe995250');exact(0x3a518,'8b46086b5e06120187885fb80100c9cb');
  exact(0x1d081,'9a7d00fd05250f0003c6');exact(0x1d0a0,'2500f80b46f02689872404');
  assert.equal(exe.subarray(0x846f0+0x3ece,0x846f0+0x3ece+13).toString(),'plopitem.voc\0');
  // Hay and Trough take the same one-cell mode4 route and generic purchase.
  for(const [id,branch,mode,typeAt,type] of [[13,0x21920,0x21961,0x21967,300],[14,0x219dc,0x21a1d,0x21a23,299]]) {
    assert.equal(0x1f950+exe.readUInt16LE(0x22352+(id-1)*2),branch);
    exact(mode,'26c747020400');exact(typeAt,'c746f2');assert.equal(exe.readUInt16LE(typeAt+3),type);
  }
  exact(0x24364,'9ae202661a');exact(0x24497,'9ae202661a');exact(0x24af6,'9ae202661a');
});

test('tree preflight accepts only owned unmasked grass, never consumes RNG, and bounds coordinates', () => {
  const f=shopFixture(),w=f.state.scenario,fin=f.state.finances,c=w.cells[worldIndex(10,10)];
  for(let tile=0;tile<2048;tile++) {
    c.terrain=tile;assert.equal(checkTreePlacement(w,fin,10,10,0).ok,tile>=15&&tile<31);
    c.terrain=tile|0x800;assert.equal(checkTreePlacement(w,fin,10,10,0).ok,false);
  }
  c.terrain=15;
  for(const overlay of [0,0x4000,0x4800]) { c.overlay=overlay;assert.equal(checkTreePlacement(w,fin,10,10,0).ok,false); }
  c.overlay=0x800;
  for(const [x,y] of [[-1,0],[96,0],[0,96],[NaN,0],[1.5,0],[0,Infinity]])assert.deepEqual(checkTreePlacement(w,fin,x,y,0),{ok:false,reason:'outside-map'});
  for(const [x,y] of [[0,0],[95,0],[0,95],[95,95]])assert.ok(checkTreePlacement(w,fin,x,y,0).ok);
  // Source does not allocate a record or check animal occupancy for a tree.
  for(const item of w.inventory)item.bytes[10]=32;
  w.animals[1].flags=32;w.animals[1].bytes[0]=10;w.animals[1].bytes[1]=10;
  assert.ok(checkTreePlacement(w,fin,10,10,0).ok);
  assert.throws(()=>checkTreePlacement(w,fin,10,10,128),/state/);
  fin.accounts.otherDefinitions[3].bytes[8]=2;assert.throws(()=>checkTreePlacement(w,fin,10,10,0),/definition/);
});

test('trees retain every visual seed result and flags, increment wrapped counts, and debit cash only', () => {
  const f=shopFixture(),w=f.state.scenario,fin=f.state.finances,c=w.cells[worldIndex(10,10)],d=fin.accounts.otherDefinitions[3];
  const ledger=JSON.stringify(fin.annual),items=JSON.stringify(w.inventory),variants=new Set<number>();
  for(let seed=0;seed<=65535;seed++) {
    const r=new FarmRandom({visual:seed,simulation:2,bounded:99});let expected=seed;
    for(let bit=0;bit<8;bit++)expected=(expected>>>1)|((((expected>>>1)^(expected>>>2))&1)<<15);
    c.terrain=0xb000|15;c.overlay=0xa80f;w.farm.cash=10;d.count=65535;
    assert.ok(placeTree(w,fin,r,10,10,0).ok);
    assert.equal(c.terrain,0xb000|(131+(expected&15)));assert.equal(c.overlay,0xa80f);
    assert.deepEqual(r.snapshot(),{visual:expected,simulation:2,bounded:99});
    assert.equal(w.farm.cash,0);assert.equal(d.count,0);variants.add(c.terrain&0x7ff);
  }
  assert.equal(variants.size,16);assert.equal(JSON.stringify(fin.annual),ledger);assert.equal(JSON.stringify(w.inventory),items);
});

test('tree clearing, signed prices and failed work retain atomic save/RNG semantics', () => {
  for(const tile of [131,146,535,538]) {
    const f=shopFixture(),w=f.state.scenario;w.farm.autoClear=true;w.cells[worldIndex(10,10)].terrain=tile;f.state.weather.soilMoisture=0;
    const cost=tile>=535?25:0,needed=Math.max(25,10+cost);w.farm.cash=needed-1;
    let g=f.load(),before=g.save(4);g.dispatch({type:'plant-tree',x:10,y:10});assert.equal(g.save(4),before);
    w.farm.cash=needed;g=f.load();g.dispatch({type:'plant-tree',x:10,y:10});
    assert.deepEqual(g.getSnapshot().lastTreeResult,{ok:true,price:10,clearingCost:cost});assert.equal(g.getSnapshot().scenario.farm.cash,needed-10-cost);
    assert.equal(g.getSnapshot().scenario.farm.workerExpenses,(w.farm.workerExpenses+cost)>>>0);
    w.cells[worldIndex(10,10)].attribute=255;g=f.load();before=g.save(4);g.dispatch({type:'plant-tree',x:10,y:10});assert.equal(g.save(4),before);
  }
  for(const price of [0,32767,32768,65535]) {
    const f=shopFixture(),d=f.state.finances.accounts.otherDefinitions[3];d.price=price;f.state.scenario.farm.cash=(price<<16>>16)>>>0;
    const g=f.load();g.dispatch({type:'plant-tree',x:10,y:10});assert.ok(g.getSnapshot().lastTreeResult?.ok);assert.equal(g.getSnapshot().scenario.farm.cash,0);
  }
});

test('tree and supply commands emit placement sounds, obey modal blocking and continue exact saves', () => {
  const f=shopFixture(),g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
  g.dispatch({type:'plant-tree',x:10,y:10});g.dispatch({type:'buy-livestock',productType:299,x:11,y:10});g.dispatch({type:'buy-livestock',productType:300,x:12,y:10});
  assert.deepEqual(events,Array.from({length:3},()=>[{type:'sound',sound:'plopitem'},{type:'sound',sound:'ploptool'}]).flat());
  const before=g.save(4);g.dispatch({type:'plant-tree',x:10,y:10});assert.equal(g.save(4),before);assert.deepEqual(events.at(-1),{type:'sound',sound:'uhoh'});
  const copy=GameSimulation.load(g.save(4),f.crops).simulation;assert.equal(copy.getSnapshot().lastTreeResult,null);assert.equal(copy.save(4),g.save(4));
  for(let day=0;day<35;day++){g.dispatch({type:'advance-day'});copy.dispatch({type:'advance-day'});}assert.equal(copy.save(4),g.save(4));
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=f.load(),saved=blocked.save(4);blocked.dispatch({type:'plant-tree',x:10,y:10});assert.equal(blocked.save(4),saved);assert.equal(blocked.getSnapshot().lastTreeResult,null);
});
