import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readArchive } from '../src/formats/archive';
import { readTownEvent, readRodeoInvitation } from '../src/formats/town-event';
const source = (name: string) => readFileSync(new URL('../../simfarm-dos/' + name, import.meta.url));

test('paired source save/load calls establish event field order and width after recreation count', () => {
  const exe = source('SIMFARM.EXE');
  const fields = [[0x1ed6, 1], [0x1ed4, 2], [0x1ed9, 1], [0x1ed0, 2], [0x1ed2, 1], [0x1ed3, 1]];
  for (const [i, [address, width]] of fields.entries()) {
    for (const [start, call] of [[0x44bca, '9adc088400'], [0x45bec, '9a4a078400']] as const) {
      const off = start + i * 24;
      assert.equal(exe.subarray(off, off + 4).toString('hex'), `6a016a0${width}`);
      assert.equal(exe.subarray(off + 4, off + 7).toString('hex'), '689061');
      assert.equal(exe[off + 7], 0x68); assert.equal(exe.readUInt16LE(off + 8), address);
      assert.equal(exe.subarray(off + 10, off + 15).toString('hex'), call);
    }
  }
  assert.equal(exe.subarray(0xcb45, 0xcb50).toString('hex'), '6a3d1e686d209a0010e624');
});

test('all source farms retain original event timing and unknown byte values without touching adjacent accounts', () => {
  for (let id = 0; id < 8; id++) {
    const bytes = source(`SCEN${id}.SSM`), before = Buffer.from(bytes);
    assert.deepEqual(readTownEvent(bytes), {
      rodeoFrame: id === 5 ? 2 : 0, lastTick: id === 5 ? 49467 : 0,
      animalType: 0, participation: 0, mode: 0, weeksRemaining: 0,
    });
    assert.deepEqual(bytes, before);
  }
  const bytes = source('SCEN0.SSM');
  bytes.set([255, 0x34, 0x12, 254, 0xe8, 3, 253, 252], 0x21674);
  const event = readTownEvent(bytes);
  assert.deepEqual(event, { rodeoFrame: 255, lastTick: 0x1234, animalType: 254, participation: 1000, mode: 253, weeksRemaining: 252 });
  bytes.fill(0, 0x21674, 0x2167c);
  assert.equal(event.participation, 1000);
  for (let size = 0x21674; size < 0x2167c; size++) assert.throws(() => readTownEvent(bytes.subarray(0, size)));
});

test('original rodeo invitation retains the stake and total return as real text with bounded record reads', () => {
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
  const bytes = archive.find(a => a.name === 'events.dat')!.bytes;
  assert.equal(readRodeoInvitation(bytes), "The Town Rodeo is starting! Your cousin Jed wants to know if you'll bet 500 bucks on him to win! If he wins you'll get 1,000 dollars back.");
  assert.throws(() => readRodeoInvitation(bytes.subarray(0, 62 * 256 - 1)));
  const artificial = new Uint8Array(62 * 256).fill(64);
  artificial.set(new TextEncoder().encode('Rodeo\0ignored'), 61 * 256);
  artificial[62 * 256 - 2] = 88; artificial[62 * 256 - 1] = 89;
  assert.equal(readRodeoInvitation(artificial), 'Rodeo');
});
