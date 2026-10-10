import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readArchive} from '../src/formats/archive';
import {readPalette,readBitmap} from '../src/formats/graphics';
import {AIRCRAFT_CONTROLS,AIRCRAFT_TEXT_MASKS,readAircraftArtwork} from '../src/formats/aircraft-window';
import {aircraftMapEntry,aircraftWindowView} from '../src/simulation/aircraft-view';
import {aircraftFixture} from './support/aircraft';
import {purchaseAircraft,checkAircraftService} from '../src/simulation/aircraft';
import {worldIndex} from '../src/formats/scenario';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
test('Aircraft descriptor, linked controls, gauge arithmetic, quote widths and map entry match source bytes',()=>{
  assert.equal(hash(exe),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,p=ds+0x658c;
  assert.deepEqual([4,6,8,10].map(i=>exe.readUInt16LE(p+i)),[192,160,256,192]);
  assert.equal(exe.subarray(ds+0x64a6,ds+0x64c5).toString(),'AIRPLANE\0airpwndo.bmp\0%u\0%u\0%u\0');
  let node=exe.readUInt16LE(p+48);const buttons=[];
  while(node&&buttons.length<8){buttons.push({id:exe.readUInt16LE(ds+node+10),x:exe.readUInt16LE(ds+node+2),y:exe.readUInt16LE(ds+node+4)-16,width:exe.readUInt16LE(ds+node+6),height:exe.readUInt16LE(ds+node+8)});node=exe.readUInt16LE(ds+node+18);}
  assert.equal(node,0);assert.deepEqual(buttons,AIRCRAFT_CONTROLS);
  for(const [a,z,h] of [[0x30670,0x308b2,'49357293979dcb882e168c691283720e8abe0d4b8364e728bad125e6088d1cc2'],[0x308d4,0x30dc6,'d79669aa95c0df925307de67772ce5b968262dcf45f6fe3a0ce32bb7bbfaa241'],[0x257b0,0x25863,'e451419fe9ccf7a58166081e70217fc745d1d537ddafb59ba6359991746f57cf']] as const)assert.equal(hash(exe.subarray(a,z)),h);
  assert.deepEqual([0x30a0c,0x30a82,0x30ae8].map(p=>exe.readUInt16LE(p)),[221,223,222]);
});
test('Aircraft text removal preserves all other source pixels and rejects malformed dimensions and truncated data',()=>{
  const b=asset('airpwndo.bmp'),palette=readPalette(asset('simfarm.pal')),before=Uint8Array.from(b),original=readBitmap(b,palette),live=readAircraftArtwork(b,palette);
  assert.equal(hash(b),'0704617f6eaf1098f8ccaa2e9286da88a14df4413b436075e25cbca768b99b67');
  for(let y=0;y<176;y++)for(let x=0;x<256;x++){
    const p=(y*256+x)*4,mask=AIRCRAFT_TEXT_MASKS.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    assert.deepEqual(live.rgba.subarray(p,p+4),mask?Uint8Array.from([...palette[12],255]):original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(b),before);
  assert.deepEqual(Uint8Array.from(PNG.sync.read(readFileSync('public/assets/aircraft-window.png')).data),live.rgba);
  for(const n of [0,7,8,11268,b.length-1])assert.throws(()=>readAircraftArtwork(b.subarray(0,n),palette));
  const wrong=Uint8Array.from(b);wrong[0]=16;wrong[2]=96;wrong[3]=1;assert.throws(()=>readAircraftArtwork(wrong,palette));
  assert.throws(()=>readAircraftArtwork(new Uint8Array(b.length+1),palette));
});
test('Aircraft gauges cover all byte boundaries; displayed prices equal canonical charges including values above65535',()=>{
  const f=aircraftFixture(),w=f.state.scenario;assert.ok(purchaseAircraft(w,f.state.finances).ok);const e=w.equipment[1],v=new DataView(e.bytes.buffer,e.bytes.byteOffset,e.bytes.byteLength);
  for(let n=0;n<256;n++){
    v.setUint16(20,n,true);v.setUint16(32,n,true);e.bytes[17]=n;
    const view=aircraftWindowView(w,f.state.aircraftService,e);
    assert.deepEqual(view.gauges,[10+Math.floor(n/52),10+Math.floor(n/52),Math.floor(n/52)]);
    for(const kind of ['fuel','repair','load'] as const){const q=checkAircraftService(w,f.state.finances,f.state.aircraftService,1,{kind});assert.ok(q.ok);assert.equal(view.prices![kind],q.price);}
  }
  v.setUint16(32,0,true);w.chemicalDefinitions[1].price=2580;
  const q=checkAircraftService(w,f.state.finances,f.state.aircraftService,1,{kind:'load'});assert.ok(q.ok);assert.equal(q.price,65790);assert.equal(q.price&65535,254);
  assert.equal(aircraftWindowView(w,f.state.aircraftService,e).prices!.load,q.price);
  v.setUint16(20,256,true);assert.equal(aircraftWindowView(w,f.state.aircraftService,e).gauges,null);assert.equal(aircraftWindowView(w,f.state.aircraftService,e).prices,null);
});
test('parked entry is read-only, tile-gated and first-footprint ordered, including stale graphics and invalid coordinates',()=>{
  const f=aircraftFixture(),w=f.state.scenario;assert.ok(purchaseAircraft(w,f.state.finances).ok);const before=f.load().save(4);
  for(const [x,y] of [[21,22],[22,22],[21,23],[22,23]])assert.deepEqual(aircraftMapEntry(w,x,y),{slot:1});
  for(const [x,y] of [[-1,0],[96,0],[NaN,22],[21.5,22],[20,22],[23,22],[21,24]])assert.equal(aircraftMapEntry(w,x,y),null);
  assert.equal(f.load().save(4),before);
  w.cells[worldIndex(1,1)].terrain=71;assert.deepEqual(aircraftMapEntry(w,1,1),{slot:null});
  for(let tile=0;tile<2048;tile++){w.cells[worldIndex(21,22)].terrain=0x8000|tile;assert.deepEqual(aircraftMapEntry(w,21,22),[71,72,111,112].includes(tile)?{slot:1}:null);}
  w.cells[worldIndex(21,22)].terrain=71;w.equipment[1].bytes[0]=0;
  assert.deepEqual(aircraftMapEntry(w,21,22),{slot:null});
  w.equipment[2].bytes.set(w.equipment[1].bytes);w.equipment[2].bytes[0]=8;
  assert.deepEqual(aircraftMapEntry(w,21,22),{slot:null}); // first active footprint wins, even a different type
  w.equipment[1].flags=0;assert.deepEqual(aircraftMapEntry(w,21,22),{slot:2});
});
