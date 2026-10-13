import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FIELD_TOOL_MENUS, SPRAY_TOOLS } from '../src/formats/field-tool-menu';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url)),ds=0x846f0;
test('Plant and Spray menu chains, source geometry, item order and native command routes match source',()=>{
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  for(const [kind,offset,count,columns,rows] of [['plant',0x545e,16,2,9],['spray',0x54b0,4,1,5]] as const){
    const g=FIELD_TOOL_MENUS[kind];assert.deepEqual([0,2,4,6].map(i=>exe.readUInt16LE(ds+offset+i)),[g.x,g.y,g.width,g.height]);
    assert.equal(exe.readUInt16LE(ds+offset+8),count);assert.equal(exe[ds+offset+12],columns);
    assert.equal(exe.readUInt16LE(ds+offset+14),112);assert.equal(exe[ds+offset+16],rows);assert.equal(exe[ds+offset+17],17);
    const title=exe.readUInt16LE(ds+offset+22);assert.equal(exe.subarray(ds+title,exe.indexOf(0,ds+title)).toString(),g.title);
    let node=exe.readUInt16LE(ds+offset+18);const codes:number[]=[],labels:string[]=[];
    while(node&&codes.length<count+1){
      codes.push(exe.readUInt16LE(ds+node+4));const text=exe.readUInt16LE(ds+node);
      if(text)labels.push(exe.subarray(ds+text,exe.indexOf(0,ds+text)).toString());
      node=exe.readUInt16LE(ds+node+6);
    }
    assert.equal(node,0);assert.deepEqual(codes,kind==='plant'?Array.from({length:16},(_,i)=>832+i):SPRAY_TOOLS.map(t=>t.tile));
    // Source DS label `Fertilize` is shown natively as `Fertilizer` (user request); the other labels are unchanged.
    if(kind==='spray')assert.deepEqual(labels,SPRAY_TOOLS.map(t=>t.kind==='fertilizer'?'Fertilize':t.label));
  }
  // Original palette IDs22/23 dispatch to the two popup branches.
  assert.deepEqual([21,22].map(i=>0x1f950+exe.readUInt16LE(0x22352+i*2)),[0x21eec,0x21fa6]);
  // Plant selection requests an8×8 cursor and routes to create-field, not a guessed replant.
  assert.equal(exe.subarray(0x3835d,0x38360).toString('hex'),'b80800');
  assert.equal(exe.subarray(0x38386,0x3838d).toString('hex'),'26c7068a01feff');
  assert.equal(exe.subarray(0x22571,0x22576).toString('hex'),'9a30085719');
  assert.equal(exe.subarray(0x23eae,0x23eb3).toString('hex'),'9a0e2c751d');
  // Treatment field lookup is1957:01b8/file1b928; canonical treatment rules stay separate.
  assert.equal(exe.subarray(0x26c75,0x26c7a).toString('hex'),'9ab8015719');
});
