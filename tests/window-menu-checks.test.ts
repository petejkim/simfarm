import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('original window checks set item flag0 for each open pointer and clear it on close',()=>{
  const b=readFileSync(new URL('../../simfarm-dos/SIMFARM.EXE',import.meta.url));
  for(const [start,end,hash] of [
    [0x2a126,0x2a39f,'b8b6757111f376fa2964aa67e15081d5b69189ba7e659d946ac9161692d6546c'],
    [0x2a7f6,0x2ab46,'ae8a44da9da24b54b0ff80673b7a69f4d4cf88a8652e5694ebb99e08523f56db'],
  ] as const)expect(createHash('sha256').update(b.subarray(start,end)).digest('hex')).toBe(hash);
  for(const p of [0x2a14f,0x2a181,0x2a1b7,0x2a1f1,0x2a231,0x2a275,0x2a2bd,0x2a309,0x2a359,0x2a39a])expect(b.subarray(p,p+5).toString('hex')).toBe('26804f0c01');
  expect(b.subarray(0x2a890,0x2a895).toString('hex')).toBe('2680670cfe');
  expect(b.subarray(0x2a12a,0x2a135).toString('hex')).toBe('26a1b413260b06b213741f');
});
