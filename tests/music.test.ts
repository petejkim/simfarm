import { test } from 'bun:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { decodeXmidi, encodeMidi } from '../src/formats/xmidi';
const chunk = (tag: string, bytes: number[]) => { const b = Buffer.alloc(8 + bytes.length + (bytes.length & 1)); b.write(tag); b.writeUInt32BE(bytes.length, 4); b.set(bytes, 8); return b; };
const sequence = (bytes: number[]) => chunk('FORM', [...Buffer.from('XMID'), ...chunk('EVNT', bytes)]);

test('XMIDI additive delays, duration VLQs and zero duration notes', () => {
  const input = sequence([127, 3, 0x90, 60, 100, 0x81, 0, 4, 0x91, 64, 90, 0, 0xff, 0x2f, 0]);
  const result = decodeXmidi(input);
  assert.deepEqual(result.events.map(e => e.tick), [130, 134, 135, 258]);
  assert.deepEqual(result.events.at(-1)?.data, [0x80, 60, 0]);
  const midi = encodeMidi(result);
  assert.equal(Buffer.from(midi.subarray(0, 4)).toString(), 'MThd');
  assert.equal(new DataView(midi.buffer).getUint16(12), 60);
  assert.equal(new DataView(midi.buffer).getUint32(18), midi.length - 22);
  assert.deepEqual(Array.from(midi.subarray(-4)), [0, 255, 47, 0]);
  assert.throws(() => decodeXmidi(input.subarray(0, -1)));
  assert.throws(() => decodeXmidi(sequence([0x90, 60])));
  assert.throws(() => decodeXmidi(sequence([0xb0, 116, 2, 0xff, 0x2f, 0])));
  assert.throws(() => decodeXmidi(sequence([0x90, 60, 90, 10])));
});

test('all eight source tracks produce balanced MIDI notes and preserve program changes', () => {
  const source = (name: string) => readFileSync(new URL(`../../simfarm-dos/${name}`, import.meta.url));
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).filter(e => e.name.endsWith('.xmi'));
  assert.equal(entries.length, 8);
  for (const entry of entries) {
    const sequence = decodeXmidi(entry.bytes);
    assert.ok(sequence.endTick > 2000 && sequence.endTick < 8000);
    assert.ok(sequence.events.some(e => e.data[0] >> 4 === 12));
    // Supplied-track audit: no ignored pitch/sustain/pressure messages.
    assert.deepEqual([...new Set(sequence.events.map(e=>e.data[0]>>4))].sort(),entry.name==='alien.xmi'?[12,8,9]:[11,12,8,9]);
    assert.ok(sequence.events.filter(e=>e.data[0]>>4===11).every(e=>e.data[1]===7));
    const notes = new Map<string, number>();
    for (const e of sequence.events) {
      const kind = e.data[0] >> 4, key = `${e.data[0] & 15}:${e.data[1]}`;
      if (kind === 9 && e.data[2] > 0) notes.set(key, (notes.get(key) ?? 0) + 1);
      if (kind === 8 || (kind === 9 && e.data[2] === 0)) notes.set(key, (notes.get(key) ?? 0) - 1);
    }
    assert.ok([...notes.values()].every(n => n === 0), entry.name);
    assert.ok(encodeMidi(sequence).length > 100);
  }
});

test('supplied driver loop slots select the fourth start, ignore overflow and preserve note tails',()=>{
  const driver=readFileSync(new URL('../../simfarm-dos/SOUND/GMT32MPU.ADV',import.meta.url));
  assert.equal(createHash('sha256').update(driver).digest('hex'),'3b3c22aae5578a0ca58b792d629912471f1d13527fcf16ba91f3a4f8152bf368');
  assert.equal(driver.subarray(0x1a41,0x1a47).toString('hex'),'bb0000b90400');
  assert.equal(driver.subarray(0x1a6e,0x1a74).toString('hex'),'bb0600b90400');
  assert.equal(driver.subarray(0x1a82,0x1a88).toString('hex'),'83786000740d');
  const input=sequence([0xc0,3,0xb0,116,0,0xb1,116,0,0xb2,116,0,2,0xb3,116,0,0xc1,8,3,0xb4,116,0,0x90,60,100,20,5,0xb9,117,100,0xff,0x2f,0]);
  const result=decodeXmidi(input);
  assert.deepEqual(result.loop,{startTick:2,endTick:10,initialEvents:[{tick:0,data:[0xc0,3]},{tick:2,data:[0xc1,8]},{tick:5,data:[0x90,60,100],voice:0},{tick:25,data:[0x80,60,0],voice:0}],events:[{tick:2,data:[0xc1,8]},{tick:5,data:[0x90,60,100],voice:0},{tick:25,data:[0x80,60,0],voice:0}]});
  assert.throws(()=>decodeXmidi(sequence([0xb0,116,0,0xb0,117,100,0xff,0x2f,0])),/Nonadvancing/);
  assert.equal(decodeXmidi(sequence([0xb0,116,0,10,0xb0,117,0,0xff,0x2f,0])).loop,undefined);
});

test('only genfarm has an infinite source loop and its note releases cross the boundary',()=>{
  const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
  const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).filter(e=>e.name.endsWith('.xmi'));
  for(const entry of entries){
    const decoded=decodeXmidi(entry.bytes);
    if(entry.name!=='genfarm.xmi'){assert.equal(decoded.loop,undefined);continue;}
    assert.equal(decoded.loop?.startTick,0);assert.equal(decoded.loop?.endTick,7199);
    assert.ok(decoded.loop.events.some(e=>e.tick>7199));
    assert.ok(decoded.loop.events.length<decoded.events.length);
  }
});
