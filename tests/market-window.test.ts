import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {readMarketArtwork,MARKET_TEXT_MASKS} from '../src/formats/market-window';
import {marketBarTop,marketWindowView} from '../src/simulation/market-view';
import {townWindowAt,TOWN_WINDOW_BASES} from '../src/simulation/town-window';
import {readScenario,worldIndex} from '../src/formats/scenario';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url)),exe=source('SIMFARM.EXE');
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>entries.find(e=>e.name===n)!.bytes;
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('Market descriptor, chart, functional controls and town-window routes are pinned to original bytes',()=>{
  assert.equal(hash(exe),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,p=ds+0xbbfa;assert.deepEqual([4,6,8,10].map(i=>exe.readUInt16LE(p+i)),[144,112,320,224]);
  assert.equal(exe.subarray(ds+0xbac2,ds+0xbadb).toString(),'MARKET VALUE\0futures.bmp\0');
  let node=exe.readUInt16LE(p+48);const controls=[];
  while(node&&controls.length<14){controls.push([10,2,4,6,8].map(i=>exe.readUInt16LE(ds+node+i)));node=exe.readUInt16LE(ds+node+18);}
  assert.equal(node,0);assert.equal(controls.length,13);assert.deepEqual(controls[0],[1,258,189,48,24]);assert.deepEqual(controls[5],[6,176,24,127,127]);
  // The actual button dispatcher handles only1 and6; the other nodes are inert.
  assert.equal(exe.subarray(0x4adec,0x4adfc).toString('hex'),'487503e9e2fe2d05007503e940ffc9cb');
  for(const [a,z,h] of [[0x4a640,0x4a750,'c4b7a8f064611a367cd75608a8456f18fb09d48574ffe9fd1076d85b42b2d1cf'],[0x4a750,0x4ac76,'a45ccf8bc07feecb293a33905bdc0524f6ea6b64e90749d5b7843f3153795a5b'],[0x4acaa,0x4adfc,'2dcb97adcc5e0edf9a731913103eae878739796677346a294eb882769ce24180'],[0x9536,0x95ce,'8f15cccf7f75ba54596edcff6e30bc4a9deff337a8da3100307710c3dc4fff8b'],[0x25748,0x2591b,'306b84a27dca800c69ef680bf9df21cdd8c72ae0853479fd1a7210c1608fbea3']]as const)assert.equal(hash(exe.subarray(a,z)),h);
  assert.deepEqual(TOWN_WINDOW_BASES,Array.from({length:9},(_,i)=>exe.readUInt16LE(ds+0x9484+i*2)));
});
test('Market artwork removes bitmap lettering only and validates byte lengths and dimensions',()=>{
  const b=asset('futures.bmp'),palette=readPalette(asset('simfarm.pal')),before=Uint8Array.from(b),original=readBitmap(b,palette),live=readMarketArtwork(b,palette);
  assert.equal(hash(b),'bcdbf865f2c33c75024583ff9e80b6fb48c8e3689c72cd16a3fbb6dd90c4c01a');
  for(let y=0;y<208;y++)for(let x=0;x<320;x++){
    const p=(y*320+x)*4,mask=MARKET_TEXT_MASKS.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    assert.deepEqual(live.rgba.subarray(p,p+4),mask?Uint8Array.from([...palette[12],255]):original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(b),before);
  for(const n of [0,7,8,16644,b.length-1])assert.throws(()=>readMarketArtwork(b.subarray(0,n),palette));
  const wrong=Uint8Array.from(b);wrong[0]=20;wrong[2]=160;wrong[3]=1;assert.throws(()=>readMarketArtwork(wrong,palette));
});
// Independent direct word-register calculation of4a640 at original descriptor y112.
function sourceTop(price:number,base:number){const divisor=(base>>>3)||1;let ax=price>base?Math.floor((price-base)/divisor)+16:16-Math.floor((base-price)/divisor);ax=((ax&65535)<<2)&65535;let y=(287-ax)&65535;if(y<148)y=150;if(y>286)y=284;return y-128;}
test('market chart agrees with all supplied ordinary price ranges; extreme clipping and source quote widths are explicit',()=>{
  for(const crop of browserCrops){const b=crop.rawDefinition,base=b[34]|b[35]<<8;
    for(let price=0;price<=base*2;price++)assert.equal(marketBarTop(price,base),sourceTop(price,base));
  }
  assert.equal(sourceTop(65535,1),103);assert.equal(marketBarTop(65535,1),22);
  for(const base of [0,1,7,8,255,32768,65535])for(let price=0;price<=65535;price++)assert.ok(marketBarTop(price,base)>=20&&marketBarTop(price,base)<=158);
  for(const invalid of [-1,65536,.5,NaN,Infinity]){assert.throws(()=>marketBarTop(invalid,1));assert.throws(()=>marketBarTop(1,invalid));}
  const game=new GameSimulation(readScenario(source('SCEN4.SSM')),browserCrops).withAllCrops(browserCrops),s=game.getSnapshot();
  s.scenario.cropDefinitions[0].price=65535;s.scenario.cropDefinitions[0].count=65535;s.market.history[0].fill(null,0,29);
  const crop=browserCrops.find(c=>`${c.id}.crp`===s.scenario.cropFiles[0])!,view=marketWindowView(s.scenario,s.market,browserCrops,0);
  assert.equal(view.price,(6553*(crop.rawDefinition[32]|crop.rawDefinition[33]<<8))&65535);assert.equal(view.futuresOwned,-1);
  assert.deepEqual(view.history.slice(0,29),Array.from({length:29},()=>({price:null,top:null})));
});
test('all24 crops across all farms project without mutation; town entry covers every image and ignores map flags',()=>{
  for(let id=0;id<8;id++){
    const game=new GameSimulation(readScenario(source(`SCEN${id}.SSM`)),browserCrops).withAllCrops(browserCrops),s=game.getSnapshot(),before=game.save(id),snapshotBefore=JSON.stringify(s);
    for(let slot=0;slot<24;slot++){const view=marketWindowView(s.scenario,s.market,browserCrops,slot);assert.equal(view.history.length,30);assert.ok(view.name);}
    assert.equal(JSON.stringify(s),snapshotBefore);assert.equal(game.save(id),before);
    for(const slot of [-1,24,1.1,NaN])assert.throws(()=>marketWindowView(s.scenario,s.market,browserCrops,slot));
  }
  const w=readScenario(source('SCEN4.SSM')),expected=new Map<number,string>();
  ['market','sell','bank','buy','expert'].forEach((key,i)=>{for(let dx=0;dx<3;dx++)for(let dy=0;dy<3;dy++)expected.set(320+i*3+dx+dy*40,key);});
  for(let tile=0;tile<2048;tile++)for(const flags of [0,0x0800,0x4000,0xf800]){w.cells[worldIndex(95,95)].terrain=tile|flags;assert.equal(townWindowAt(w,95,95),expected.get(tile)??null);}
  for(const [x,y]of[[-1,0],[0,96],[1.5,1],[NaN,0]])assert.equal(townWindowAt(w,x,y),null);
});
