import {test} from 'bun:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readArchive} from '../src/formats/archive';
import {readPalette} from '../src/formats/graphics';
import {SHIPPED_CROP_IDS} from '../src/formats/crop-slots';
import {cropSpriteSheets,cropCardFrame} from '../src/formats/crop-graphics';

const source=(name:string)=>readFileSync(new URL(`../../simfarm-dos/${name}`,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const palette=readPalette(entries.find(e=>e.name==='simfarm.pal')!.bytes);
const crops=new Map(SHIPPED_CROP_IDS.map(id=>[`${id}.crp`,source(`CROPS/${id.toUpperCase()}.CRP`)]));
const hash=()=>createHash('sha256').update(Buffer.concat([...crops.values()])).digest('hex');

test('crop packing preserves every source pixel and exported photos match fixed crop-ID order',()=>{
  const before=hash(),sheets=cropSpriteSheets(crops,palette);
  const imported=PNG.sync.read(readFileSync('public/assets/crop-cards.png'));
  assert.deepEqual([imported.width,imported.height],[sheets.cards.width,sheets.cards.height]);
  assert.deepEqual(Uint8Array.from(imported.data),sheets.cards.rgba);
  assert.equal(existsSync('public/assets/crop-tiles.png'),false); // Growth tiles already live in terrain-tiles.png.
  assert.deepEqual([sheets.tiles.width,sheets.tiles.height],[512,96]);
  assert.deepEqual([sheets.cards.width,sheets.cards.height],[896,192]);
  // Independent bitplane reading pins source boundaries and packing, rather than reproducing the decoder.
  for(const [index,id] of SHIPPED_CROP_IDS.entries()){
    const crop=crops.get(`${id}.crp`)!;
    for(let stage=0;stage<8;stage++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      let color=0;
      for(let plane=0;plane<4;plane++)color|=((crop[stage*128+plane*32+y*2+(x>>3)]>>(7-(x&7)))&1)<<plane;
      const at=((Math.floor(index/4)*16+y)*512+index%4*128+stage*16+x)*4;
      assert.deepEqual(Array.from(sheets.tiles.rgba.subarray(at,at+4)),[...palette[color],255]);
    }
    for(let y=0;y<64;y++)for(let x=0;x<112;x++){
      let color=0;
      for(let plane=0;plane<4;plane++)color|=((crop[0x400+plane*896+y*14+(x>>3)]>>(7-(x&7)))&1)<<plane;
      const at=((Math.floor(index/8)*64+y)*896+index%8*112+x)*4;
      assert.deepEqual(Array.from(sheets.cards.rgba.subarray(at,at+4)),[...palette[color],255]);
    }
    assert.deepEqual(cropCardFrame(id),{x:index%8*112,y:Math.floor(index/8)*64,width:112,height:64});
    assert.equal(existsSync(`public/assets/${id}.png`),false);
    assert.equal(existsSync(`public/assets/${id}.card.png`),false);
    assert.deepEqual(readFileSync(`artifacts/original-assets/crops/${id}.crp`),crop);
  }
  assert.equal(hash(),before);
  const reverse=new Map([...crops].reverse());
  assert.deepEqual(cropSpriteSheets(reverse,palette),sheets); // Filesystem/catalog order cannot move pictures.
});

test('crop sheets reject missing or truncated source files and unknown crop IDs without mutating sources',()=>{
  const before=hash();
  for(const id of ['almonds','corn','wheat']){
    const missing=new Map(crops);missing.delete(`${id}.crp`);assert.throws(()=>cropSpriteSheets(missing,palette),/source/);
    for(const size of [0,0x400,0x1200,5889,5891]){
      const malformed=new Map(crops);malformed.set(`${id}.crp`,Buffer.alloc(size));assert.throws(()=>cropSpriteSheets(malformed,palette),/source/);
    }
  }
  for(const id of ['','corn.crp','CORN','unknown','../corn'])assert.throws(()=>cropCardFrame(id),/Unknown crop/);
  assert.equal(hash(),before);
});
