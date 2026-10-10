import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import {readArchive} from '../src/formats/archive';
import {readBitmap,readPalette} from '../src/formats/graphics';
import {readBalanceArtwork,BALANCE_LABELS} from '../src/formats/balance-window';
import {balanceWindowView} from '../src/simulation/balance-view';
import {animalFullQuote,animalSaleQuote} from '../src/simulation/asset-sale';
import {readScenario} from '../src/formats/scenario';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
import {shopFixture} from './support/livestock';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const word=(b:Uint8Array,i:number,n:number)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(i,n,true);

test('Balance Sheet descriptor, control, formats and valuation callbacks are source-pinned',()=>{
  const ds=0x846f0,d=ds+0xaaf8;
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(d+i*2))).toEqual([0x61,0,128,96,400,240]);
  expect(Array.from({length:6},(_,i)=>exe.readUInt16LE(d+40+i*2))).toEqual([0x13ac,0x24e6,0x13b6,0x24e6,0xaae2,0x6190]);
  expect(Array.from({length:11},(_,i)=>exe.readUInt16LE(ds+0xaae2+i*2))).toEqual([0,328,200,48,24,1,8,3,14,0,0]);
  expect(exe.subarray(ds+0xaa3a,ds+0xaa55).toString()).toBe('BALANCE SHEET\0cashflow.bmp\0');
  expect(Array.from({length:28},(_,i)=>exe.subarray(ds+0xaa55+i*5,ds+0xaa59+i*5).toString())).toEqual(['%7ld','%7ld','%7ld','%7lu','%7lu','%7lu','%8lu','%7lu','%7lu','%7lu','%7lu','%7lu','%7ld','%7ld','%7ld','%7ld','%7ld','%7ld','%7ld','%7ld','%7ld','%7lu','%7ld','%8ld','%8ld','%8ld','%7ld','%7ld']);
  for(const [a,b,h] of [[0x41610,0x41efe,'fad64499014f2d374781335b1aa349781e48e7a413e8a5353860b1d2ef304384'],[0x41efe,0x41fd0,'cfcf920431e3d743f76e76c29e408ba9f746d627d8a9bcc17e0a678c3568c2a5'],[0x11a12,0x11a76,'61811a8829181b8dee4a437c29593a67a0565c22d5f38de768cf24f0d9859bc1'],[0x1366a,0x136c6,'b9913a7d410a5adbab29a8aeb960ce890f55d348afd4c52d371c0c168ddd8ddf'],[0x4b23a,0x4b29e,'acaaa1a10cd96e953f770bcf2b265b7b40d244b53fba6dd080e963f22bb58117']] as const)expect(hash(exe.subarray(a,b))).toBe(h);
});

test('Balance Sheet masks all original captions, preserves every other pixel and rejects all truncated bitmap prefixes',()=>{
  const bytes=asset('cashflow.bmp'),raw=readBitmap(bytes,palette),masked=readBalanceArtwork(bytes,palette);
  expect(bytes.length).toBe(44808);expect(hash(bytes)).toBe('ca4766300bd98d207038618656bbac75927f510ab4a000d8d936f83744251778');
  for(let y=0;y<224;y++)for(let x=0;x<400;x++){
    const i=(y*400+x)*4,p=Array.from(raw.rgba.subarray(i,i+4)),m=BALANCE_LABELS.find(l=>x>=l.x&&x<l.x+l.width&&y>=l.y&&y<l.y+('height' in l?l.height!:8));
    expect(Array.from(masked.rgba.subarray(i,i+4))).toEqual(m&&p.slice(0,3).every(n=>n===(m.light?255:0))?[...palette[m.fill],255]:p);
  }
  // The long Leased Machines label reaches x320, and Close extends to y199.
  for(const [x,y,w,h] of [[208,88,113,8],[332,190,40,12]])for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)expect(masked.rgba[(yy*400+xx)*4]).not.toBe(0);
  for(const [x,y,w] of [[24,8,176],[208,8,168],[24,88,176],[24,104,176],[208,152,168],[24,168,176],[208,168,168]])for(let yy=y;yy<y+8;yy++)for(let xx=x;xx<x+w;xx++)expect(masked.rgba[(yy*400+xx)*4]).not.toBe(255);
  expect(Array.from(PNG.sync.read(readFileSync('public/assets/balance-window.png')).data)).toEqual(Array.from(masked.rgba));
  for(let n=0;n<bytes.length;n++)expect(()=>readBalanceArtwork(bytes.subarray(0,n),palette)).toThrow();
  expect(()=>readBalanceArtwork(asset('evaluate.bmp'),palette)).toThrow('Invalid Balance Sheet artwork');
});

test('Balance Sheet derives all eight source farms without touching valuation or annual caches',()=>{
  const expected=[[40000,17300,644764,0,3712],[40000,0,380928,0,0],[40000,14200,475404,0,0],[40000,2100,164936,0,1940],[40000,8400,456968,0,0],[40000,9800,519520,0,28623],[40000,15600,508636,0,7002],[40000,0,345324,0,7974]];
  for(let i=0;i<8;i++){
    const game=new GameSimulation(readScenario(source(`SCEN${i}.SSM`)),browserCrops).withAllCrops(browserCrops),before=game.save(i),s=game.getSnapshot(),v=balanceWindowView(s,browserCrops);
    expect(v.assets).toEqual(expected[i]);expect(v.totalAssets).toBe(expected[i].reduce((a,b)=>a+b,0));
    expect(v.expenses[9]).toBe(s.finances.annual.priorTaxExpenses);expect(v.income).toBe(s.farmReport.income|0);expect(v.totalExpenses).toBe(s.farmReport.expenses|0);
    expect(game.save(i)).toBe(before);
  }
});

test('Balance valuation retains machinery and futures signed low words, full livestock dwords and all displayed ledger mappings',()=>{
  const f=shopFixture(),w=f.state.scenario;
  for(let i=1;i<=3;i++){const e=w.equipment[i];e.bytes.fill(0);e.flags=i===3?0x60:0x20;word(e.bytes,0,0);}
  word(w.equipmentDefinitions[0].bytes,6,20000);
  const animal=w.animals[1];animal.bytes.fill(0);animal.flags=0x20;word(animal.bytes,6,161);animal.bytes[8]=255;word(animal.bytes,10,13107);word(f.state.finances.accounts.assets.animalDefinitions[1].bytes,6,65535);
  const field=w.fields[1],crop=f.crops[field.cropSlot];field.bytes[7]|=1;field.bytes[2]=1;field.bytes[34]=127;word(field.bytes,18,0);word(field.bytes,38,0);word(field.bytes,48,10000);
  Object.assign(w.farm,{cash:0x80000000,cropIncome:1,contractGains:4,seedExpenses:11,landExpenses:13,contractLosses:14,chemicalExpenses:17,rentalExpenses:19});
  const a=f.state.finances.accounts,l=f.state.finances.annual;Object.assign(a,{equipmentExpenses:12,balancePayments:18,taxExpenses:999,landIncome:3});Object.assign(a.assets,{equipmentIncome:2,livestockIncome:5});Object.assign(l,{ds3e90:15,livestockExpenses:16,priorTaxExpenses:0xffffffff,otherExpenses:21});f.state.finances.loan.scheduledPayment=0xffffffff;
  const game=f.load(),before=game.save(4),s=game.getSnapshot(),v=balanceWindowView(s,browserCrops);
  expect(v.assets[0]).toBe(-2147483648);expect(v.assets[1]).toBe(-25536);expect(v.assets[4]).toBe(131070);
  const yieldWord=crop.rawDefinition[32]|crop.rawDefinition[33]<<8,expected=Math.floor(((yieldWord*1000)&65535)*65535/65536);expect(v.assets[3]).toBe((expected<<16>>16)>>>0);
  expect(v.revenue).toEqual([1,2,3,4,5]);expect(v.expenses).toEqual([11,12,13,14,15,16,17,18,19,4294967295,21]);expect(v.loan).toBe(-1);expect(game.save(4)).toBe(before);
  for(let type=160;type<=164;type++)for(const age of [0,1,13107,32768,65535])for(const condition of [0,63,64,127,128,191,192,255]){
    word(animal.bytes,6,type);word(animal.bytes,10,age);animal.bytes[8]=condition;
    const definitions=f.state.finances.accounts.assets.animalDefinitions,expected=(definitions[type-160].price+((age*[3,5,3,2,0][type-160])&65535))>>>(3-(condition>>>6));
    expect(animalFullQuote(animal,definitions).value).toBe(expected);expect(animalSaleQuote(animal,definitions).value).toBe(expected&65535);
  }
});
