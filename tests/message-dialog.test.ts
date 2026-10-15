import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readBitmap,readPalette,decodePlanar } from '../src/formats/graphics';
import { readBulldozeMessage,readMessageButton,MESSAGE_BUTTON_FACE as F } from '../src/formats/message-dialog';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>archive.find(a=>a.name===n)!.bytes;

test('Bulldoze enters mode15, bypasses primary gate/valve interception, skips repeated cells and stops outside or on release',()=>{
  const exe=source('SIMFARM.EXE'),exact=(o:number,h:string)=>assert.equal(exe.subarray(o,o+h.length/2).toString('hex'),h);
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.equal(0x1f950+exe.readUInt16LE(0x22352),0x215ea);exact(0x21667,'26c747020f00');
  assert.equal(0x1f950+exe.readUInt16LE(0x20d9c+14*2),0x20cf2);exact(0x20d11,'9a5c033c23');
  exact(0x255e6,'26837f020f750b837e0e057505b80100c9cb');
  exact(0x25929,'b8ffff8946f08946ec');exact(0x259a8,'3b46f075083b4eec7503e9cf0b');
  exact(0x2657e,'2680262117fe');exact(0x26588,'26f6062117017403e9a3f3');
});

test('original popup caller geometry, event text, portrait and YES/CANCEL button IDs are source backed',()=>{
  const exe=source('SIMFARM.EXE'),exact=(o:number,h:string)=>assert.equal(exe.subarray(o,o+h.length/2).toString('hex'),h);
  exact(0x25a42,'6a2e');exact(0x25b48,'6a2f');
  exact(0x25a50,'6a006a0068960068c0006a046a0b6a4a689f2d68e4c39af4103606');
  exact(0x25b56,'6a006a0068960068c0006a046a0b6a4a689f2d68e4c39af4103606');
  exact(0x9752,'b80001');exact(0x9761,'b8c000'); //256×192
  exact(0x9a7b,'6a406a70');exact(0x9a82,'051800');exact(0x9a89,'054800'); //112×64 at72,24
  exact(0x9c40,'6a186a30689c00');exact(0x9493,'69c04002'); //48×24 at y156;576-byte stride
  const events=asset('events.dat');assert.equal(createHash('sha256').update(events).digest('hex'),'616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb');
  assert.equal(readBulldozeMessage(events,'building'),'Are you sure you want to destroy this structure?');
  assert.equal(readBulldozeMessage(events,'field'),'Are you sure you want to destroy this field?');
  assert.throws(()=>readBulldozeMessage(events.subarray(0,47*256-1),'building'),/Truncated/);
  assert.throws(()=>readBulldozeMessage(events.subarray(0,48*256-1),'field'),/Truncated/);
  assert.equal(exe.subarray(0x846f0+0x5a1a,0x846f0+0x5a1a+64).toString(),'You cannot bulldoze a field while equipment is operating in it.\0');
  const p=readPalette(asset('simfarm.pal')),popup=readBitmap(asset('popup.bmp'),p);assert.equal(popup.width,256);assert.equal(popup.height,192);
});

test('message button preserves the original frame and removes all bitmap caption pixels',()=>{
  const p=readPalette(asset('simfarm.pal')),bytes=asset('buttons.til'),r=readMessageButton(bytes,p);
  const original=decodePlanar(bytes.subarray(0,576),48,24,p);assert.deepEqual([r.width,r.height],[48,24]);
  for(let y=0;y<24;y++)for(let x=0;x<48;x++){
    const offset=(y*48+x)*4;assert.deepEqual([...r.rgba.subarray(offset,offset+4)],x>=F.x&&x<F.x+F.width&&y>=F.y&&y<F.y+F.height?[...p[12],255]:[...original.rgba.subarray(offset,offset+4)]);
  }
  for(const index of [3,10,11]){
    const frame=decodePlanar(bytes.subarray(index*576,(index+1)*576),48,24,p);
    for(let y=0;y<24;y++)for(let x=0;x<48;x++)if(x<F.x||x>=F.x+F.width||y<F.y||y>=F.y+F.height){const o=(y*48+x)*4;assert.deepEqual(frame.rgba.subarray(o,o+4),original.rgba.subarray(o,o+4));}
  }
  assert.throws(()=>readMessageButton(bytes.subarray(1),p),/atlas/);
});

test('terminal default uses the original Message geometry, portrait74, YES/NO and distinct restart/exit main states',()=>{
  const exe=source('SIMFARM.EXE'),hash=(a:number,b:number)=>createHash('sha256').update(exe.subarray(a,b)).digest('hex');
  assert.equal(hash(0x1db42,0x1db7f),'12e1bf7c3e80d57069f76a0d46f2dd753d0ac8e0c43f6a2fbc190ebf09be8126');
  assert.equal(hash(0x2694,0x26c0),'c6ff3dc8b6059604c13e709d777062de5f552ae492a637e1990b454d6e6351f4');
  assert.equal(exe.subarray(0x1db42,0x1db5b).toString('hex'),'6a016a0068960068c0006a0c6a0b6a4a1e68fa3e9af4103606');
  assert.equal(exe.subarray(0x846f0+0x3efa,0x846f0+0x3efa+100).toString().split('\0')[0],
    'You have had to sell your homestead to pay your debts.  Would you like to start a new game?');
  assert.equal(exe.subarray(0x1db69,0x1db6f).toString('hex'),'26c606940102');
  assert.equal(exe.subarray(0x1db76,0x1db7c).toString('hex'),'26c606940101');
});
