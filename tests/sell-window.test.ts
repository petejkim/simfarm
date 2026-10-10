import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readPalette, readBitmap, decodePlanar } from '../src/formats/graphics';
import { readSellArtwork, readSellConditions, SELL_TEXT_MASKS, SELL_CONDITION_MASKS } from '../src/formats/sell-window';
import { readBuyCatalog } from '../src/formats/buy-window';
import { sellProducts } from '../src/simulation/sell-products';
import { checkManualAssetSale } from '../src/simulation/manual-asset-sale';
import { readScenario } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { browserCrops } from './support/crop-catalog';
import { shopFixture } from './support/livestock';
import { cropHarvestTile } from '../src/formats/crop-slots';
const source=(name:string)=>readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(name:string)=>entries.find(e=>e.name===name)!.bytes, palette=readPalette(asset('simfarm.pal')),catalog=readBuyCatalog(exe);

test('Sell descriptor, ten controls, callbacks, condition graphics and text masks match source bytes',()=>{
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,p=ds+0xbdbe;assert.deepEqual([4,6,8,10].map(i=>exe.readUInt16LE(p+i)),[128,80,192,272]);
  let node=exe.readUInt16LE(p+48);const buttons=[];
  while(node&&buttons.length<12){buttons.push([10,2,4,6,8].map(i=>exe.readUInt16LE(ds+node+i)));node=exe.readUInt16LE(ds+node+18);}
  assert.equal(node,0);assert.deepEqual(buttons,[[1,16,18,28,28],[2,16,48,28,28],[3,16,78,28,28],[4,16,112,16,16],[5,16,192,16,16],[6,88,232,40,24],[9,128,232,48,24],[10,40,112,128,32],[11,40,144,128,32],[12,40,176,128,32]]);
  assert.deepEqual(Array.from({length:12},(_,i)=>0x4b450+exe.readUInt16LE(0x4c3c4+i*2)),[0x4c1c4,0x4c1d6,0x4c1e4,0x4c1ec,0x4c21a,0x4c286,0x4c3dc,0x4c3dc,0x4c15e,0x4c122,0x4c136,0x4c14a]);
  assert.equal(exe.subarray(0x4c673,0x4c679).toString('hex'),'b81b002b4614');
  const bytes=asset('sellwndo.bmp'), before=Uint8Array.from(bytes), original=readBitmap(bytes,palette), live=readSellArtwork(bytes,palette);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'ecd39bfa55152440e8c0687ecfb55011875fe53990dc826309deb8df2416a48f');
  for(let y=0;y<256;y++)for(let x=0;x<192;x++){
    const p=(y*192+x)*4,mask=SELL_TEXT_MASKS.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    assert.deepEqual(live.rgba.subarray(p,p+4),mask?Uint8Array.from([...palette[12],255]):original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(bytes),before);
  const badges=readSellConditions(asset('ega16til.til'),palette);
  for(let q=0;q<4;q++)for(let t=0;t<4;t++){
    const n=539+4*(27-q)+t,original=decodePlanar(asset('ega16til.til').subarray(n*128,(n+1)*128),16,16,palette);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      const dx=t%2*16+x,dy=Math.floor(t/2)*16+y,p=(dy*128+q*32+dx)*4,mask=SELL_CONDITION_MASKS.some(r=>dx>=r.x&&dx<r.x+r.width&&dy>=r.y&&dy<r.y+r.height);
      assert.deepEqual(badges.rgba.subarray(p,p+4),mask?Uint8Array.from([...palette[12],255]):original.rgba.subarray((y*16+x)*4,(y*16+x+1)*4));
    }
  }
  for(const n of [0,7,8,bytes.length-1])assert.throws(()=>readSellArtwork(bytes.subarray(0,n),palette));
  for(const n of [0,539*128,651*128-1])assert.throws(()=>readSellConditions(asset('ega16til.til').subarray(0,n),palette));
  const wrong=Uint8Array.from(bytes);wrong[0]=16;wrong[2]=128;wrong[3]=1;assert.throws(()=>readSellArtwork(wrong,palette));
});

test('Sell lists preserve original slot order and signed receipts on every farm without changing records',()=>{
  for(let id=0;id<8;id++){
    const bytes=source(`SCEN${id}.SSM`),world=readScenario(bytes),finances=readFinancialState(bytes),before=JSON.stringify([world,finances]);
    for(const kind of ['animal','equipment'] as const){
      const list=sellProducts(world,finances,browserCrops,catalog,asset('itemtext.dat'),kind,2);
      const records=kind==='animal'?world.animals.filter(a=>a.active):world.equipment.filter(e=>e.active&&!(e.flags&64));
      assert.deepEqual(list.map(i=>i.slot),records.map(i=>i.slot));
      for(const item of list){const q=checkManualAssetSale(world,finances,kind,item.slot,2);assert.ok(q.ok);assert.equal(item.value,q.value);assert.ok(item.quality>=0&&item.quality<=3);}
    }
    assert.equal(JSON.stringify([world,finances]),before);
  }
});

test('Sell supports all24 crops and loss bands, excludes rentals and displays busy owned machines without mutation',()=>{
  const game=shopFixture().load().withAllCrops(browserCrops),s=game.getSnapshot();
  for(let crop=0;crop<24;crop++){
    const item=s.scenario.inventory[crop+1];item.bytes[10]|=32;
    const v=new DataView(item.bytes.buffer,item.bytes.byteOffset,item.bytes.byteLength);v.setUint16(0,168+crop,true);v.setUint16(2,300,true);v.setUint16(4,(crop%4)*16384,true);
  }
  const list=sellProducts(s.scenario,s.finances,browserCrops,catalog,asset('itemtext.dat'),'harvest',0);
  assert.equal(list.length,24);
  for(const [i,item] of list.entries()){assert.equal(item.cropId+'.crp',s.scenario.cropFiles[i]);assert.equal(item.tile,cropHarvestTile(i));assert.equal(item.quality,3-i%4);}
  game.dispatch({type:'buy-equipment',equipmentType:0,x:10,y:10});game.dispatch({type:'buy-equipment',equipmentType:0,x:12,y:10});
  const state=game.getSnapshot();state.scenario.equipment[1].flags|=64;state.scenario.equipment[2].flags|=1;
  const before=JSON.stringify(state),owned=sellProducts(state.scenario,state.finances,browserCrops,catalog,asset('itemtext.dat'),'equipment',0);
  assert.deepEqual(owned.map(i=>i.slot),[2]);assert.equal(owned[0].available,false);assert.equal(owned[0].reason,'asset-busy');assert.equal(JSON.stringify(state),before);
});
