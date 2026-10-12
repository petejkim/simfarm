import {test,expect} from 'bun:test';
import {shopFixture,livestockFixture} from './support/livestock';
import {GameSimulation} from './support/game';
import type {GameEvent} from '../src/simulation/events';
function fixture(animal=false){
 const f=animal?livestockFixture(1):shopFixture();
 f.state.finances.town.recreationCount=1;f.state.finances.town.recreationCoordinates.set([72,72]);
 f.state.scenario.farm.messages=false;return f;
}
test('debug starts real fair/rodeo outside their dates, saves modal state and never advances farm time',()=>{
 for(const action of ['rodeo','fair'] as const)for(const running of [false,true]){
  const f=fixture(action==='fair');f.state.paused=!running;f.state.dayTicks=3;
  const game=f.load(),before=game.getSnapshot(),events:GameEvent[]=[];game.subscribeEvents(e=>events.push(e));
  game.dispatch({type:'debug-town-event',action});
  const pending=game.getSnapshot();expect(pending.townEvent.pending?.kind).toBe(action==='fair'?'fair-entry':'rodeo-entry');
  expect(pending.scenario.farm.calendar).toEqual(before.scenario.farm.calendar);
  expect(pending.daysAdvanced).toBe(before.daysAdvanced);expect(pending.townEvent.continuation?.phase).toBe('debug');
  expect(events.filter(e=>e.type==='music')).toEqual([{type:'music',track:action==='fair'?'carnival':'rodeo'}]);
  const saved=game.save(4),copy=GameSimulation.load(saved,f.crops).simulation;
  game.dispatch({type:'debug-town-event',action:'fair'});game.tick(8000);expect(game.save(4)).toBe(saved);
  for(const g of [game,copy])g.dispatch({type:'resolve-town-event',accept:true});
  expect(copy.save(4)).toBe(game.save(4));expect(game.getSnapshot().paused).toBe(!running);
  expect(game.getSnapshot().scenario.farm.cash).toBe(before.scenario.farm.cash-(action==='fair'?200:500));
  expect(JSON.parse(game.save(4)).runtime.dayTicks).toBe(3);
  const active=game.save(4);game.dispatch({type:'debug-town-event',action:'rodeo'});expect(game.save(4)).toBe(active);
  for(let i=0;i<(action==='fair'?3:2);i++)game.dispatch({type:'debug-town-event',action:'advance-week'});
  expect(game.getSnapshot().townEvent.pending?.kind).toBe(action==='fair'?'fair-result':'rodeo-result');
  const result=GameSimulation.load(game.save(4),f.crops).simulation;
  game.dispatch({type:'resolve-town-event',accept:true});result.dispatch({type:'resolve-town-event',accept:true});
  expect(result.save(4)).toBe(game.save(4));expect(game.getSnapshot().townEvent.mode).toBe(0);
  expect(game.getSnapshot().scenario.farm.calendar).toEqual(before.scenario.farm.calendar);
  const done=game.save(4);game.dispatch({type:'resolve-town-event',accept:true});expect(game.save(4)).toBe(done);
 }
});
test('debug honors event prerequisites, announcements and declines without inventing resources',()=>{
 for(const gate of ['recreation','cash','inactive'] as const){
  const f=fixture();if(gate==='recreation')f.state.finances.town.recreationCount=0;
  if(gate==='cash')f.state.scenario.farm.cash=999;
  const game=f.load(),before=game.save(4);game.dispatch({type:'debug-town-event',action:gate==='inactive'?'advance-week':'rodeo'});
  expect(game.save(4)).toBe(before);
 }
 const f=fixture(),g=f.load(),cash=g.getSnapshot().scenario.farm.cash;
 g.dispatch({type:'debug-town-event',action:'fair'});expect(g.getSnapshot().townEvent.pending?.kind).toBe('fair-announcement');
 g.dispatch({type:'resolve-town-event',accept:false});expect(g.getSnapshot().scenario.farm.cash).toBe(cash);
 expect(g.getSnapshot().townEvent.weeksRemaining).toBe(3);
});
test('debug continuation validation rejects changed dates, unpaused ownership and missing dialogs',()=>{
 const f=fixture(),g=f.load();g.dispatch({type:'debug-town-event',action:'rodeo'});
 const valid=JSON.parse(g.save(4));
 for(const change of [
  (s:any)=>s.runtime.townEvent.continuation.before.day=(s.scenario.farm.calendar.day+1)%7,
  (s:any)=>s.runtime.paused=false,
  (s:any)=>s.runtime.townEvent.pending=null,
  (s:any)=>s.runtime.townEvent.continuation.phase='invalid',
 ]){const invalid=structuredClone(valid);change(invalid);expect(()=>GameSimulation.load(JSON.stringify(invalid),f.crops)).toThrow();}
 const older=JSON.parse(f.load().save(4));older.version=27;
 expect(GameSimulation.load(JSON.stringify(older),f.crops).simulation.getSnapshot().townEvent).toEqual(f.load().getSnapshot().townEvent);
});

test('debug town expansion opens the choice at any date without the town fund, is never saved, and builds without year-end phases',()=>{
 for(const running of [false,true]){
  const f=shopFixture();f.state.paused=!running;f.state.finances.town.expansionFunds=0; // bypasses the $15,000 fund gate
  const game=f.load(),before=game.getSnapshot(),saved=game.save(4);
  game.dispatch({type:'debug-town-expansion'});
  const pending=game.getSnapshot();expect(pending.pendingTown?.phase).toBe('debug');expect(pending.paused).toBe(true);
  const site=pending.pendingTown!.site,flag=(site.regionX*12+site.regionY)*7+1;
  expect(pending.scenario.regionalConditions[flag]).toBe(before.scenario.regionalConditions[flag]); // nothing reserved yet
  expect(game.save(4)).toBe(saved); // the debug choice is not kept in saves
  game.dispatch({type:'advance-day'});game.dispatch({type:'debug-town-expansion'});expect(game.getSnapshot().pendingTown?.site).toEqual(site);
  game.dispatch({type:'choose-town',choice:'airport'});
  const after=game.getSnapshot();expect(after.lastTownResult?.ok).toBe(true);expect(after.pendingTown).toBeNull();
  const result=after.lastTownResult as {ok:true;type:number;site:typeof site};expect([result.type,result.site]).toEqual([5,site]);expect(after.scenario.regionalConditions[flag-1]&15).toBe(5);
  expect(after.scenario.farm.calendar).toEqual(before.scenario.farm.calendar);expect(after.daysAdvanced).toBe(before.daysAdvanced);
  expect(after.finances.town.expansionFunds).toBe(0);expect(after.paused).toBe(!running);
 }
});

test('a failed debug town choice keeps the choice open and restores the site exactly',()=>{
 const f=shopFixture();f.state.finances.town.recreationCount=7;
 const game=f.load();game.dispatch({type:'debug-town-expansion'});
 const site=game.getSnapshot().pendingTown!.site,flag=(site.regionX*12+site.regionY)*7+1,before=game.getSnapshot();
 game.dispatch({type:'choose-town',choice:'recreational'});
 const after=game.getSnapshot();expect(after.lastTownResult).toEqual({ok:false,reason:'recreation-limit'});expect(after.pendingTown?.phase).toBe('debug');
 expect(after.scenario.regionalConditions[flag]).toBe(before.scenario.regionalConditions[flag]);expect(after.finances.town.activeSite).toEqual(before.finances.town.activeSite);
});
