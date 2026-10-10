import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {FINANCE_MESSAGES,readFinanceMessage} from '../src/formats/finance-message';
import type {FinanceNoticeId} from '../src/simulation/events';
import {financeMessageFixture} from './support/finance-messages';
import {GameSimulation} from './support/game';
import {browserCrops} from './support/crop-catalog';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),bytes=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).find(e=>e.name==='events.dat')!.bytes;
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('original financial-message dispatcher, portrait branches, loader and word layout are pinned to source bytes',()=>{
  for(const [a,b,h] of [[0x30220,0x30486,'5b7ef887168a851aa6ea40210d8a18d3a1f6757bf99af016050245e69a56d884'],[0x4a2ee,0x4a365,'972a90ed5dc5176168a64a959f42b8d99e2a25702e823f9f0581e9b03817bdb4'],[0x882e,0x8932,'4b40550eb5b45523f765e696b3e9d1432999cdf87c0c161e5f41a2371a81ee19']] as const)expect(hash(exe.subarray(a,b))).toBe(h);
  expect(hash(bytes)).toBe('616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb');
  for(const [id,m] of Object.entries(FINANCE_MESSAGES)){
    expect(m.record).toBe(+id>=128?+id-128:+id);
    const branch=0x30220+exe.readUInt16LE(0x3035c+m.record*2);
    expect(branch).toBe(m.portrait===74?0x30286:m.portrait===75?0x30344:0x30292);
    expect(exe[branch+3]).toBe(m.portrait);
  }
  expect(exe.subarray(0x3041a,0x30428).toString('hex')).toBe('6a016a0068960068c0006a006a01');
  expect(exe.subarray(0x1d77a,0x1d784).toString('hex')).toBe('8a460a98509ad80fe624');
});

test('all eleven messages decode bounded records, strip padding and physical line breaks, and preserve original words',()=>{
  const before=hash(bytes);
  for(const id of Object.keys(FINANCE_MESSAGES).map(Number) as FinanceNoticeId[]){
    const text=readFinanceMessage(bytes,id),m=FINANCE_MESSAGES[id];
    expect(text.length).toBeGreaterThan(50);expect(text).not.toMatch(/[@\r\n]/);
    expect(text).toBe(new TextDecoder().decode(bytes.subarray(m.record*256,(m.record+1)*256)).replace(/@|\r|\n/g,' ').replace(/\s+/g,' ').trim());
    for(let n=m.record*256;n<(m.record+1)*256;n++)expect(()=>readFinanceMessage(bytes.subarray(0,n),id)).toThrow('Truncated financial message');
  }
  expect(readFinanceMessage(bytes,163)).toBe('NOTICE: You have successfully paid your taxes in full. Thank You. Have a nice day.');
  expect(readFinanceMessage(bytes,36)).toContain('10% charge for this service.');
  expect(()=>readFinanceMessage(bytes,160 as FinanceNoticeId)).toThrow('Unknown financial message');expect(hash(bytes)).toBe(before);
  const modified=bytes.slice(),offset=31*256;modified[offset+3]=0;
  expect(readFinanceMessage(modified,159)).toBe('War');
});

test('live annual and monthly financial requests occur in source order once, without replaying on snapshot, speed change or reload',()=>{
  const cases=[['annual',[159]],['estimate',[161]],['tax-warning',[162]],['tax-paid',[163]],['tax-sale',[36,165]],['loan-new',[166]],['loan-warning',[169]],['loan-paid',[170]],['loan-sale',[39,168]],['both',[170,163]],['default',[39]]] as const;
  for(const [kind,expected] of cases){
    const game=financeMessageFixture(kind),silent=GameSimulation.load(game.save(4),browserCrops).simulation,seen:number[]=[];
    game.subscribeEvents(e=>{if(e.type==='finance-notice')seen.push(e.id);});
    game.dispatch({type:'advance-day'});silent.dispatch({type:'advance-day'});expect(seen).toEqual([...expected]);expect(game.save(4)).toBe(silent.save(4));
    const saved=game.save(4),copy=GameSimulation.load(saved,browserCrops).simulation;
    copy.subscribeEvents(e=>{if(e.type==='finance-notice')seen.push(e.id);});
    for(let i=0;i<3;i++){game.getSnapshot();copy.getSnapshot();game.save(4);copy.save(4);}
    game.dispatch({type:'set-speed',speed:1});copy.dispatch({type:'set-speed',speed:1});expect(seen).toEqual([...expected]);
    expect(copy.save(4)).toBe(game.save(4));
  }
});
