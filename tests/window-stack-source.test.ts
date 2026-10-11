import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('original window creation links neighbors and launcher toggle calls single-window removal',()=>{
  const b=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [start,end,hash] of [
    [0x3e7b8,0x3eaa0,'f81c18c6282f011f536f10b30490ac7fdfd04e35eb5d40a12f75fd16b8acf89b'],
    [0x2a5bc,0x2a7f6,'07a89ac3da785fc8c5e393f9b8b88f0e78e29f0899f163c192ad4f52fb833025'],
    [0x2ac14,0x2ad6e,'b2eaea3e9e49888a470af4cbde2dcbea95a300b2303023a3cf5381de6729358c'],
  ] as const)expect(createHash('sha256').update(b.subarray(start,end)).digest('hex')).toBe(hash);
  expect(b.subarray(0x3ea21,0x3ea26).toString('hex')).toBe('9a6e10e624');
  // Stub24e6:106e -> overlay0:0b64 -> file2ac14.
  expect(b.subarray(0x280cc,0x280d6).toString('hex')).toBe('0000e81cf5ea640bce27');
  expect(b.subarray(0x2a767,0x2a76f).toString('hex')).toBe('2689474426895746');
  expect(b.subarray(0x2a781,0x2a789).toString('hex')).toBe('268947482689574a');
  expect(b.subarray(0x2ad39,0x2ad41).toString('hex')).toBe('268944482689544a');
});


test('toolbar closes only the front window and raises a background descriptor',()=>{
  const b=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [start,end,hash] of [
    [0xe8d2,0xea19,'5cdf7c5576ad7ee88982e4bec8285301e29b580da51d77699cc289bd8bb60e1c'],
    [0x2af9c,0x2b099,'ff0a666681b8ddc5583cd0cd5a988f7db28ad670b49d1916298c87caf9ea6ec2'],
  ] as const)expect(createHash('sha256').update(b.subarray(start,end)).digest('hex')).toBe(hash);
  // Toolbar rows below48, column x>>5; existing window is closed only if next is null.
  expect(b.subarray(0xe8d7,0xe8dd).toString('hex')).toBe('2683bf7c1230');
  expect(b.subarray(0xe8e7,0xe8ea).toString('hex')).toBe('c1f805');
  expect(b.subarray(0xe9eb,0xe9f5).toString('hex')).toBe('268b4746260b4744750b');
  expect(b.subarray(0xe9f7,0xe9fc).toString('hex')).toBe('9a6e10e624');
  expect(b.subarray(0xea11,0xea16).toString('hex')).toBe('9a1e10e624');
  // Raise stub24e6:101e -> overlay0:0eec; remove from neighbors then append at front.
  expect(b.subarray(0x2807c,0x28086).toString('hex')).toBe('0000e86cf5eaec0ece27');
  expect(b.subarray(0x2b01b,0x2b023).toString('hex')).toBe('26895c4426894446');
  expect(b.subarray(0x2b04e,0x2b056).toString('hex')).toBe('26894f4426897746');
  expect(b.subarray(0x2b05c,0x2b064).toString('hex')).toBe('26897f4626897f44');
});
