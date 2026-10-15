import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {shopFixture} from './support/livestock';
import {worldIndex} from '../src/formats/scenario';
import {readEditStatus} from '../src/formats/edit-status';

test('Bulldoze source checks town ownership before unsigned cash25 and posts42 before lookup',()=>{
  const b=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  expect(createHash('sha256').update(b.subarray(0x259b5,0x259fc)).digest('hex')).toBe('dfcd4b2194777e6669c583b1287ddfaefe393af297c52818b635d86266742675');
  expect(b.subarray(0x259c0,0x259c6).toString('hex')).toBe('26f687254c40');
  expect(b.subarray(0x259cf,0x259df).toString('hex')).toBe('26833e4a3e00752526833e483e19731d');
  expect(b.subarray(0x259eb,0x259f2).toString('hex')).toBe('6a2a9ab42b751d');
  expect(readEditStatus(readFileSync(new URL('../artifacts/original-assets/qmessage.dat',import.meta.url)),42)).toBe('Not enough money.');
});

test('canonical Bulldoze cash feedback honors town priority and the25 boundary without changing rejected saves',()=>{
  for(const cash of [0,1,24,25,65536,0xffffffff])for(const town of [false,true]){
    const f=shopFixture(),w=f.state.scenario;w.farm.cash=cash;
    const p=worldIndex(40,40);w.cells[p].terrain=161;w.cells[p].overlay=town?0x4800:0x800;
    const g=f.load(),before=g.save(4),command={type:'remove-object',kind:'terrain',slot:p,tile:161,x:40,y:40} as const;
    g.dispatch(command);
    if(town||cash<25){
      expect(g.save(4)).toBe(before);expect(g.getSnapshot().lastRemovalResult).toEqual({ok:false,reason:town?'town-owned':'insufficient-cash'});
      expect(g.getSnapshot().editStatuses).toEqual(town?[]:[42]);
      g.dispatch(command);expect(g.getSnapshot().editStatuses).toEqual(town?[]:[42]);
    }else{expect(g.getSnapshot().lastRemovalResult?.ok).toBe(true);expect(g.getSnapshot().scenario.farm.cash).toBe(cash-25);expect(g.getSnapshot().editStatuses).toEqual([]);}
  }
});

test('cash warning precedes missing-target lookup and remains blocked by financial decisions',()=>{
  const f=shopFixture();f.state.scenario.farm.cash=24;
  const g=f.load(),before=g.save(4);g.dispatch({type:'remove-object',kind:'terrain',slot:0,tile:0,x:40,y:40});
  expect(g.getSnapshot().editStatuses).toEqual([42]);expect(g.save(4)).toBe(before);
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=f.load();
  blocked.dispatch({type:'edit-status',code:42});blocked.dispatch({type:'remove-object',kind:'terrain',slot:0,x:40,y:40});
  expect(blocked.getSnapshot().editStatuses).toEqual([]);
});
