import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readArchive} from '../src/formats/archive';
import {decodePlanar,readBitmap,readPalette} from '../src/formats/graphics';
import {readMessageButton,MESSAGE_BUTTON_FACE as F} from '../src/formats/message-dialog';
import {EXPERT_CARD_IDS,readExpertPortrait,readExpertCard,readExpertDeck,expertPage,expertText,expertLauncherFace} from '../src/formats/expert-cards';
import {browserCrops} from './support/crop-catalog';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes;
const deck=readExpertDeck(id=>asset(`card${id}.hc`));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
function words(op:number,...values:number[]){return [op,...values.flatMap(n=>[n&255,n>>>8])];}

test('Expert source descriptor, interpreter, crop reader, complete deck and frame are pinned',()=>{
  expect(hash(exe)).toBe('8b86a2d3d07e0b6f77ce491e27e538feeccf5d1af149f42bc0f6a0631c3e58ce');
  const ds=0x846f0,descriptor=ds+0xbe9c;
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(descriptor+i*2))).toEqual([0x61,0,128,96,400,240]);
  expect(exe.subarray(ds+0xbe52,ds+0xbe5d).toString()).toBe('FARM EXPERT');
  expect(exe.subarray(ds+0xbe5e,ds+0xbe6a).toString()).toBe('farmburo.bmp');
  expect(hash(exe.subarray(0x4c820,0x4d2be))).toBe('75e712e963e9f747bb4ad1104daa47111f13eb3a734c6132c1e89a8e50b38490');
  expect(hash(exe.subarray(0x46814,0x468c1))).toBe('5913c8d1db596f5471e3799aa01db9eac76eeb31c109c9e13062592920145922');
  expect(exe.subarray(0x46884,0x46887).toString('hex')).toBe('680016'); // seek0x1600
  expect(exe.subarray(0x46899,0x4689c).toString('hex')).toBe('680001'); // read256
  expect(hash(exe.subarray(0x8932,0x8a4c))).toBe('e756369c3d98fc49476c7b0b15b7765b683fadd1da802bd7f71ebfffd7e9e34a');
  expect(EXPERT_CARD_IDS).toHaveLength(43);
  expect(hash(Buffer.concat(EXPERT_CARD_IDS.map(id=>asset(`card${id}.hc`))))).toBe('52aca80ac8d649e09446a7368ee6360f9d89c109a2bc942a7a521d37c25cfdfc');
  expect(hash(asset('farmburo.bmp'))).toBe('f83003044612a61cf22a6b1cec08f6c2287a32ae1d841cd603bf993f51f4fc6f');
  const expected=readBitmap(asset('farmburo.bmp'),readPalette(asset('simfarm.pal'))),png=PNG.sync.read(readFileSync(new URL('../public/assets/farmburo.bmp.png',import.meta.url)));
  expect([png.width,png.height]).toEqual([400,224]);expect(Array.from(png.data)).toEqual(Array.from(expected.rgba));
});

test('all source pages are reachable through exact original chapter links and bounded controls',()=>{
  const seen=new Set<number>(),queue=[1];
  while(queue.length){const id=queue.shift()!;if(seen.has(id))continue;seen.add(id);
    const page=deck.get(id)!;expect(page).toBeDefined();
    for(const c of page)if('target' in c&&c.target!==255)queue.push(c.target);
  }
  expect([...seen].sort((a,b)=>a-b)).toEqual(EXPERT_CARD_IDS);
  expect(deck.get(1)!.filter(c=>c.kind==='link')).toEqual([
    {kind:'link',x:24,y:32,width:112,height:64,target:2},{kind:'link',x:144,y:32,width:112,height:64,target:10},
    {kind:'link',x:264,y:32,width:112,height:64,target:26},{kind:'link',x:24,y:112,width:112,height:64,target:30},
    {kind:'link',x:144,y:112,width:112,height:64,target:40},{kind:'link',x:264,y:112,width:112,height:64,target:5},
  ]);
  expect(deck.get(2)!.filter(c=>c.kind==='tiles')).toHaveLength(16);
  for(const [id,page] of deck){
    expect(page.filter(c=>c.kind==='sound')).toHaveLength(id<=2?0:1);
    if(id>2)expect(page.find(c=>c.kind==='sound')).toEqual({kind:'sound',x:144,y:24,width:112,height:64,sound:'rooster'});
  }
  expect(deck.get(5)!.find(c=>c.kind==='text'&&c.y===120)).toMatchObject({text:'Cow\nLife: 20 Years\nEats: 1/4 Bales of Feed Each Month\nMates: 15-20 Months\nGestates: 10 Months'});
});

test('Expert decoder rejects every truncated source prefix, trailing bytes and malformed control boundaries',()=>{
  for(const id of EXPERT_CARD_IDS){const b=asset(`card${id}.hc`);for(let n=0;n<b.length;n++)expect(()=>readExpertCard(b.subarray(0,n))).toThrow();}
  const invalid=[new Uint8Array(514),Uint8Array.of(255,0),Uint8Array.of(0x81,255),
    [...words(0x86,80,24,32),255],[...words(0x86,0,300,32),255],[...words(0x89,16,136,120),255],
    [...words(0x83,24,32,23,96,2),255],[...words(0x83,24,32,136,96,3),255],
    [...words(0x84,336,200,0,1),255],[...words(0x8c,64,48,0,1,539),255],[...words(0x8c,64,48,2,1,847),255],
    [...words(0x87,24,32,500),65,0,255],[...words(0x87,24,32,320),65,255],
    [...words(0x8a,144,24,256,88),...Buffer.from('../evil.voc\0'),255],
    ...[17].map(n=>[...Array.from({length:n},()=>words(0x8b,336,200)).flat(),255]),
    [...Array.from({length:5},()=>[...words(0x8a,144,24,256,88),...Buffer.from('rooster.voc\0')]).flat(),255],
  ];
  for(const b of invalid)expect(()=>readExpertCard(Uint8Array.from(b))).toThrow();
  expect(readExpertCard(Uint8Array.of(255))).toEqual([]);
  expect(readExpertCard(Uint8Array.from([...Array.from({length:16},()=>words(0x8b,336,200)).flat(),255]))).toHaveLength(16);
  expect(readExpertCard(Uint8Array.from([...Array.from({length:4},()=>[...words(0x8a,144,24,256,88),...Buffer.from('rooster.voc\0')]).flat(),255]))).toHaveLength(4);
});

test('all24 crop pages use CRP1600 text and pictures, source chapter and padding are preserved',()=>{
  const before=JSON.stringify([...deck]);
  for(let count=16;count<=24;count++){
    let id=10;
    for(let slot=0;slot<count;slot++){
      const page=expertPage(deck,id,count);
      expect(page.find(c=>c.kind==='crop')).toEqual({kind:'crop',slot,x:136,y:120});
      const picture=page.find(c=>c.kind==='picture'&&c.y===120)!;
      expect(picture.kind==='picture'&&(picture.cropSlot??picture.card)).toBe(slot);
      const previous=page.find(c=>c.kind==='button'&&c.caption==='PREV');
      if(slot===0)expect(previous).toBeUndefined();else expect(previous).toMatchObject({target:slot-1<16?slot-1+10:slot-1+48,x:slot===count-1?288:240});
      const next=page.find(c=>c.kind==='button'&&c.caption==='NEXT');
      if(slot===count-1)expect(next).toBeUndefined();else {expect(next).toMatchObject({x:288});id=(next as {target:number}).target;}
    }
  }
  expect(JSON.stringify([...deck])).toBe(before);
  for(const n of [0,15,25,NaN,16.5])expect(()=>expertPage(deck,1,n)).toThrow();
  expect(()=>expertPage(deck,72,24)).toThrow();
  for(const crop of browserCrops){
    const bytes=source(`CROPS/${crop.id.toUpperCase()}.CRP`),raw=bytes.subarray(0x1600,0x1700).toString();
    expect(crop.expertDescription).toBe(expertText(raw));
    expect(crop.expertDescription.split('\n')[0]).toBe(({sunflowe:'Sunflowers',sweet:'Sweet Potatoes'} as Record<string,string>)[crop.id]??crop.name);
    expect(crop.expertDescription).not.toMatch(/[@~\r]/);
    expect(crop.expertDescription).toContain('Replant');
  }
  expect(browserCrops.find(c=>c.id==='corn')!.expertDescription).toStartWith('Corn\nTemperature: 2000 Degree Days\nRain: 6 Days');
  expect(expertText('one@@\r\ntwo~three`four\0ignored')).toBe('one two\nthree four');
});

test('all four Expert button frames share the retained caption-free bevel',()=>{
  const bytes=asset('buttons.til'),palette=readPalette(asset('simfarm.pal')),blank=readMessageButton(bytes,palette);
  for(const frame of [3,13,14,15]){
    const r=decodePlanar(bytes.subarray(frame*576,(frame+1)*576),48,24,palette);
    for(let y=0;y<24;y++)for(let x=0;x<48;x++)if(y<F.y||y>=F.y+F.height||x<F.x||x>=F.x+F.width){const i=(y*48+x)*4;expect(r.rgba.subarray(i,i+4)).toEqual(blank.rgba.subarray(i,i+4));}
  }
});

test('Expert portrait retains every original pixel including the cap logo',()=>{
  const b=asset('alltiles.btl'),palette=readPalette(asset('simfarm.pal')),before=b.slice();
  const source=decodePlanar(b.subarray(22+66*3586,22+66*3586+3584),112,64,palette),actual=readExpertPortrait(b,palette);
  expect(actual.rgba).toEqual(source.rgba);
  expect(b).toEqual(before);
  const png=PNG.sync.read(readFileSync(new URL('../public/assets/expert-portrait.png',import.meta.url)));
  expect(Array.from(png.data)).toEqual(Array.from(actual.rgba));
  for(const length of [0,18,19,b.length-1,b.length+1])expect(()=>readExpertPortrait(new Uint8Array(length),palette)).toThrow();
});

test('the native Expert launcher face is the head square of portrait 66, halved from even pixels, as imported',()=>{
  const portrait=decodePlanar(asset('alltiles.btl').subarray(22+66*3586,22+66*3586+3584),112,64,readPalette(asset('simfarm.pal')));
  const face=expertLauncherFace(portrait);expect([face.width,face.height]).toEqual([26,26]);
  for(let y=0;y<26;y++)for(let x=0;x<26;x++){
    const i=((1+2*y)*112+33+2*x)*4;expect(Array.from(face.rgba.subarray((y*26+x)*4,(y*26+x)*4+4))).toEqual(Array.from(portrait.rgba.subarray(i,i+4)));
  }
  expect(Array.from(PNG.sync.read(readFileSync('public/assets/expert-launcher.png')).data)).toEqual(Array.from(face.rgba));
  expect(()=>expertLauncherFace({width:111,height:64,rgba:new Uint8Array(111*64*4)})).toThrow();
});
