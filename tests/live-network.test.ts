import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { GameSimulation, type GameCommand } from './support/game';
import { shopFixture } from './support/livestock';
import { aircraftFixture } from './support/aircraft';
import { readScenario, worldIndex } from '../src/formats/scenario';
import { readNativeSave, writeNativeSave } from '../src/formats/native-save';
import { animalCanWalk } from '../src/simulation/animal-world';
import type { GameEvent } from '../src/simulation/events';

const commands: GameCommand[] = [
  { type: 'network', tool: 'road-161', x: 10, y: 10 }, { type: 'network', tool: 'road-150', x: 11, y: 10 },
  { type: 'network', tool: 'road-150', x: 12, y: 10 },
  { type: 'network', tool: 'fence', x: 10, y: 12 }, { type: 'network', tool: 'fence', x: 11, y: 12 },
  { type: 'network', tool: 'gate', x: 10, y: 12 }, { type: 'network', tool: 'open-gate', x: 10, y: 12 },
  { type: 'network', tool: 'close-gate', x: 10, y: 12 },
];

test('live road/fence/gate commands retain original accounting, sound, source bytes, detached feedback and v14 continuation', () => {
  const f = shopFixture(); f.state.scenario.cells[worldIndex(12, 10)].terrain = 0x2000 | 98;
  const g = f.load(), before = readNativeSave(g.save(4)).state, events: GameEvent[] = []; g.subscribeEvents(e => events.push(e));
  for (const command of commands) {
    g.dispatch(command); assert.ok(g.getSnapshot().lastNetworkResult?.ok);
    const loaded = GameSimulation.load(g.save(4), f.crops).simulation;
    assert.equal(loaded.save(4), g.save(4)); assert.equal(loaded.getSnapshot().lastNetworkResult, null);
  }
  const w = g.getSnapshot().scenario;
  assert.equal(w.farm.cash, before.scenario.farm.cash - 265);
  assert.equal(g.getSnapshot().finances.annual.otherExpenses, before.finances.annual.otherExpenses + 265);
  assert.deepEqual([w.cells[worldIndex(10,10)].terrain, w.cells[worldIndex(11,10)].terrain, w.cells[worldIndex(12,10)].terrain], [162,151,0x2000|172]);
  assert.deepEqual(events, Array.from({ length: 6 }, () => ({ type: 'sound', sound: 'ploptool' })));
  assert.deepEqual(readNativeSave(g.save(4)).state.random, before.random); assert.deepEqual(w.sourceBytes,before.scenario.sourceBytes);
  const saved = g.save(4), result = g.getSnapshot().lastNetworkResult;
  if (result?.ok) result.price = 999; w.cells[worldIndex(10,12)].terrain = 15; assert.equal(g.save(4),saved);
  const copy = GameSimulation.load(saved, f.crops).simulation;
  for (const game of [g,copy]) {
    game.dispatch({type:'network',tool:'open-gate',x:10,y:12}); assert.ok(animalCanWalk(game.getSnapshot().scenario,10,12));
    game.dispatch({type:'network',tool:'close-gate',x:10,y:12}); assert.equal(animalCanWalk(game.getSnapshot().scenario,10,12),false);
    for(let d=0;d<35;d++)game.dispatch({type:'advance-day'});
  }
  assert.equal(g.save(4),copy.save(4));
});

test('rejected live construction keeps checkpoints and RNG intact, while gate actions remain free and idempotent', () => {
  const f=shopFixture();f.state.scenario.farm.cash=44;f.state.scenario.farm.autoClear=true;
  f.state.scenario.cells[worldIndex(10,10)].terrain=535;f.state.scenario.cells[worldIndex(11,10)].terrain=188;
  const g=f.load(), before=g.save(4), events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
  g.dispatch(commands[0]);assert.deepEqual(g.getSnapshot().lastNetworkResult,{tool:'road-161',ok:false,reason:'insufficient-cash'});
  assert.equal(g.save(4),before);assert.deepEqual(events,[{type:'sound',sound:'uhoh'}]);
  const oldCash=g.getSnapshot().scenario.farm.cash;g.dispatch({type:'network',tool:'open-gate',x:11,y:10});
  const opened=g.save(4);g.dispatch({type:'network',tool:'open-gate',x:11,y:10});assert.equal(g.save(4),opened);
  assert.equal(g.getSnapshot().scenario.farm.cash,oldCash);assert.equal(events.length,1);
});

test('network placement and gate commands are suspended during defaults, town choice and modal flight', () => {
  const f=shopFixture();f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const debt=f.load();
  const air=aircraftFixture(), flight=air.load();flight.dispatch({type:'buy-aircraft'});flight.dispatch({type:'service-aircraft',slot:1,action:{kind:'fuel'}});
  flight.dispatch({type:'start-flight',slot:1,columns:20,rows:16});flight.dispatch({type:'set-paused',paused:true});assert.ok(flight.getSnapshot().aircraftFlight);
  const state=readNativeSave(new GameSimulation(readScenario(f.state.scenario.sourceBytes!),f.crops).save(4)).state;
  state.scenario.schedule.bytes.fill(0);state.finances.town.townRevenue=50000;state.scenario.farm.calendar={day:6,week:3,month:11,year:1993,season:3};state.dayTicks=state.scenario.farm.dayDelayTicks-1;
  const town=GameSimulation.load(writeNativeSave(state,4),f.crops).simulation;town.dispatch({type:'advance-day'});assert.ok(town.getSnapshot().pendingTown);
  for(const g of [debt,flight,town]) {
    const before=g.save(4), events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
    for(const c of commands)g.dispatch(c);
    assert.equal(g.save(4),before);assert.equal(g.getSnapshot().lastNetworkResult,null);assert.deepEqual(events,[]);
  }
});
