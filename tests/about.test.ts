import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {ABOUT_INTRO,ABOUT_TEXT_MASKS,readAboutArtwork,readAboutLogo,readAboutCredits} from '../src/formats/about';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('About descriptor and credits match the supplied executable and members',()=>{
  const exe=source('SIMFARM.EXE'),ds=0x846f0;
  expect(hash(exe)).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(ds+0xa452+i*2))).toEqual([0x1061,0,96,96,400,240]);
  expect(exe.subarray(ds+0xa3dd,ds+0xa43e).toString().split('\0').slice(0,-1)).toEqual([...ABOUT_INTRO]);
  expect(exe.subarray(0x3e026,0x3e02a).toString('hex')).toBe('837edc0c');
  expect(hash(asset('about.bmp'))).toBe('abdb074afbf560d99f0452387a87b7edf7a31f40e87eeeefb89899169919f805');
  expect(hash(asset('lzrdlogo.bmp'))).toBe('99552faeaf5bd38a1592b62081554881870d16f9578d03cf70aa65fce4a44c98');
  expect(hash(asset('creditz.txt'))).toBe('36855786d3cb12c28a17175cabff93dd983ffa2e42c51438de50163a82b67e6d');
  const pages=readAboutCredits(asset('creditz.txt'));
  expect(pages[0][3]).toBe('      Producer and');
  expect(pages.flat().join('\n')).toContain('       Sue Kasper');
  expect(pages.flat().join('\n')).toContain('      The Fat Man');
  expect(pages.every(p=>p.length<=12)).toBe(true);
  for(const b of [new Uint8Array(),new TextEncoder().encode('unterminated'),new TextEncoder().encode('x'.repeat(80)+'\n`'),new Uint8Array([0,96])])expect(()=>readAboutCredits(b)).toThrow();
});

test('About removes only specified lettering regions and preserves all other artwork',()=>{
  for(const [name,decode,masks] of [
    ['about.bmp',readAboutArtwork,ABOUT_TEXT_MASKS],
    ['lzrdlogo.bmp',readAboutLogo,[{x:0,y:90,width:104,height:22,color:12}]],
  ] as const){
    const bytes=asset(name),before=hash(bytes),raw=readBitmap(bytes,palette),clean=decode(bytes,palette);
    const expected=raw.rgba.slice();
    for(const m of masks)for(let y=m.y;y<m.y+m.height;y++)for(let x=m.x;x<m.x+m.width;x++)expected.set([...palette[m.color],255],(y*raw.width+x)*4);
    expect(clean.rgba).toEqual(expected);expect(hash(bytes)).toBe(before);
    for(const length of [0,7,bytes.length-1])expect(()=>decode(bytes.subarray(0,length),palette)).toThrow();
    expect(()=>decode(asset('weather.bmp'),palette)).toThrow();
  }
});
