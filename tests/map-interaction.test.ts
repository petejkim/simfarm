import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readScenario,worldIndex } from '../src/formats/scenario';
import { mapObjectInteraction } from '../src/simulation/map-interaction';
import { toggleMapValve } from '../src/simulation/irrigation-placement';
import { shopFixture } from './support/livestock';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { readNativeSave,writeNativeSave } from '../src/formats/native-save';
import type { GameEvent } from '../src/simulation/events';
const source=(name:string)=>readFileSync(new URL(`../../simfarm-dos/${name}`,import.meta.url));

test('right-button callback, queue, Edit event7 and original valve writes are pinned to source',()=>{
  const exe=source('SIMFARM.EXE'),exact=(o:number,h:string)=>assert.equal(exe.subarray(o,o+h.length/2).toString('hex'),h);
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  exact(0x5fff,'b80c00b97f00ba2000cd33'); // INT33 callback3df:0020/file6010.
  exact(0x60a0,'2689857812'); // Raw AX event mask in32-byte queue entry.
  exact(0xe692,'c1e0048bc8408946dc'); // Consumer word index16*slot+1.
  exact(0xf1b9,'26f687761208');exact(0xf1f2,'6a07065326ff5f28'); // Mask8 -> event7.
  assert.equal(0x1f950+exe.readUInt16LE(0x213c4+2*2),0x20dfc);
  exact(0x20e1a,'9a0a003c23');exact(0x20e2c,'9a3e02d417');exact(0x20e65,'9ab803d417');
  exact(0x25637,'9ab8015719');exact(0x25653,'2680a73824fe');
  exact(0x25690,'9ab8015719');exact(0x256af,'26808f382401');
  exact(0x256da,'0bc12689872404eba3');exact(0x25703,'4141ebd3'); // Both second-orientation paths set the field bit.
});

test('valve toggles retain every flag, original orientation-dependent field write and source lookup bounds',()=>{
  const f=shopFixture(),w=f.state.scenario,cell=w.cells[worldIndex(10,10)],field=w.fields[1];
  field.bytes[7]|=1;field.bytes[10]=field.bytes[11]=11;field.bytes[12]=field.bytes[13]=8;
  const accounts=JSON.stringify(f.state.finances),farm={...w.farm},raw=Uint8Array.from(w.sourceBytes!);
  for(const tile of [122,123,124,125])for(let flags=0;flags<256;flags++){
    cell.terrain=0xf800|tile;cell.overlay=0xffff;cell.attribute=171;field.bytes[6]=flags;
    const before=Uint8Array.from(field.bytes);before[6]=tile===122?flags&~1:flags|1;
    assert.deepEqual(toggleMapValve(w,10,10),{ok:true,price:0,clearingCost:0,tile:tile^1});
    assert.equal(cell.terrain,0xf800|(tile^1));assert.equal(cell.overlay,0xffff);assert.equal(cell.attribute,171);
    assert.deepEqual(field.bytes,before);
  }
  // Query is at(x+1,y+1), with inclusive origin/exclusive far edge; never wraps at map edges.
  for(const [x,y,hit] of [[10,10,true],[17,17,true],[18,18,false],[9,10,false],[10,9,false],[95,95,false]] as const){
    w.cells[worldIndex(x,y)].terrain=122;field.bytes[6]=255;toggleMapValve(w,x,y);assert.equal(field.bytes[6],hit?254:255);
  }
  field.bytes[7]&=~1;cell.terrain=122;field.bytes[6]=255;toggleMapValve(w,10,10);assert.equal(field.bytes[6],255);
  for(const tile of [0,121,126,188,2047]){cell.terrain=tile;assert.deepEqual(toggleMapValve(w,10,10),{ok:false,reason:'valve-required'});assert.equal(cell.terrain,tile);}
  for(const [x,y] of [[-1,0],[96,0],[0,96],[0.5,0],[NaN,0]])assert.deepEqual(toggleMapValve(w,x,y),{ok:false,reason:'outside-map'});
  assert.deepEqual(w.farm,farm);assert.equal(JSON.stringify(f.state.finances),accounts);assert.deepEqual(w.sourceBytes,raw);
});

test('fixture interaction projection is read-only over all tile IDs and every original farm building',()=>{
  const f=shopFixture(),w=f.state.scenario,c=w.cells[worldIndex(10,10)];
  for(let tile=0;tile<2048;tile++){
    c.terrain=0xf800|tile;
    const result=mapObjectInteraction(w,10,10);
    assert.deepEqual(result,tile>=122&&tile<=125?{type:'toggle-valve',x:10,y:10}
      :tile>=188&&tile<=191?{type:'network',tool:tile&1?'close-gate':'open-gate',x:10,y:10}:null);
    assert.equal(c.terrain,0xf800|tile);
  }
  for(const [x,y] of [[-1,0],[96,0],[0,96],[0.5,0],[NaN,0]])assert.equal(mapObjectInteraction(w,x,y),null);
  let buildings=0;
  for(let id=0;id<8;id++){
    const world=readScenario(source(`SCEN${id}.SSM`)),before=JSON.stringify(world);
    for(const b of world.buildings.filter(b=>b.active)){
      const d=world.buildingDefinitions[b.type-64];
      for(let x=b.x;x<b.x+d.width;x++)for(let y=b.y;y<b.y+d.height;y++){
        assert.deepEqual(mapObjectInteraction(world,x,y),b.type===70||b.type===71?null:{type:'toggle-building-interior',slot:b.slot,x,y});buildings++;
      }
    }
    assert.equal(JSON.stringify(world),before);
  }
  assert.ok(buildings>100);
});

test('map valve command saves raw field effects, emits no invented audio and resumes identically',()=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;
  const field=w.fields[1];field.bytes[7]|=1;field.bytes[10]=field.bytes[11]=11;field.bytes[12]=field.bytes[13]=8;field.bytes[6]=255;
  w.cells[worldIndex(10,10)].terrain=0x800|122;w.cells[worldIndex(10,10)].overlay=0x4000;
  const g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));const before=readNativeSave(g.save(4)).state;
  g.dispatch({type:'toggle-valve',x:10,y:10});const now=readNativeSave(g.save(4)).state;
  assert.equal(now.scenario.fields[1].bytes[6],254);assert.equal(now.scenario.cells[worldIndex(10,10)].terrain,0x800|123);
  assert.deepEqual(now.finances,before.finances);assert.deepEqual(now.random,before.random);assert.deepEqual(events,[]);
  const saved=g.save(4),copy=GameSimulation.load(saved,f.crops).simulation;
  assert.equal(copy.save(4),saved);assert.equal(copy.getSnapshot().lastIrrigationResult,null);
  for(const sim of [g,copy]){sim.dispatch({type:'toggle-valve',x:10,y:10});for(let i=0;i<35;i++)sim.dispatch({type:'advance-day'});}
  assert.equal(g.save(4),copy.save(4));
});

test('right-click valve command observes default, town and flight command gates',()=>{
  const f=shopFixture();f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const debt=f.load();
  const a=aircraftFixture(),flight=a.load();flight.dispatch({type:'buy-aircraft'});flight.dispatch({type:'service-aircraft',slot:1,action:{kind:'fuel'}});
  flight.dispatch({type:'start-flight',slot:1,columns:20,rows:16});assert.ok(flight.getSnapshot().aircraftFlight);
  const state=readNativeSave(new GameSimulation(readScenario(f.state.scenario.sourceBytes!),f.crops).save(4)).state;
  state.scenario.schedule.bytes.fill(0);state.finances.town.townRevenue=50000;state.scenario.farm.calendar={day:6,week:3,month:11,year:1993,season:3};state.dayTicks=state.scenario.farm.dayDelayTicks-1;
  const town=GameSimulation.load(writeNativeSave(state,4),f.crops).simulation;town.dispatch({type:'advance-day'});assert.ok(town.getSnapshot().pendingTown);
  for(const sim of [debt,flight,town]){const saved=sim.save(4);sim.dispatch({type:'toggle-valve',x:10,y:10});assert.equal(sim.save(4),saved);assert.equal(sim.getSnapshot().lastIrrigationResult,null);}
});
