import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readCrop } from '../src/formats/crop';
import { createMovingDisasters } from '../src/simulation/moving-disasters';
import { beginStationaryDisaster, advanceFrostDay, advanceStationaryDisasters } from '../src/simulation/stationary-disasters';
import { FarmRandom } from '../src/simulation/random';
import { disasterFixture } from './support/disasters';
import { GameSimulation } from './support/game';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';

const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const rng=(bounded=99)=>new FarmRandom({visual:1234,simulation:5678,bounded});
function fixture() {
  const f=disasterFixture(),w=f.state.scenario,c=f.crops.map(c=>c.rawDefinition),p=w.cropDefinitions.map(d=>d.price),d=createMovingDisasters(),r=rng();
  const weather=f.state.weather;
  const start=(kind:Parameters<typeof beginStationaryDisaster>[5],tick=65535)=>beginStationaryDisaster(w,c,p,weather,d,kind,tick,r);
  return {f,w,c,p,d,r,weather,start,field:w.fields[1]};
}
const loss=(f:ReturnType<typeof fixture>['field'])=>new DataView(f.bytes.buffer,f.bytes.byteOffset).getUint16(18,true);
const setLoss=(f:ReturnType<typeof fixture>['field'],n:number)=>new DataView(f.bytes.buffer,f.bytes.byteOffset).setUint16(18,n,true);

test('stationary event sensitivity, fixed circle offsets, flags and temperature/stop rules are pinned to executable bytes',()=>{
  const e=source('SIMFARM.EXE'),exact=(o:number,h:string)=>assert.equal(e.subarray(o,o+h.length/2).toString('hex'),h);
  exact(0x365a0,'f60696691075e0f606966920');exact(0x36675,'2680bff4c500740e68ff00');
  exact(0x3675b,'26f687eac502');exact(0x367bd,'6a0aff76fc9a56005719');
  exact(0x367e1,'268aa72d042500f88b4ef82b4efe81c1d100');
  exact(0x36815,'268b872a0725d2f80cd2');exact(0x36824,'268b872e0725d8f80cd8');
  exact(0x36840,'800e966980');exact(0x370d3,'26803e76420075096a05');
  exact(0x36d4a,'80269669bfe94a03');exact(0xd1cf,'26290632d526191634d5');
  exact(0xd1ec,'6a059a3c10e624');
  assert.equal(e.subarray(0x846f0+0x69e2,0x846f0+0x69ec).toString('ascii'),'alien.xmi\0');
});

test('frost damages all sensitive active fields regardless of state, saturates loss and reprices before repeated-start rejection',()=>{
  const {w,c,p,d,r,weather,start,field}=fixture();weather.temperature=50;field.bytes[14]=1;
  w.fields[97].bytes.set(field.bytes);w.fields[97].bytes[14]=6;assert.equal(c[6][72],0);
  w.fields[5].bytes.set(field.bytes);setLoss(w.fields[5],65500);
  const beforeRandom=r.snapshot(),beforeCells=structuredClone(w.cells),beforeSource=Uint8Array.from(w.sourceBytes);
  for(let state=0;state<256;state++){
    field.bytes[2]=state;setLoss(field,0);d.flags=32;d.swarm.fieldSlot=1;
    const result=start('frost');assert.deepEqual(result,{ok:true,kind:'frost',fields:[1,5],cancelledSwarm:true});
    assert.equal(loss(field),255);assert.equal(loss(w.fields[5]),65535);assert.equal(loss(w.fields[97]),0);assert.equal(field.state,state);
    assert.equal(d.flags,16);assert.equal(weather.temperatureAnomaly,22);assert.equal(weather.temperature,50);
  }
  assert.deepEqual(r.snapshot(),beforeRandom);assert.deepEqual(w.cells,beforeCells);assert.deepEqual(w.sourceBytes,beforeSource);
  p[1]=100;const oldLoss=loss(field);assert.deepEqual(start('frost'),{ok:false,reason:'already-active'});
  assert.equal(p[1],150);assert.equal(loss(field),oldLoss);
  d.enabled=false;p[1]=100;assert.deepEqual(start('frost'),{ok:false,reason:'disabled'});assert.equal(p[1],100);
});

test('frost temperature retains signed byte assignment, cumulative32-bit subtraction and distinct daily/dispatcher stop boundaries',()=>{
  for(const [temperature,old,next] of [[28,9,9],[27,-4,-4],[29,0,1],[50,0,22],[155,0,127],[156,0,-128],[284,0,0]]){
    const {weather,d,start}=fixture();weather.temperature=temperature;weather.temperatureAnomaly=old;start('frost');
    assert.equal(weather.temperatureAnomaly,next);assert.equal(weather.temperature,temperature);
    const ended=advanceStationaryDisasters(weather,d);assert.deepEqual(ended,next===0?['frost']:[]);
    const wasActive=Boolean(d.flags&16);assert.equal(advanceFrostDay(weather,d),next<2&&wasActive);
    assert.equal(weather.temperature,next>=2?(temperature-next)|0:temperature);assert.equal(weather.temperatureAnomaly,next>=2?next-2:0);
  }
  const {weather,d,start}=fixture();weather.temperature=50;weather.temperatureAnomaly=0;start('frost');
  for(let day=0;day<11;day++)advanceFrostDay(weather,d);
  assert.equal(weather.temperature,-82);assert.equal(weather.temperatureAnomaly,0);assert.equal(d.flags&16,16);
  assert.deepEqual(advanceStationaryDisasters(weather,d),['frost']);assert.equal(d.flags&16,0);
  weather.temperature=-2147483648;weather.temperatureAnomaly=2;advanceFrostDay(weather,d);assert.equal(weather.temperature,2147483646);
});

test('crop circles use the biased selector without retrying ineligible crops and retain exact seven source tiles/flags',()=>{
  const {w,c,p,d,r,weather,field,start}=fixture();field.bytes[14]=1;
  for(const cell of w.cells){cell.terrain=0xa800|688;cell.overlay=0xbeef;cell.attribute=123;}
  const before=structuredClone(w.cells),records=w.fields.map(f=>Uint8Array.from(f.bytes)),prices=[...p],expected=rng();expected.below(1);
  assert.deepEqual(start('crop-circles'),{ok:true,kind:'crop-circles',fields:[1],cancelledSwarm:false});assert.equal(loss(field),10);
  const pattern=[[2,4,211],[3,4,212],[4,4,213],[5,4,214],[6,4,215],[4,3,210],[4,5,216]];
  for(const [dx,dy,tile]of pattern)before[worldIndex(field.x+dx,field.y+dy)].terrain=0xa800|tile;
  assert.deepEqual(w.cells,before);assert.deepEqual(p,prices);assert.deepEqual(r.snapshot(),expected.snapshot());
  records[1][18]=10;assert.deepEqual(w.fields.map(f=>f.bytes),records);
  assert.deepEqual(advanceStationaryDisasters(weather,d),['crop-circles']);assert.deepEqual(w.cells,before);
  setLoss(field,65530);assert.ok(start('crop-circles').ok);assert.equal(loss(field),65535);
  d.flags=0;field.bytes[14]=0;assert.equal(c[0][62]&2,0);const saved=JSON.stringify(w);const prior=r.snapshot();
  assert.deepEqual(start('crop-circles'),{ok:false,reason:'ineligible-crop'});assert.equal(JSON.stringify(w),saved);assert.notDeepEqual(r.snapshot(),prior);
  // Last active ordinal is excluded, even when it is the only eligible crop.
  w.fields[97].bytes.set(field.bytes);w.fields[97].bytes[14]=1;
  for(let seed=0;seed<256;seed++)assert.deepEqual(beginStationaryDisaster(w,c,p,weather,d,'crop-circles',0,rng(seed)),{ok:false,reason:'ineligible-crop'});
  field.bytes[7]=w.fields[97].bytes[7]=0;const emptyRng=r.snapshot();assert.deepEqual(start('crop-circles'),{ok:false,reason:'no-fields'});assert.deepEqual(r.snapshot(),emptyRng);
});

test('circle writes preserve source behavior outside narrow fields while clipping map edges without aliasing cells',()=>{
  for(const [x,y]of [[0,0],[95,0],[0,95],[93,91],[95,95]]){
    const {w,field,start}=fixture();field.bytes[14]=1;field.bytes[10]=x;field.bytes[11]=y;field.bytes[12]=field.bytes[13]=1;
    const before=structuredClone(w.cells);assert.ok(start('crop-circles').ok);
    for(const [dx,dy,t]of [[2,4,211],[3,4,212],[4,4,213],[5,4,214],[6,4,215],[4,3,210],[4,5,216]]){
      if(x+dx<96&&y+dy<96)before[worldIndex(x+dx,y+dy)].terrain=(before[worldIndex(x+dx,y+dy)].terrain&0xf800)|t;
    }
    assert.deepEqual(w.cells,before);assert.equal(loss(field),10);
  }
});

test('toxic-land warning changes only its persistent flag/start tick, with no invented damage, weather, pricing or RNG',()=>{
  const {w,p,d,r,weather,start}=fixture(),before=JSON.stringify({w,p,weather,r:r.snapshot()});d.flags=0x8000;
  assert.deepEqual(start('toxic-land'),{ok:true,kind:'toxic-land',fields:[],cancelledSwarm:false});assert.equal(d.flags,0x8080);assert.equal(d.lastStartTick,65535);
  assert.equal(JSON.stringify({w,p,weather,r:r.snapshot()}),before);
  assert.deepEqual(start('toxic-land',0),{ok:false,reason:'already-active'});assert.equal(d.lastStartTick,65535);
  advanceFrostDay(weather,d);assert.deepEqual(advanceStationaryDisasters(weather,d),[]);assert.equal(d.flags,0x8080);
});

test('all eight farms retain stationary flags, original field/terrain changes and weather through existing v14 checkpoints',()=>{
  for(let id=0;id<8;id++){
    const world=readScenario(source(`SCEN${id}.SSM`)),crops=world.cropFiles.map(n=>readCrop(n.replace('.crp',''),source('CROPS/'+n.toUpperCase())));
    const {state}=readNativeSave(new GameSimulation(world,crops).save(id)),c=crops.map(c=>c.rawDefinition),p=state.cropMarketPrices;
    const r=new FarmRandom(state.random),raw=Uint8Array.from(world.sourceBytes);
    for(const kind of ['frost','crop-circles','toxic-land'] as const)beginStationaryDisaster(state.scenario,c,p,state.weather,state.disasters,kind,17,r);
    state.random=r.snapshot();const text=writeNativeSave(state,id),loaded=GameSimulation.load(text,crops).simulation;
    assert.deepEqual(JSON.parse(loaded.save(id)),JSON.parse(text));assert.deepEqual(loaded.getSnapshot().scenario.sourceBytes,raw);
  }
});
