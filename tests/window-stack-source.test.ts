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
