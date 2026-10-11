import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {EDIT_TOOL_STATUSES,SPRAY_STATUSES,type EditToolStatusCode} from '../src/simulation/edit-status';
import {disasterFixture} from './support/disasters';
const exe=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));

test('all twelve palette selections and four Spray choices use the recovered quick-message codes',()=>{
  for(const [name,id,start,push] of [
    ['Move object',26,0x21726,0x2174a],['View object',2,0x21688,0x2170a],
    ['Paved road',15,0x21a9a,0x21b51],['Dirt road',16,0x21b56,0x21c10],
    ['Fence',11,0x217a8,0x2185f],['Gate',12,0x21864,0x2191b],
    ['Ditch',20,0x21e30,0x21ee7],['Valve',19,0x21d74,0x21e2b],
    ['Hay',13,0x21920,0x219d7],['Trough',14,0x219dc,0x21a94],
    ['Trees',17,0x21c16,0x21ccd],['Bulldoze',1,0x215ea,0x2167b],
  ] as const){
    expect(0x1f950+exe.readUInt16LE(0x22352+(id-1)*2)).toBe(start);
    expect([...exe.subarray(push,push+2)]).toEqual([0x6a,EDIT_TOOL_STATUSES[name]]);
    if(!['Move object','View object','Bulldoze'].includes(name))expect(push+5+exe.readInt16LE(push+3)).toBe(0x2167d);
  }
  for(const call of [0x2174d,0x2170d,0x2167e])expect(call+3+exe.readInt16LE(call+1)).toBe(0x22504);
  for(const [name,push] of [['fertilizer',0x383e8],['pesticide',0x38436],['herbicide',0x3847c],['fungicide',0x384c4]] as const){
    expect([...exe.subarray(push,push+2)]).toEqual([0x6a,SPRAY_STATUSES[name]]);
    expect(exe.subarray(push+2,push+7).toString('hex')).toBe('9ab42b751d');
  }
});

test('tool requests preserve canonical saves, wrap and deduplicate, reject unverified codes and respect pending decisions',()=>{
  const f=disasterFixture(),g=f.load(),before=g.save(4),codes=[...Object.values(EDIT_TOOL_STATUSES),...Object.values(SPRAY_STATUSES)];
  for(const code of codes){g.dispatch({type:'edit-status',code});g.dispatch({type:'edit-status',code});}
  expect(g.getSnapshot().editStatuses).toEqual(codes.slice(-10).reverse());expect(g.save(4)).toBe(before);
  const history=g.getSnapshot().editStatuses;
  for(const code of [-1,51,76,255,NaN,0.5])expect(()=>g.dispatch({type:'edit-status',code:code as EditToolStatusCode})).toThrow('Invalid Edit tool status');
  expect(g.getSnapshot().editStatuses).toEqual(history);expect(g.save(4)).toBe(before);
  f.state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=f.load();for(const code of codes)blocked.dispatch({type:'edit-status',code});expect(blocked.getSnapshot().editStatuses).toEqual([]);
});
