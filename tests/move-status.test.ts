import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readEditStatus} from '../src/formats/edit-status';
import {shopFixture} from './support/livestock';
import type {EditToolStatusCode} from '../src/simulation/edit-status';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
const messages=readFileSync(new URL('../public/assets/raw/qmessage.dat',import.meta.url));

test('source Move handler posts destination7 for all pickup categories and wrong busy62 at both equipment checks',()=>{
  expect(createHash('sha256').update(exe.subarray(0x136c6,0x1454d)).digest('hex')).toBe('7560e5339b2d2e0575722b5aeb8acbebaae79e45c9a0c1573de34be45db20e8b');
  for(const push of [0x138f6,0x139ea,0x13ae8,0x13bce])expect(exe.subarray(push,push+7).toString('hex')).toBe('6a079ab42b751d');
  for(const test of [0x13712,0x13c7e])expect(exe.subarray(test,test+6).toString('hex')).toBe('26f687bca603');
  for(const push of [0x1371a,0x13c86])expect(exe.subarray(push,push+7).toString('hex')).toBe('6a3e9ab42b751d');
  // Busy drop restores pickup cursor; ordinary successful drop does not post a new status.
  expect(exe.subarray(0x13c90,0x13c96).toString('hex')).toBe('b82e1ab99061');
  expect(exe.subarray(0x14510,0x14516).toString('hex')).toBe('b82e1ab99061');
  expect(readEditStatus(messages,7)).toBe('Choose a destination.');
  expect(readEditStatus(messages,61)).toBe('Cannot move item in use.');
  expect(readEditStatus(messages,62)).toBe('Not enough money to harvest field.');
});

test('Move interaction messages are transient, deduplicated, guarded and cannot request source erroneous62',()=>{
  const f=shopFixture(),g=f.load(),before=g.save(4);
  for(const code of [6,7,7,61,61] as const)g.dispatch({type:'edit-status',code});
  expect(g.getSnapshot().editStatuses).toEqual([61,7,6]);expect(g.save(4)).toBe(before);
  expect(()=>g.dispatch({type:'edit-status',code:62 as EditToolStatusCode})).toThrow('Invalid Edit tool status');
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=f.load();
  for(const code of [7,61] as const)blocked.dispatch({type:'edit-status',code});
  expect(blocked.getSnapshot().editStatuses).toEqual([]);
});
