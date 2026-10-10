import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {readTownChoiceArtwork,townChoicePressedArtwork} from '../src/formats/town-choice';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('town chooser direct draw, inclusive picture hitboxes, click samples and bevel painter are source-pinned',()=>{
  expect(hash(exe.subarray(0x3c04e,0x3c3a7))).toBe('2d2dfc927c22f13e45efb4386c5edbaa2a3400a59b9c47babbbacb46ff341e2c');
  expect(hash(exe.subarray(0x338ee,0x33aa5))).toBe('b8bf106d379957a6595f2510e2b4c278e72188c98134969058eb20df4f99e7d8');
  const ds=0x846f0;
  expect(exe.subarray(ds+0x9ddc,ds+0x9de9).toString()).toBe('twnchoic.bmp\0');
  for(const p of [0x9de9,0x9df3,0x9dfd,0x9e07])expect(exe.subarray(ds+p,ds+p+10).toString()).toBe('click.voc\0');
  for(const [a,v] of [[0x3c125,112],[0x3c12d,184],[0x3c197,200],[0x3c1a0,272],[0x3c21b,288],[0x3c224,360],[0x3c287,376],[0x3c293,448]]){
    expect(a===0x3c125?exe[a]:exe.readUInt16LE(a)).toBe(v);
  }
});

test('town artwork masks every caption pixel, retains all other pixels, and rejects truncated or wrong-sized bitmaps',()=>{
  const bytes=asset('twnchoic.bmp'),raw=readBitmap(bytes,palette),r=readTownChoiceArtwork(bytes,palette);
  expect(bytes.length).toBe(41224);expect(hash(bytes)).toBe('20923a8dba2ad4624c12335e48512a3450214d7b86083d4ca9bf2fc857187e86');
  for(let y=0;y<224;y++)for(let x=0;x<368;x++){
    const i=(y*368+x)*4,p=Array.from(raw.rgba.subarray(i,i+4));
    const caption=(x>=8&&x<360&&y>=104&&y<120)||(x>=68&&x<300&&y>=132&&y<204);
    expect(Array.from(r.rgba.subarray(i,i+4))).toEqual(caption&&p.slice(0,3).every(n=>n===0)?[...palette[12],255]:p);
    if(caption)expect(Array.from(r.rgba.subarray(i,i+3))).not.toEqual([0,0,0]);
  }
  expect(Array.from(PNG.sync.read(readFileSync('public/assets/town-choice.png')).data)).toEqual(Array.from(r.rgba));
  for(let n=0;n<bytes.length;n++)expect(()=>readTownChoiceArtwork(bytes.subarray(0,n),palette)).toThrow();
  expect(()=>readTownChoiceArtwork(asset('cashflow.bmp'),palette)).toThrow('Invalid town choice artwork');
});

test('pressed overlay reverses only the two original bevel lines and leaves the picture transparent',()=>{
  const r=townChoicePressedArtwork(palette);
  for(let y=0;y<73;y++)for(let x=0;x<73;x++){
    const dark=(y===1&&x>=1&&x<=70)||(y===2&&x>=1&&x<=69)||(x===1&&y>=1&&y<=70)||(x===2&&y>=1&&y<=69);
    const light=(y===71&&x>=2&&x<=71)||(y===70&&x>=3&&x<=71)||(x===71&&y>=2&&y<=71)||(x===70&&y>=3&&y<=71);
    expect(Array.from(r.rgba.subarray((y*73+x)*4,(y*73+x+1)*4))).toEqual(light?[...palette[15],255]:dark?[...palette[13],255]:[0,0,0,0]);
  }
  expect(Array.from(PNG.sync.read(readFileSync('public/assets/town-choice-pressed.png')).data)).toEqual(Array.from(r.rgba));
});
