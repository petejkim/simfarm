import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DISASTER_MENU_KINDS,disasterMenuChecks} from '../src/simulation/disaster-menu';
import {disasterFixture} from './support/disasters';
import {GameSimulation} from './support/game';
import type {GameEvent} from '../src/simulation/events';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));

test('original Disasters callback, check writes and ungated menu dispatch are pinned to executable bytes',()=>{
  for(const [a,b,h] of [[0x3e3b0,0x3e482,'8d5b75fe5d8fd09a9f3f24e2c4144f1c6177cf8d989bbcd3d0fdc262cfd60086'],[0x3f114,0x3f1b8,'a9e62ae4bc0a296884a47f704b45f9bab9d029113294627a9f179803b3e8183b'],[0x36574,0x3658c,'3e871a61ecdecc204f276ced0d4896b59d4821a9877d55858011f364590eed15']] as const)
    expect(createHash('sha256').update(exe.subarray(a,b)).digest('hex')).toBe(h);
  const targets=Array.from({length:7},(_,i)=>0x3e3b0+exe.readUInt16LE(0x3e448+i*2));
  expect(targets).toEqual([0x3e3c0,0x3e3e2,0x3e3f2,0x3e414,0x3e418,0x3e41c,0x3e420]);
  expect(targets.slice(0,6).map(a=>exe[a+1])).toEqual([1,4,2,3,5,6]);
  expect(exe.subarray(0x3e424,0x3e430).toString('hex')).toBe('26803695690126a095693401');
});

test('menu checks reflect all source event masks and inverse Disable without changing state',()=>{
  for(let flags=0;flags<256;flags++)for(const enabled of [false,true]){
    const s={flags,enabled};expect(disasterMenuChecks(s)).toEqual([1,32,2,4,16,8].map(mask=>!!(flags&mask)).concat(!enabled));expect(s).toEqual({flags,enabled});
  }
});

test('all six explicit menu choices start their actual source events, including when disabled, with canonical saves and effects',()=>{
  const masks=[1,32,2,4,16,8];
  for(const [index,action] of DISASTER_MENU_KINDS.entries())for(const enabled of [false,true]){
    const f=disasterFixture();f.state.disasters.enabled=enabled;
    const game=f.load(),control=f.load(),events:GameEvent[]=[],expected:GameEvent[]=[];
    game.subscribeEvents(e=>events.push(e));control.subscribeEvents(e=>expected.push(e));
    game.dispatch({type:'disaster-menu',action});control.dispatch({type:'set-disasters-enabled',enabled:true});control.dispatch({type:'start-disaster',kind:action});
    expect(game.getSnapshot().lastDisasterResult?.ok).toBe(true);expect(game.getSnapshot().disasters.flags&masks[index]).toBe(masks[index]);
    expect(disasterMenuChecks(game.getSnapshot().disasters)[index]).toBe(true);expect(game.getSnapshot().disasters.enabled).toBe(true);
    expect(events).toEqual(expected);expect(game.save(4)).toBe(control.save(4));
    const checkpoint=game.save(4),copy=GameSimulation.load(checkpoint,f.crops).simulation;copy.subscribeEvents(e=>events.push(e));
    const count=events.length;copy.getSnapshot();expect(copy.save(4)).toBe(checkpoint);expect(events.length).toBe(count);
  }
});

test('Disable preserves active damage and saved clocks, and selecting an active event does not toggle it off',()=>{
  const f=disasterFixture(),g=f.load();g.dispatch({type:'disaster-menu',action:'swarm'});
  const before=JSON.parse(g.save(4));g.dispatch({type:'disaster-menu',action:'disable'});const after=JSON.parse(g.save(4));
  before.runtime.disasters.enabled=false;expect(after).toEqual(before);expect(disasterMenuChecks(g.getSnapshot().disasters)).toEqual([false,true,false,false,false,false,true]);
  g.dispatch({type:'set-paused',paused:false});g.tick(1280);const s=g.getSnapshot();expect(s.scenario.fields[1].bytes[18]|s.scenario.fields[1].bytes[19]<<8).toBeGreaterThan(0);
  g.dispatch({type:'disaster-menu',action:'swarm'});expect(g.getSnapshot().lastDisasterResult).toEqual({ok:false,reason:'already-active'});expect(g.getSnapshot().disasters.enabled).toBe(false);expect(g.getSnapshot().disasters.flags&32).toBe(32);
  g.dispatch({type:'disaster-menu',action:'disable'});expect(g.getSnapshot().disasters.enabled).toBe(true);
});

test('failed Locusts keeps Disable, no phantom check or new navigation; invalid actions never enable or mutate a farm',()=>{
  const f=disasterFixture();for(const field of f.state.scenario.fields)field.bytes[7]&=~1;f.state.disasters.enabled=false;
  const g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));const before=g.save(4);
  g.dispatch({type:'disaster-menu',action:'swarm'});expect(g.getSnapshot().lastDisasterResult).toEqual({ok:false,reason:'no-fields'});expect(g.save(4)).toBe(before);expect(events).toEqual([]);
  expect(disasterMenuChecks(g.getSnapshot().disasters)).toEqual([false,false,false,false,false,false,true]);
  for(const action of ['crop-circles','toxic-land','',null,42])expect(()=>g.dispatch({type:'disaster-menu',action:action as 'swarm'})).toThrow('Invalid disaster menu action');
  expect(g.save(4)).toBe(before);
});
