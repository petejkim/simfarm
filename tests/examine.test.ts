import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readExamineData,readExamineDataJson,readExamineArtwork,examineItemName,examineTownTile } from '../src/formats/examine';
import { readArchive } from '../src/formats/archive';
import { readBitmap,readPalette } from '../src/formats/graphics';
import { readBuyCatalog } from '../src/formats/buy-window';
import { readScenario,worldIndex } from '../src/formats/scenario';
import { readFinancialState } from '../src/formats/finance';
import { examineObject } from '../src/simulation/examine-object';
import { shopFixture } from './support/livestock';
import { browserCrops } from './support/crop-catalog';
import { cropPlantTile,cropHarvestTile } from '../src/formats/crop-slots';
const source=(s:string)=>readFileSync(new URL('../../simfarm-dos/'+s,import.meta.url)),exe=source('SIMFARM.EXE');
const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(s:string)=>archive.find(e=>e.name===s)!.bytes;
const data=readExamineData(exe),catalog=readBuyCatalog(exe),text=asset('itemtext.dat');
const view=(w:ReturnType<typeof readScenario>|ReturnType<typeof shopFixture>['state']['scenario'],f:ReturnType<typeof readFinancialState>,x:number,y:number)=>examineObject(w,f,browserCrops,catalog,data,text,x,y)!;
test('Examine source routes, text reader, artwork boundaries and town classification are pinned',()=>{
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  assert.deepEqual(readExamineDataJson(data),data);
  assert.equal(data.strings.wreck,'One very very badly damaged aircraft.');assert.equal(data.strings.empty,'Empty Storage Spot');
  for(const [p,hex] of [[0x38b9b,'9ab8015719'],[0x38ca5,'68b86a'],[0x38b6d,'b8d000'],[0x38fbb,'8bf8'],[0x38fd4,'c0e802'],[0x39124,'9a880fe624'],[0x394da,'9a48013412'],[0x48027,'8b4606c1e007'],[0x398e9,'e95c01'],[0x39a48,'2bc0']] as const)
    assert.equal(exe.subarray(p,p+hex.length/2).toString('hex'),hex);
  assert.equal(examineItemName(text,40),'Tractor');assert.equal(examineItemName(text,6),'Small Silo');
  for(const tile of [254,279,294,319,0,217])assert.equal(examineTownTile(tile),false);
  for(let row=6;row<11;row++)for(let col=0;col<40;col++)assert.equal(examineTownTile(row*40+col),row<8?col<12:col<30);
  const bmp=asset('examine.bmp'),palette=readPalette(asset('simfarm.pal'));
  assert.deepEqual(readExamineArtwork(bmp,palette),readBitmap(bmp,palette));
  for(const size of [0,7,8,bmp.length-1])assert.throws(()=>readExamineArtwork(bmp.subarray(0,size),palette));
  const wrong=Uint8Array.from(bmp);wrong[0]=28;assert.throws(()=>readExamineArtwork(wrong,palette));
  for(const bad of [null,{}, {...data,tileCounts:[]},{...data,strings:{}}])assert.throws(()=>readExamineDataJson(bad));
  assert.throws(()=>readExamineData(exe.subarray(0,0x846f0+0x6c75)));
  for(const n of [-1,1.5,148])assert.throws(()=>examineItemName(text,n));
});
test('Examine dispatch preserves precedence, interior contents, condition/quotes and all24 crop identities',()=>{
  const f=shopFixture(),g=f.load().withAllCrops(browserCrops),w=g.getSnapshot().scenario,fin=g.getSnapshot().finances;
  const cell=w.cells[worldIndex(40,40)],b=w.buildings[1],d=w.buildingDefinitions[3];
  b.bytes[0]=67;b.bytes[1]=0;b.flags=32;b.bytes[4]=40;b.bytes[5]=40;b.bytes[6]=255;
  for(let i=0;i<12;i++)b.setContent(i,217,-1,0);b.setContent(0,848,0,1);
  const e=w.equipment[1];e.bytes.fill(0);e.flags=32;e.bytes[5]=40;e.bytes[6]=40;e.bytes[17]=128;
  let p=view(w,fin,40,40);assert.equal(p.kind,'building');assert.equal(p.damage,63);assert.equal(p.tiles.length,d.width*d.height);assert.deepEqual(p.tiles[0],{tile:848,x:24,y:116});
  b.flags|=1;p=view(w,fin,40,40);assert.equal(p.kind,'equipment');assert.equal(p.quality,1);assert.equal(p.value,w.equipmentDefinitions[0].price>>>2);
  w.equipmentDefinitions[0].bytes[6]=255;w.equipmentDefinitions[0].bytes[7]=255;e.bytes[17]=0;assert.equal(view(w,fin,40,40).value,-1);
  e.flags=0;const a=w.animals[1];a.bytes.fill(0);a.flags=33;a.bytes[0]=40;a.bytes[1]=40;a.bytes[6]=161;a.bytes[8]=192;
  p=view(w,fin,40,40);assert.equal(p.kind,'animal');assert.equal(p.card,fin.accounts.assets.animalDefinitions[1].bytes[11]+1);assert.equal(p.quality,3);
  a.flags=0;const c=w.chemicals[1];c.bytes.fill(0);c.bytes[0]=220;c.bytes[2]=32;c.bytes[5]=40;c.bytes[6]=40;
  for(let age=0;age<256;age++){c.bytes[9]=age;p=view(w,fin,40,40);assert.equal(p.kind,'chemical');assert.equal(p.quality,3-(age>>>6));assert.equal(p.value,w.chemicalDefinitions[0].price);}
  c.bytes[2]=0;b.flags=0;
  for(const tile of [73,74,113,114]){cell.terrain=tile;assert.equal(view(w,fin,40,40).card,41);}
  for(let tile=83;tile<=86;tile++){cell.terrain=tile;assert.equal(view(w,fin,40,40).card,50);}
  cell.terrain=15;cell.overlay|=0x4000;assert.equal(view(w,fin,40,40).text,data.strings.town);cell.overlay=0x800;
  assert.equal(view(w,fin,fin.homestead.x+1,fin.homestead.y+3).card,67);
  for(let slot=0;slot<24;slot++)for(const tile of [cropPlantTile(slot),cropHarvestTile(slot)]){cell.terrain=tile;assert.equal(view(w,fin,40,40).text,browserCrops.find(c=>`${c.id}.crp`===w.cropFiles[slot])!.description);}
  cell.terrain=217;assert.equal(view(w,fin,40,40).text,data.strings.empty);
  cell.terrain=320;assert.equal(view(w,fin,40,40).text,data.strings.townBuilding);
  cell.terrain=0x800+15;cell.overlay=217;assert.equal(view(w,fin,40,40).text,data.strings.empty);
  cell.terrain=2047;assert.equal(view(w,fin,40,40).text,data.strings.unknown);
  assert.equal(examineObject(w,fin,browserCrops,catalog,data,text,96,0),null);
});
test('every tile on all eight original farms can be examined without changing records or finances',()=>{
  for(let farm=0;farm<8;farm++){
    const bytes=source(`SCEN${farm}.SSM`),world=readScenario(bytes),fin=readFinancialState(bytes),before=JSON.stringify([world,fin]);
    for(let x=0;x<96;x++)for(let y=0;y<96;y++){
      const p=view(world,fin,x,y);assert.ok(p);assert.ok(Number.isInteger(p.card));assert.equal(typeof p.text,'string');
    }
    assert.equal(JSON.stringify([world,fin]),before);
  }
});
