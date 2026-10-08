import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { disasterFixture } from './support/disasters';
import { aircraftFixture } from './support/aircraft';
import { GameSimulation } from './support/game';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import type { GameEvent } from '../src/simulation/events';

const saved=(g:ReturnType<typeof GameSimulation.load>['simulation'])=>JSON.parse(g.save(4));
const loss=(b:Uint8Array)=>b[18]|b[19]<<8;

test('live frost cancels locusts, posts original loss/prices/sound and resumes daily cooling and ending exactly',()=>{
  const f=disasterFixture();f.state.weather.temperature=50;f.state.weather.temperatureAnomaly=0;
  const g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
  g.dispatch({type:'start-disaster',kind:'swarm'});const rng=saved(g).runtime.random;
  g.dispatch({type:'start-disaster',kind:'frost'});let s=g.getSnapshot();
  assert.equal(s.disasters.flags&48,16);assert.equal(loss(s.scenario.fields[1].bytes),255);assert.equal(s.weather.temperature,50);assert.equal(s.weather.temperatureAnomaly,22);
  assert.equal(s.cropMarketPrices[4],Math.min((f.state.cropMarketPrices[4]+(f.state.cropMarketPrices[4]>>>f.state.crops[4][72]))&65535,(f.state.crops[4][34]|f.state.crops[4][35]<<8)*4));
  assert.deepEqual(events,[{type:'sound',sound:'swarm'},{type:'sound',sound:'wind'}]);assert.deepEqual(saved(g).runtime.random,rng);
  const checkpoint=g.save(4),result=s.lastDisasterResult;
  if(result?.ok&&'fields'in result)result.fields.push(97);s.disasters.flags=0;assert.equal(g.save(4),checkpoint);
  g.tick(10000);assert.equal(g.save(4),checkpoint);
  const copy=GameSimulation.load(checkpoint,f.crops).simulation,replayed:GameEvent[]=[];copy.subscribeEvents(e=>replayed.push(e));
  assert.equal(copy.getSnapshot().lastDisasterResult,null);assert.equal(replayed.length,0);
  for(const game of [g,copy]){game.dispatch({type:'set-disasters-enabled',enabled:false});game.dispatch({type:'advance-day'});}
  assert.equal(g.getSnapshot().weather.temperature,28);assert.equal(g.getSnapshot().weather.temperatureAnomaly,20);
  for(const game of [g,copy])game.dispatch({type:'advance-day'});assert.equal(g.getSnapshot().weather.temperature,8);
  for(let day=2;day<35;day++)for(const game of [g,copy])game.dispatch({type:'advance-day'});
  assert.deepEqual(saved(g),saved(copy));assert.equal(g.getSnapshot().disasters.flags&16,0);
  assert.equal(replayed.filter(e=>e.type==='sound'&&e.sound==='wind').length,0);
});

test('crop circles request only original alien MIDI, preserve seven tiles through a saved active event and clear only the flag next frame',()=>{
  const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=1;
  const g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));g.dispatch({type:'start-disaster',kind:'crop-circles'});
  assert.equal(g.getSnapshot().disasters.flags&64,64);assert.equal(loss(g.getSnapshot().scenario.fields[1].bytes),10);
  assert.deepEqual(events,[{type:'music',track:'alien'}]);
  const checkpoint=g.save(4),copy=GameSimulation.load(checkpoint,f.crops).simulation;
  for(const game of [g,copy]){
    game.dispatch({type:'set-disasters-enabled',enabled:false});game.dispatch({type:'set-paused',paused:false});game.tick(1000 / 64);
    assert.equal(game.getSnapshot().disasters.flags&64,0);
    for(const [dx,dy,t]of [[2,4,211],[3,4,212],[4,4,213],[5,4,214],[6,4,215],[4,3,210],[4,5,216]])assert.equal(game.getSnapshot().scenario.cells[worldIndex(20+dx,20+dy)].terrain&2047,t);
    for(let day=0;day<35;day++)game.dispatch({type:'advance-day'});
  }
  assert.deepEqual(saved(g),saved(copy));assert.deepEqual(events,[{type:'music',track:'alien'}]);
});

test('disabled and ineligible starts preserve source eligibility/RNG while toxic warnings retain only their documented persistent effects',()=>{
  const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=0;const g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
  g.dispatch({type:'set-disasters-enabled',enabled:false});const disabled=g.save(4);
  for(const kind of ['frost','crop-circles','toxic-land','wind']as const){g.dispatch({type:'start-disaster',kind});assert.equal(g.save(4),disabled);}
  g.dispatch({type:'set-disasters-enabled',enabled:true});const before=saved(g);g.dispatch({type:'start-disaster',kind:'crop-circles'});
  assert.deepEqual(g.getSnapshot().lastDisasterResult,{ok:false,reason:'ineligible-crop'});const after=saved(g);
  assert.deepEqual(after.scenario,before.scenario);assert.deepEqual(after.finances,before.finances);assert.notDeepEqual(after.runtime.random,before.runtime.random);assert.deepEqual(events,[]);
  const beforeWarning=saved(g);g.dispatch({type:'start-disaster',kind:'toxic-land'});const warning=saved(g);
  assert.deepEqual(warning.scenario,beforeWarning.scenario);assert.deepEqual(warning.runtime.random,beforeWarning.runtime.random);assert.deepEqual(warning.runtime.weather,beforeWarning.runtime.weather);
  assert.equal(g.getSnapshot().disasters.flags&128,128);const checkpoint=g.save(4);g.dispatch({type:'start-disaster',kind:'toxic-land'});assert.equal(g.save(4),checkpoint);
  const copy=GameSimulation.load(checkpoint,f.crops).simulation;for(let day=0;day<35;day++)for(const game of [g,copy])game.dispatch({type:'advance-day'});
  assert.equal(g.getSnapshot().disasters.flags&128,128);assert.deepEqual(saved(g),saved(copy));assert.deepEqual(events,[]);
});

test('frost stop boundaries run both daily and per frame, with original tornado-gated dispatcher during flight',()=>{
  for(const [anomaly,immediate]of [[0,true],[1,false],[-1,false],[2,false]] as const){
    const f=disasterFixture();f.state.disasters.flags=16;f.state.weather.temperatureAnomaly=anomaly;
    const g=f.load();g.dispatch({type:'set-paused',paused:false});g.tick(1000 / 64);
    assert.equal(Boolean(g.getSnapshot().disasters.flags&16),!immediate);
    g.dispatch({type:'advance-day'});assert.equal(g.getSnapshot().disasters.flags&16,0);
  }
  const f=aircraftFixture(),base=f.load();base.dispatch({type:'buy-aircraft'});base.dispatch({type:'service-aircraft',slot:1,action:{kind:'fuel'}});
  base.dispatch({type:'start-flight',slot:1,columns:20,rows:16});assert.ok(base.getSnapshot().aircraftFlight);
  const state=readNativeSave(base.save(4)).state;state.weather.temperatureAnomaly=0;
  for(const tornado of [false,true]){
    state.disasters.flags=16|64|(tornado?1:0);Object.assign(state.disasters.tornado,{x:60,y:60});
    const g=GameSimulation.load(writeNativeSave(state,4),f.crops).simulation;g.tick(400);
    assert.equal(g.getSnapshot().disasters.flags&80,tornado?0:80);assert.equal(g.getSnapshot().daysAdvanced,state.daysAdvanced);
  }
});

test('new disaster commands remain silent and unchanged through town/default/flight modal guards',()=>{
  const f=disasterFixture();f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const debt=f.load();
  const a=aircraftFixture(),flight=a.load();flight.dispatch({type:'buy-aircraft'});flight.dispatch({type:'service-aircraft',slot:1,action:{kind:'fuel'}});flight.dispatch({type:'start-flight',slot:1,columns:20,rows:16});
  const state=readNativeSave(new GameSimulation(readScenario(f.state.scenario.sourceBytes!),f.crops).save(4)).state;
  state.scenario.schedule.bytes.fill(0);state.finances.town.townRevenue=50000;state.scenario.farm.calendar={day:6,week:3,month:11,year:1993,season:3};state.dayTicks=state.scenario.farm.dayDelayTicks-1;
  const town=GameSimulation.load(writeNativeSave(state,4),f.crops).simulation;town.dispatch({type:'advance-day'});assert.ok(town.getSnapshot().pendingTown);
  for(const g of [debt,flight,town]){
    const before=g.save(4),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
    for(const kind of ['frost','crop-circles','toxic-land','wind']as const)g.dispatch({type:'start-disaster',kind});
    assert.equal(g.save(4),before);assert.deepEqual(events,[]);assert.equal(g.getSnapshot().lastDisasterResult,null);
  }
});


test('manual high winds use the existing source start, prices, swarm cancellation and stop rule',()=>{
  const f=disasterFixture();f.state.weather.wind=5;const g=f.load();g.dispatch({type:'start-disaster',kind:'swarm'});
  const events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));g.dispatch({type:'start-disaster',kind:'wind'});
  assert.deepEqual(g.getSnapshot().lastDisasterResult,{ok:true,kind:'wind'});assert.equal(g.getSnapshot().disasters.flags&40,8);
  assert.equal(g.getSnapshot().weather.windAnomaly,35);assert.deepEqual(events,[{type:'sound',sound:'wind'}]);
  const loaded=GameSimulation.load(g.save(4),f.crops).simulation;
  for(let day=0;day<35;day++)for(const game of [g,loaded])game.dispatch({type:'advance-day'});
  assert.deepEqual(saved(g),saved(loaded));assert.equal(g.getSnapshot().disasters.flags&8,0);
});
