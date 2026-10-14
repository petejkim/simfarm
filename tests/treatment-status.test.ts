import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {disasterFixture} from './support/disasters';
import {TREATMENTS} from '../src/simulation/field-treatment';
import {readEditStatus} from '../src/formats/edit-status';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));

test('Spray source branches share busy21, supply75 and blank68 status producers',()=>{
  expect(createHash('sha256').update(exe.subarray(0x26d3c,0x26faa)).digest('hex')).toBe('4ed0328215db8173beeb07bc25ee47e5610910da41cc39e6d03f710973e1d6c8');
  expect(exe.subarray(0x26e5e,0x26e65).toString('hex')).toBe('6a4b9ab42b751d');
  for(const [push,code] of [[0x26f2e,21],[0x26f8e,68]]){
    expect([...exe.subarray(push,push+3)]).toEqual([0x6a,code,0xe9]);
    expect(push+5+exe.readInt16LE(push+3)).toBe(0x26e60);
  }
  for(const call of [0x26d7e,0x26e10,0x26eac,0x26f39])expect(exe.subarray(call,call+5).toString('hex')).toBe('9aa0013412');
  // Each successful treatment pushes its own click.voc pointer and joins the shared sound call26f86.
  for(const [push,ds] of [[0x26dc7,0x5a95],[0x26e56,0x5a9f],[0x26ef2,0x5aa9],[0x26f82,0x5ab3]]){
    expect(exe[push]).toBe(0x1e);expect(exe[push+1]).toBe(0x68);expect(exe.readUInt16LE(push+2)).toBe(ds);
    expect(exe.subarray(0x846f0+ds,0x846f0+ds+10).toString()).toBe('click.voc\0');
    if(push!==0x26f82){expect(exe[push+4]).toBe(0xe9);expect(push+7+exe.readInt16LE(push+5)).toBe(0x26f86);}
  }
  expect(exe.subarray(0x26f86,0x26f8e).toString('hex')).toBe('9ab6082a2183c404');
  const text=readFileSync(new URL('../public/assets/raw/qmessage.dat',import.meta.url));
  expect([21,68,75].map(code=>readEditStatus(text,code))).toEqual(['Field is busy.','','Not enough sprays to spray field.']);
});

test('all four live Spray outcomes retain exact rejected saves and clear the prompt only after success',()=>{
  for(const treatment of TREATMENTS)for(const outcome of ['busy','empty','poor','success','invalid','corrupt'] as const){
    const f=disasterFixture(),w=f.state.scenario;
    for(const c of w.chemicals)c.bytes[2]&=~32;
    for(const d of w.chemicalDefinitions)d.count=0;
    w.farm.autoBuySeeds=outcome!=='empty';w.farm.cash=outcome==='poor'?274:10000;
    if(outcome==='busy')w.fields[1].bytes[2]=6;
    if(outcome==='corrupt'){
      const c=w.chemicals[1];c.bytes[2]|=32;c.bytes[0]=220+TREATMENTS.indexOf(treatment);c.bytes[1]=0;
      // Active stock with a zero definition count is the native SF-030 guard.
    }
    const g=f.load();g.dispatch({type:'edit-status',code:14});const before=g.save(4),sounds:string[]=[];
    g.subscribeEvents(event=>{if(event.type==='sound')sounds.push(event.sound);});
    g.dispatch({type:'treat-field',fieldSlot:outcome==='invalid'?0:1,treatment});
    const s=g.getSnapshot(),code=outcome==='success'?68:outcome==='busy'?21:['empty','poor'].includes(outcome)?75:null;
    expect(s.editStatuses).toEqual(code===null?[14]:[code,14]);
    expect(sounds).toEqual(outcome==='success'?['click']:[]);
    if(outcome!=='success')expect(g.save(4)).toBe(before);
    else {expect(s.lastTreatmentResult?.ok).toBe(true);expect(s.scenario.farm.cash).toBe(9725);}
    // Snapshots/saves publish no repeated sound requests.
    g.getSnapshot();g.save(4);expect(sounds).toEqual(outcome==='success'?['click']:[]);
  }
});

test('pending decisions suppress Spray feedback as well as the canonical order',()=>{
  const f=disasterFixture();f.state.finances.defaultDecision={status:'pending',originalExitCode:0};
  const g=f.load(),before=g.save(4),sounds:string[]=[];g.subscribeEvents(event=>{if(event.type==='sound')sounds.push(event.sound);});g.dispatch({type:'treat-field',fieldSlot:1,treatment:'fertilizer'});
  expect(g.save(4)).toBe(before);expect(g.getSnapshot().editStatuses).toEqual([]);
  expect(sounds).toEqual([]);
});
