import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {readScenario,worldIndex} from '../src/formats/scenario';
import {MAP_MODES,MAP_TEXT_MASKS,readMapArtwork,readMapMiniature,type MapMode} from '../src/formats/map-window';
import {overviewTiles,renderOverview,renderOverviewLegend} from '../src/render/overview-map';
const source=(s:string)=>readFileSync(new URL('../../simfarm-dos/'+s,import.meta.url));
const exe=source('SIMFARM.EXE'),archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(s:string)=>archive.find(a=>a.name===s)!.bytes,palette=readPalette(asset('simfarm.pal')),atlas=readMapMiniature(asset('far_mapc.mbm'),palette);

test('Map descriptor, controls, labels and original caption masks are pinned to supplied bytes',()=>{
  assert.equal(createHash('sha256').update(exe).digest('hex'),'8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,p=ds+0x68ce;assert.deepEqual([4,6,8,10,12,14,16,18].map(n=>exe.readUInt16LE(p+n)),[80,64,288,256,72,16,192,192]);
  assert.deepEqual(MAP_MODES,Array.from({length:9},(_,i)=>exe.subarray(0x50359+i*20,0x50359+(i+1)*20).toString('latin1').split('\0')[0]));
  let node=exe.readUInt16LE(p+48);const buttons=[];
  while(node&&buttons.length<12){buttons.push([10,2,4,6,8].map(i=>exe.readUInt16LE(ds+node+i)));node=exe.readUInt16LE(ds+node+18);}
  assert.equal(node,0);assert.deepEqual(buttons,[[1,10,19,28,29],[6,40,19,28,29],[2,10,49,28,29],[7,40,49,28,29],[3,10,79,28,29],[8,40,79,28,29],[4,10,109,28,29],[5,40,109,28,29],[12,25,139,28,28],[10,160,218,48,24],[11,224,218,48,24]]);
  assert.deepEqual(Array.from({length:9},(_,i)=>0x34070+exe.readUInt16LE(0x34822+i*2)),[0x34238,0x3426a,0x34386,0x34418,0x344a2,0x3452c,0x345b6,0x34640,0x34722]);
  assert.deepEqual([0,1,2,3].map(i=>exe.readUInt16LE(ds+0x693c+i*2)),[464,495,463,466]);
  const bytes=asset('mapwndo.bmp'),before=Uint8Array.from(bytes),original=readBitmap(bytes,palette),native=readMapArtwork(bytes,palette);
  for(let y=0;y<240;y++)for(let x=0;x<288;x++){
    const p=(y*288+x)*4,r=MAP_TEXT_MASKS.find(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
    assert.deepEqual(native.rgba.subarray(p,p+4),r?Uint8Array.from([...palette[r.color],255]):original.rgba.subarray(p,p+4));
  }
  assert.deepEqual(Uint8Array.from(bytes),before);
  for(const n of [0,7,8,bytes.length-1])assert.throws(()=>readMapArtwork(bytes.subarray(0,n),palette));
  assert.throws(()=>readMapArtwork(asset('sellwndo.bmp'),palette));
});

test('overview pixels use the source packed planes and preserve all eight farms without mutation',()=>{
  const bytes=asset('far_mapc.mbm');
  for(let id=0;id<8;id++){
    const world=readScenario(source(`SCEN${id}.SSM`)),before=JSON.stringify(world),r=renderOverview(world,atlas,palette,0,0,{x:0,y:0});
    for(let x=0;x<96;x++)for(let y=0;y<96;y++)for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
      const tile=world.cells[x*96+y].terrain&2047,row=bytes[tile*2+dy];
      let color=0;for(let plane=0;plane<4;plane++)color|=((row>>(7-plane*2-dx))&1)<<plane;
      const p=((y*2+dy)*192+x*2+dx)*4;assert.deepEqual(r.rgba.subarray(p,p+4),Uint8Array.from([...palette[color],255]));
    }
    for(let mode=1;mode<=8;mode++)assert.equal(renderOverview(world,atlas,palette,mode as MapMode,0,{x:11,y:11}).rgba.length,147456);
    assert.equal(JSON.stringify(world),before);
  }
});

test('source condition maps select raw field bytes, signed water, ownership colors and XOR property selection',()=>{
  const world=readScenario(source('SCEN0.SSM'));world.fields.forEach(f=>f.bytes[7]&=~1);
  const f=world.fields[1];Object.assign(f.bytes,{7:1,10:8,11:8,12:8,13:8,19:248,20:32,21:64,22:96,29:128,32:160});
  for(const c of world.cells){c.terrain=15;c.overlay=0;c.attribute=0;}
  world.cells[worldIndex(8,8)].overlay=0x1000;world.regionalConditions.fill(0);
  const at=worldIndex(8,8);
  for(const [mode,tile] of [[2,484],[3,480],[4,476],[5,468],[6,472],[8,464]]){
    const out=overviewTiles(world,mode as MapMode,0);assert.equal(out[at],tile);assert.equal(out[0],mode===3?495:mode===8?15:464);
  }
  const c=world.cells[at];c.attribute=255;assert.equal(overviewTiles(world,7,-128)[at],594);assert.equal(overviewTiles(world,7,127)[at],849);
  c.terrain|=0x2000;assert.equal(overviewTiles(world,7,-128)[at],495);
  for(const [owner,tile] of [[0,15],[1,495],[2,463],[3,466]]){world.regionalConditions[92]=owner;assert.equal(overviewTiles(world,1,0)[at],tile);}
  world.regionalConditions[92]=1;
  const r=renderOverview(world,atlas,palette,1,0,{x:1,y:1});
  assert.deepEqual(Array.from(r.rgba.subarray((16*192+16)*4,(16*192+16)*4+4)),[...palette[1],255]);
  const sample=atlas.rgba.subarray(((495>>5)*2*64+(495&31)*2)*4,((495>>5)*2*64+(495&31)*2)*4+3);
  const color=palette.findIndex(c=>c.every((v,i)=>v===sample[i]));
  assert.deepEqual(Array.from(r.rgba.subarray((17*192+17)*4,(17*192+17)*4+4)),[...palette[color^15],255]);
  for(const [n,tile] of [[1280,688],[1343,695],[1344,539],[1375,542],[1376,816],[1383,816],[1384,832],[1391,832]]){c.terrain=n;assert.equal(overviewTiles(world,0,0)[at],tile);}
  c.terrain=1392;assert.throws(()=>overviewTiles(world,0,0));c.terrain=2047;assert.throws(()=>overviewTiles(world,0,0));
  assert.throws(()=>overviewTiles(world,9 as MapMode,0));assert.throws(()=>overviewTiles(world,7,-129));assert.throws(()=>renderOverview(world,atlas,palette,1,0,{x:12,y:0}));
});

test('legend retains all32 two-pixel patterns repeated vertically',()=>{
  const r=renderOverviewLegend(atlas);
  for(let i=0;i<32;i++)for(let y=0;y<8;y++){
    const n=464+i,p=(((n>>5)*2+y%2)*64+(n&31)*2)*4;
    assert.deepEqual(r.rgba.subarray((y*64+i*2)*4,(y*64+i*2)*4+8),atlas.rgba.subarray(p,p+8));
  }
  assert.throws(()=>renderOverviewLegend({...atlas,width:63}));
});

test('property highlight XOR preserves duplicate RGB palette identities in every packed miniature pixel',()=>{
  const bytes=asset('far_mapc.mbm');
  for(let n=0;n<960;n++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
    let color=0;for(let plane=0;plane<4;plane++)color|=((bytes[n*2+y]>>(7-plane*2-x))&1)<<plane;
    const p=(((n>>5)*2+y)*64+(n&31)*2+x)*4;
    assert.deepEqual(Array.from(atlas.inverted.rgba.subarray(p,p+4)),[...palette[color^15],255]);
  }
  assert.deepEqual(palette[7],palette[11]);assert.notDeepEqual(palette[7^15],palette[11^15]);
  assert.throws(()=>readMapMiniature(bytes.subarray(0,1919),palette));
});
