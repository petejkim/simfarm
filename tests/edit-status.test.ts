import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {readEditStatus} from '../src/formats/edit-status';
import {createEditStatus,appendEditStatus,recentEditStatuses} from '../src/simulation/edit-status';
import {disasterFixture} from './support/disasters';
import {GameSimulation} from './support/game';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),text=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).find(e=>e.name==='qmessage.dat')!.bytes;

test('status records and producer/renderer instructions are pinned to original bytes',()=>{
  expect(createHash('sha256').update(text).digest('hex')).toBe('f49a867d63b52d4157977f6e06dfc231af3689042af3da8ae032cbfcff5594b1');
  expect(exe.subarray(0x24164,0x2416b).toString('hex')).toBe('6a339ab42b751d');
  expect(exe.subarray(0x3838d,0x38394).toString('hex')).toBe('6a119ab42b751d');
  expect(exe.subarray(0x846f0+0x170,0x846f0+0x17b).toString('hex')).toBe('ffffffffffffffffffff00');
  expect(exe.subarray(0x22169,0x2216f).toString('hex')).toBe('2b46f28946ee'); // Computed index is stored, then ignored below.
  expect(exe.subarray(0x2217d,0x22186).toString('hex')).toBe('8b5ef22680bf700100');
  expect(exe.subarray(0x22188,0x2218d).toString('hex')).toBe('268a877001');
  expect(readEditStatus(text,17)).toBe('Choose a location for your field.');expect(readEditStatus(text,51)).toBe('Cannot place field there.');
});

test('all76 status records decode without padding, enforce boundaries and preserve source',()=>{
  const before=Uint8Array.from(text);
  for(let code=0;code<76;code++){
    expect(readEditStatus(text,code)).not.toContain('@');
    for(let end=code*64;end<(code+1)*64;end++)expect(()=>readEditStatus(text.subarray(0,end),code)).toThrow();
  }
  for(const code of [-1,76,255,NaN,0.5])expect(()=>readEditStatus(text,code)).toThrow();expect(text).toEqual(before);
});

test('ten-slot history suppresses adjacent duplicates, wraps, and corrects raw-slot display order without losing valid codes',()=>{
  const h=createEditStatus();expect(recentEditStatuses(h)).toEqual([]);
  for(let code=0;code<76;code++){
    appendEditStatus(h,code);const before=JSON.stringify(h);appendEditStatus(h,code);expect(JSON.stringify(h)).toBe(before);
    expect(recentEditStatuses(h)).toEqual(Array.from({length:Math.min(code+1,10)},(_,i)=>code-i));
  }
  const before=JSON.stringify(h);expect(()=>appendEditStatus(h,76)).toThrow();expect(JSON.stringify(h)).toBe(before);
});

test('live Plant selection and rejected placement update only transient history, respect guards and reset on load',()=>{
  const f=disasterFixture(),g=f.load(),before=g.save(4);
  g.dispatch({type:'edit-status',code:17});g.dispatch({type:'create-field',x:20,y:20,cropSlot:0});g.dispatch({type:'create-field',x:20,y:20,cropSlot:0});
  expect(g.getSnapshot().editStatuses).toEqual([51,17]);expect(g.save(4)).toBe(before);
  g.getSnapshot().editStatuses.push(75);g.dispatch({type:'edit-status',code:17});expect(g.getSnapshot().editStatuses).toEqual([17,51,17]);
  expect(GameSimulation.load(g.save(4),f.crops).simulation.getSnapshot().editStatuses).toEqual([]);
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=f.load();blocked.dispatch({type:'edit-status',code:17});expect(blocked.getSnapshot().editStatuses).toEqual([]);
});
