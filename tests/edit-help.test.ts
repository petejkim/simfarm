import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {readEditHelp,EDIT_HELP_LABELS} from '../src/formats/edit-help';
const source=(name:string)=>readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url));
const exe=source('SIMFARM.EXE'),archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const bytes=archive.find(e=>e.name==='edithelp.bmp')!.bytes,palette=readPalette(archive.find(e=>e.name==='simfarm.pal')!.bytes);
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('Edit help palette ID30 loads edithelp.bmp and paints at Edit+48,+16 before waiting for release',()=>{
  expect(0x1f950+exe.readUInt16LE(0x22352+29*2)).toBe(0x2228e);
  expect(hash(exe.subarray(0x2228e,0x22344))).toBe('00373787bcd8265137f29796845b077ab31fc6d42afd95e9b7dc6a7bb18d938d');
  expect(exe.subarray(0x846f0+0x5729,0x846f0+0x5736).toString()).toBe('edithelp.bmp\0');
  expect(exe.subarray(0x222ad,0x222b5).toString('hex')).toBe('6829579a920fe624');
  expect(exe.subarray(0x222cf,0x222e4).toString('hex')).toBe('268b470605100050268b4704053000509a49081604');
  expect(exe.subarray(0x222f0,0x222f8).toString('hex')).toBe('26f60621170175f4');
});

test('caption-free help preserves every border and leader pixel and never writes the source bitmap',()=>{
  const before=Uint8Array.from(bytes),original=readBitmap(bytes,palette),art=readEditHelp(bytes,palette);
  expect(hash(bytes)).toBe('3316d1a47b2def6d5840111d68cc251ccea7d179084010b1fb635f64b582e2b5');
  expect([art.width,art.height]).toEqual([88,200]);
  for(let y=0;y<200;y++)for(let x=0;x<88;x++){
    const p=(y*88+x)*4;expect([...art.rgba.subarray(p,p+4)]).toEqual(x>=19&&x<87&&y>=2&&y<198?[...palette[12],255]:[...original.rgba.subarray(p,p+4)]);
  }
  expect(bytes).toEqual(before);expect(EDIT_HELP_LABELS.length).toBe(15);
  for(const [text,y] of EDIT_HELP_LABELS){expect(text.length).toBeLessThanOrEqual(15);expect(y).toBeLessThan(192);}
});

test('help reader rejects truncated, oversized and wrong-dimension bitmaps',()=>{
  for(let n=0;n<bytes.length;n++)expect(()=>readEditHelp(bytes.subarray(0,n),palette)).toThrow();
  expect(()=>readEditHelp(new Uint8Array(bytes.length+1),palette)).toThrow();
  const wrong=Uint8Array.from(bytes);wrong[0]=10;expect(()=>readEditHelp(wrong,palette)).toThrow();
  const validOther=Uint8Array.from(bytes);validOther[0]=22;validOther[2]=100;expect(()=>readEditHelp(validOther,palette)).toThrow('Invalid edit-help dimensions');
});
