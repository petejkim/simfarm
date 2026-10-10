import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readArchive } from '../src/formats/archive';
import { readBitmap, readPalette, decodePlanar } from '../src/formats/graphics';
import { readBuyArtwork, readBuyCards, readBuyCatalog, readBuyCatalogData, readItemText, BUY_TEXT_MASKS } from '../src/formats/buy-window';
import { readScenario } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { readCrop } from '../src/formats/crop';
import { shopProduct } from '../src/simulation/shop-product';
const source = (name:string) => readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url));
const exe=source('SIMFARM.EXE'), entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(name:string)=>entries.find(e=>e.name===name)!.bytes;
const palette=readPalette(asset('simfarm.pal'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('Buy catalog and controls match source category dispatch, ordering, wrapping and card/text loaders',()=>{
  assert.equal(hash(exe),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const catalog=readBuyCatalog(exe); assert.deepEqual(readBuyCatalogData(catalog),catalog);
  assert.deepEqual(catalog.groups.machinery,[0,1,2,3,4,5,7,8]); assert.deepEqual(catalog.groups.livestock,[161,162,163,160]);
  const ds=0x846f0,window=ds+0xb4a6;
  assert.deepEqual([4,6,8,10].map(i=>exe.readUInt16LE(window+i)),[128,96,256,240]);
  let p=exe.readUInt16LE(window+0x30); const buttons=[];
  while(p && buttons.length<16){const b=ds+p;buttons.push([exe.readUInt16LE(b+10),...Array.from({length:4},(_,i)=>exe.readUInt16LE(b+2+i*2))]);p=exe.readUInt16LE(b+18);}
  assert.equal(p,0);assert.deepEqual(buttons,[[5,207,88,28,28],[6,176,88,28,28],[9,168,200,32,24],[10,200,200,48,24],[12,10,22,28,28],[13,10,52,28,28],[14,10,82,28,28],[15,10,112,28,28],[16,10,142,28,28]]);
  assert.deepEqual(Array.from({length:12},(_,i)=>0x47860+exe.readUInt16LE(0x47f6c+i*2)),[0x47b82,0x47baa,0x47f84,0x47f84,0x47bc6,0x47ebe,0x47f84,0x47f16,0x47f2c,0x47f38,0x47f44,0x47f50]);
  assert.equal(exe.subarray(0x47fae,0x47fcc).toString('hex'),'a01cb53846067d08a01db5fec8884606a01db53846067c06a01cb5884606');
  assert.equal(exe.subarray(0x4a21d,0x4a226).toString('hex'),'b8020ef76e0a051400');
  assert.equal(exe.subarray(0x480b9,0x480bf).toString('hex'),'8b4606c1e007');
  assert.equal(readItemText(asset('itemtext.dat'),40),'Tractor\n\n Required for pulling various pieces of machinery.');
  for(const bad of [null,{}, {...catalog,tileBases:[]}, {...catalog,groups:{...catalog.groups,machinery:[6]}}]) assert.throws(()=>readBuyCatalogData(bad));
  assert.throws(()=>readBuyCatalog(exe.subarray(0,ds+0xb51e)));
  for(const index of [-1,1.5,148])assert.throws(()=>readItemText(asset('itemtext.dat'),index));
});

test('original Buy bitmap masks only captions and card atlas uses every bounded source plane',()=>{
  const bytes=asset('buywndo.bmp'), before=Uint8Array.from(bytes), live=readBuyArtwork(bytes,palette), original=readBitmap(bytes,palette);
  assert.equal(live.width,256);assert.equal(live.height,224);
  for(let y=0;y<224;y++)for(let x=0;x<256;x++){
    const p=(y*256+x)*4,masked=BUY_TEXT_MASKS.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    assert.deepEqual(live.rgba.subarray(p,p+4),masked?Uint8Array.from([...palette[12],255]):original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(bytes),before);
  const cards=asset('alltiles.btl'), atlas=readBuyCards(cards,palette);
  assert.equal(atlas.width,896);assert.equal(atlas.height,640);
  for(let i=0;i<80;i++){
    const expected=decodePlanar(cards.subarray(22+i*3586,22+i*3586+3584),112,64,palette);
    for(let y=0;y<64;y++){const p=(((i>>3)*64+y)*896+(i%8)*112)*4;assert.deepEqual(atlas.rgba.subarray(p,p+448),expected.rgba.subarray(y*448,(y+1)*448));}
  }
  for(const size of [0,19,20,cards.length-1])assert.throws(()=>readBuyCards(cards.subarray(0,size),palette));
  for(const size of [0,7,8,bytes.length-1])assert.throws(()=>readBuyArtwork(bytes.subarray(0,size),palette));
  const bad=Uint8Array.from(bytes);bad[4]=0;assert.throws(()=>readBuyArtwork(bad,palette));
  const other=Uint8Array.from(bytes);other[0]=28;other[2]=0;other[3]=1;assert.throws(()=>readBuyArtwork(other,palette),/dimensions/);
  const padded=new Uint8Array(cards.length+6);padded.set(cards,3);assert.deepEqual(readBuyCards(padded.subarray(3,-3),palette),atlas);
});

test('shop presentation reads source definitions on every farm without mutating saved counts or substituting crop identities',()=>{
  const catalog=readBuyCatalog(exe);
  for(let i=0;i<8;i++){
    const bytes=source(`SCEN${i}.SSM`),world=readScenario(bytes),finances=readFinancialState(bytes);
    const crops=world.cropFiles.map(file=>readCrop(file.slice(0,-4),source('CROPS/'+file.toUpperCase())));
    const before=world.equipmentDefinitions.map(d=>Uint8Array.from(d.bytes));
    for(const type of Object.values(catalog.groups).flat()){
      const p=shopProduct(world,finances,crops,catalog,asset('itemtext.dat'),type);
      assert.ok(p.name.length);assert.ok(p.width>0&&p.height>0);assert.ok(p.tile!==null);assert.ok(p.card!==null||p.cropId!==null);
      if(type>=192&&type<208){assert.equal(p.name,crops[type-192].name);assert.equal(p.cropId,crops[type-192].id);assert.equal(p.tile,832+type-192);}
    }
    assert.equal(shopProduct(world,finances,crops,catalog,asset('itemtext.dat'),5).name,'Trailer');
    assert.equal(shopProduct(world,finances,crops,catalog,asset('itemtext.dat'),7).name,'Truck');
    assert.deepEqual(world.equipmentDefinitions.map(d=>Uint8Array.from(d.bytes)),before);
    assert.throws(()=>shopProduct(world,finances,crops,catalog,asset('itemtext.dat'),999));
  }
});
