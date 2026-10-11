import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {FIXED_HARVEST_MESSAGE} from '../src/formats/field-message';
import {readScenario} from '../src/formats/scenario';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
import type {GameEvent} from '../src/simulation/events';
const source=(name:string)=>readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url));

test('fixed-harvest message uses original literal, crop76 guard, portrait74 and common OK popup',()=>{
  const exe=source('SIMFARM.EXE'),p=0x846f0+0x6142;
  expect(exe.subarray(p,p+FIXED_HARVEST_MESSAGE.length+1).toString()).toBe(FIXED_HARVEST_MESSAGE+'\0');
  expect(exe.subarray(0x2e488,0x2e490).toString('hex')).toBe('2680bff8c5007420');
  expect(exe.subarray(0x2e490,0x2e4ac).toString('hex')).toBe('6a016a0068960068c0006a006a016a4a1e6842619af410360683c412');
});

test('rejected fixed harvest emits a mandatory transient message per request without changing the farm or replaying a save',()=>{
  for(const enabled of [true,false]){
    const game=new GameSimulation(readScenario(source('SCEN0.SSM')),browserCrops).withAllCrops(browserCrops);
    game.dispatch({type:'set-option',option:'messages',enabled});const before=game.save(0),seen:GameEvent[]=[];
    game.subscribeEvents(e=>seen.push(e));const c=game.getSnapshot().scenario.farm.calendar,week=c.month*4+c.week+1;
    for(let i=0;i<2;i++)game.dispatch({type:'edit-field-plan',fieldSlot:1,week,action:{kind:'harvest'}});
    expect(seen).toEqual(Array(2).fill({type:'field-notice',id:'fixed-harvest-week'}));expect(game.save(0)).toBe(before);
    const copy=GameSimulation.load(before,browserCrops).simulation;copy.subscribeEvents(e=>seen.push(e));copy.getSnapshot();copy.dispatch({type:'set-speed',speed:1});expect(seen).toHaveLength(2);expect(copy.save(0)).toBe(before);
    game.dispatch({type:'edit-field-plan',fieldSlot:1,week:week-1,action:{kind:'harvest'}});expect(seen).toHaveLength(2);expect(game.save(0)).toBe(before);
  }
});
