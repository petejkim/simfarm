import {test,expect} from 'bun:test';
import {midiLoopWindow} from '../src/audio/midi-loop';
import type {MidiLoop} from '../src/formats/xmidi';
const body=[{tick:2,data:[0x90,60,100],voice:7},{tick:17,data:[0x80,60,0],voice:7}];
const loop:MidiLoop={startTick:2,endTick:12,events:body,initialEvents:[{tick:0,data:[0xc0,4]},...body]};
test('loop windows play initial setup once, repeat on exact boundaries and retain overlapping releases',()=>{
  const all=midiLoopWindow(loop,0,38);
  expect(all.map(e=>[e.tick,e.data[0],e.voiceKey])).toEqual([
    [0,0xc0,undefined],[2,0x90,'0:7'],[12,0x90,'1:7'],[17,0x80,'0:7'],[22,0x90,'2:7'],[27,0x80,'1:7'],[32,0x90,'3:7'],[37,0x80,'2:7'],
  ]);
  expect([...midiLoopWindow(loop,0,12),...midiLoopWindow(loop,12,17),...midiLoopWindow(loop,17,38)]).toEqual(all);
  expect(midiLoopWindow(loop,12,12)).toEqual([]);
});
test('throttled playback jumps directly to the correct iteration without replaying old notes',()=>{
  const events=midiLoopWindow(loop,1000002,1000018);
  expect(events.map(e=>[e.tick,e.voiceKey])).toEqual([[1000002,'100000:7'],[1000007,'99999:7'],[1000012,'100001:7'],[1000017,'100000:7']]);
  for(const [start,end] of [[-1,2],[2,1],[0,Infinity],[0,1201]])expect(()=>midiLoopWindow(loop,start,end)).toThrow();
  expect(()=>midiLoopWindow({...loop,endTick:2},0,1)).toThrow();
});
