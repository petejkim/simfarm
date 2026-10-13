import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readArchive} from '../src/formats/archive';
import {DISASTER_MESSAGES,readDisasterMessage} from '../src/formats/disaster-message';
import type {DisasterNoticeId} from '../src/simulation/events';
import {disasterFixture} from './support/disasters';
import {GameSimulation} from './support/game';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
const exe=source('SIMFARM.EXE'),bytes=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).find(e=>e.name==='events.dat')!.bytes;
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const kinds=['frost','wind','crop-circles','toxic-land','tornado','drought','flood','swarm'] as const;

test('all twelve original disaster rows, portraits, coordinates and preference gates match executable branches',()=>{
  expect(hash(exe.subarray(0x36574,0x36d08))).toBe('046109e5d1cf8d38d1bb4df5ead2181ef8b88e3246ccc3936c681d5728caa1d1');
  expect(hash(exe.subarray(0x36d16,0x3709c))).toBe('ecadc5b52e7b83806f44183ca73fdf8fe6def05e5f0c56f65fbe7ac5a99c84b3');
  expect(hash(bytes)).toBe('616d4c3c7de1e6f60718933a4cefacaacaf915c0c704d1dd179165eb45e346cb');
  for(const [id,row,call] of [
    ['frost',0x365bc,0x365f8],['wind',0x366b3,0x366ef],['crop-circles',0x36777,0x3679b],
    ['toxic-land',0x36845,0x36869],['tornado',0x368b6,0x368e6],['drought',0x369cd,0x369fd],
    ['flood',0x36b26,0x36b62],['swarm',0x36c06,0x36c42],['wind-ended',0x36d5e,0x36d82],
    ['tornado-ended',0x36dda,0x36dfe],['flood-ended',0x37027,0x37057],
  ] as const){
    const m=DISASTER_MESSAGES[id];expect([...exe.subarray(row,row+2)]).toEqual([0x6a,m.record]);
    expect(exe.subarray(call-22,call-8).toString('hex')).toBe('6a016a0068960068c0006a006a01');
    expect([...exe.subarray(call-8,call-6)]).toEqual([0x6a,m.portrait]);
    expect(exe.subarray(call,call+5).toString('hex')).toBe('9af4103606');
    if(!id.endsWith('-ended'))expect(exe.subarray(row,call).includes(Buffer.from('26803ea1a800','hex'))).toBe(!m.mandatory);
  }
  expect([...exe.subarray(0x36f07,0x36f09)]).toEqual([0x6a,DISASTER_MESSAGES['drought-ended'].record]);
  expect([...exe.subarray(0x36f32,0x36f34)]).toEqual([0x6a,DISASTER_MESSAGES['drought-ended'].portrait]);
  expect(exe.subarray(0x36f34,0x36f37).toString('hex')).toBe('e9c1fe'); // shares36df8 text/popup tail.
  for(const gate of [0x36d56,0x36dcf,0x36f19,0x37039])expect(exe.subarray(gate,gate+6).toString('hex')).toBe('26803ea1a800');
});

test('disaster text preserves source words and enforces every truncated record boundary without modifying assets',()=>{
  const before=hash(bytes);
  for(const id of Object.keys(DISASTER_MESSAGES) as DisasterNoticeId[]){
    const m=DISASTER_MESSAGES[id],lines=readDisasterMessage(bytes,id),text=lines.map(l=>l.text).join(' ');
    expect(text.length).toBeGreaterThan(20);expect(text).not.toMatch(/[@\r\n`~]/);
    expect(text).toBe(new TextDecoder().decode(bytes.subarray(m.record*256,m.record*256+254)).split('\0')[0].replace(/[@\r\n`~]/g,' ').replace(/\s+/g,' ').trim());
    for(let n=m.record*256;n<(m.record+1)*256;n++)expect(()=>readDisasterMessage(bytes.subarray(0,n),id)).toThrow('Truncated disaster message');
    const changed=Uint8Array.from(bytes);changed[m.record*256+3]=0;
    expect(readDisasterMessage(changed,id).map(l=>l.text).join('')).toBe(new TextDecoder().decode(bytes.subarray(m.record*256,m.record*256+3)).replace(/[`@]/g,'').trim());
  }
expect(()=>readDisasterMessage(bytes,'missing' as DisasterNoticeId)).toThrow('Unknown disaster message');expect(hash(bytes)).toBe(before);
});

test('all successful starts honor original mandatory/optional messages, preserve saves and never replay on failed starts or reload',()=>{
  for(const kind of kinds)for(const messages of [true,false]){
    const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=1;f.state.scenario.farm.messages=messages;
    const game=f.load(),seen:DisasterNoticeId[]=[];game.subscribeEvents(e=>{if(e.type==='disaster-notice')seen.push(e.id);});
    game.dispatch({type:'start-disaster',kind});expect(game.getSnapshot().lastDisasterResult?.ok).toBe(true);
    expect(seen).toEqual(messages||DISASTER_MESSAGES[kind].mandatory?[kind]:[]);
    const saved=game.save(4),copy=GameSimulation.load(saved,f.crops).simulation;
    copy.subscribeEvents(e=>{if(e.type==='disaster-notice')seen.push(e.id);});
    copy.dispatch({type:'set-speed',speed:1});expect(copy.save(4)).toBe(saved);
    game.dispatch({type:'start-disaster',kind});copy.dispatch({type:'start-disaster',kind});
    expect(game.save(4)).toBe(copy.save(4)); // source price callback may precede active-event rejection.
    expect(seen).toEqual(messages||DISASTER_MESSAGES[kind].mandatory?[kind]:[]);
  }
});

test('natural wind, tornado, drought and flood endings announce once; silent frost and swarm endings do not invent popups',()=>{
  for(const messages of [true,false])for(const kind of ['wind','tornado','drought','flood','frost','swarm'] as const){
    const f=disasterFixture();f.state.scenario.farm.messages=messages;f.state.disasters.enabled=false;
    f.state.disasters.flags={wind:8,tornado:1,drought:2,flood:4,frost:16,swarm:32}[kind];
    f.state.scenario.farm.calendar.day=6;f.state.scenario.farm.animationTicks=3000;
    f.state.disasters.swarm.fieldSlot=1;f.state.scenario.fields[1].bytes[7]&=~1;f.state.weather.soilMoisture=5;f.state.weather.temperatureAnomaly=0;
    f.state.waterDisasters.counter=9;
    const game=f.load(),seen:DisasterNoticeId[]=[];game.subscribeEvents(e=>{if(e.type==='disaster-notice')seen.push(e.id);});
    game.dispatch({type:'advance-day'});
    expect(seen).toEqual(messages&&kind!=='frost'&&kind!=='swarm'?[`${kind}-ended` as DisasterNoticeId]:[]);
    game.dispatch({type:'advance-day'});expect(seen.length).toBe(messages&&kind!=='frost'&&kind!=='swarm'?1:0);
  }
});

test('renderer882e markup: backtick-indented titles are centred and ~ breaks the line before the body',()=>{
  const titles:Partial<Record<DisasterNoticeId,string>>={frost:'FROST WARNING','crop-circles':'CLOSE ENCOUNTER',tornado:'TORNADO WARNING',
    drought:'DROUGHT WARNING',flood:'FLOOD WARNING',swarm:'LOCUST INFESTATION'};
  for(const id of Object.keys(DISASTER_MESSAGES) as DisasterNoticeId[]){
    const lines=readDisasterMessage(bytes,id),title=titles[id];
    if(title){expect(lines).toHaveLength(2);expect(lines[0]).toEqual({text:title,centered:true});expect(lines[1].centered).toBe(false);}
    else {expect(lines).toHaveLength(1);expect(lines[0].centered).toBe(false);}
  }
  expect(readDisasterMessage(bytes,'tornado')).toEqual([{text:'TORNADO WARNING',centered:true},{text:'High winds in the area have spawned a tornado!',centered:false}]);
  // 882e..8931: ~ (0x7e) advances the line; a backtick (0x60) is rewritten to a space and drawn as a blank cell.
  expect(exe.subarray(0x8912,0x891c).toString('hex')).toBe('26803f7e750c8346f808');
  expect(exe.subarray(0x88d0,0x88da).toString('hex')).toBe('26803f60750426c60720');
});
