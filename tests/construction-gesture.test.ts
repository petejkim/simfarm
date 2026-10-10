import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { shopFixture } from './support/livestock';
import { GameSimulation } from './support/game';
import type { GameEvent } from '../src/simulation/events';

test('all six construction palette branches enter mode4 and the held one-tile loop with source repeat/audio guards',()=>{
  const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url)),exact=(o:number,h:string)=>assert.equal(exe.subarray(o,o+h.length/2).toString('hex'),h);
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  // Palette IDs -> branch, mode4 store, selected source definition type.
  for(const [id,branch,mode,typeAt,type] of [[11,0x217a8,0x217e9,0x217ef,297],[12,0x21864,0x218a5,0x218ab,303],
    [15,0x21a9a,0x21adb,0x21ae1,293],[16,0x21b56,0x21c0a,0x21b56,288],
    [19,0x21d74,0x21db5,0x21dbb,304],[20,0x21e30,0x21e71,0x21e77,289]]){
    assert.equal(0x1f950+exe.readUInt16LE(0x22352+(id-1)*2),branch);exact(mode,'26c747020400');exact(typeAt,'c746f2');assert.equal(exe.readUInt16LE(typeAt+3),type);
  }
  assert.equal(0x1f950+exe.readUInt16LE(0x20d9c+3*2),0x20c6c);exact(0x20c8b,'9a0200c221');
  exact(0x23e2f,'b8ffff8946f68946f0');exact(0x24178,'26833e740a01');exact(0x24187,'26833e720a01');
  exact(0x241f2,'c1f804');exact(0x24202,'c1f904');exact(0x2424a,'c646e802');
  exact(0x24b11,'807ee800');exact(0x24b1e,'807ee801');exact(0x24b34,'26f606211701');exact(0x24b3c,'e957f6');
  assert.equal(exe.subarray(0x846f0+0x59ad,0x846f0+0x59ad+8).toString(),'uhoh.voc');
  assert.equal(exe.subarray(0x846f0+0x59b6,0x846f0+0x59b6+13).toString(),'ploptool.voc\0');
});

test('ditch and valve construction requests original placement/error PCM without replaying or sounding free toggles',()=>{
  const f=shopFixture(),g=f.load(),events:GameEvent[]=[];g.subscribeEvents(e=>events.push(e));
  g.dispatch({type:'irrigation',tool:'ditch',x:10,y:10});g.dispatch({type:'irrigation',tool:'valve',x:10,y:10});
  assert.deepEqual(events,[{type:'sound',sound:'ploptool'},{type:'sound',sound:'ploptool'}]);
  const saved=g.save(4);g.dispatch({type:'irrigation',tool:'ditch',x:10,y:10});assert.equal(g.save(4),saved);
  assert.deepEqual(events.at(-1),{type:'sound',sound:'uhoh'});
  for(const tool of ['open-valve','close-valve'] as const)g.dispatch({type:'irrigation',tool,x:10,y:10});
  g.dispatch({type:'toggle-valve',x:10,y:10});assert.equal(events.length,3);
  const copy=GameSimulation.load(g.save(4),f.crops).simulation,restored:GameEvent[]=[];copy.subscribeEvents(e=>restored.push(e));
  assert.equal(restored.length,0);assert.equal(copy.save(4),g.save(4));
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=f.load();blocked.subscribeEvents(e=>restored.push(e));
  blocked.dispatch({type:'irrigation',tool:'ditch',x:11,y:10});assert.equal(restored.length,0);
});
