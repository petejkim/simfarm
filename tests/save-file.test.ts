import {test,expect} from 'bun:test';
import {gzipSync,gunzipSync} from 'node:zlib';
import {compressSave,readSaveFile} from '../src/formats/save-file';
import {MAX_SAVE_BYTES} from '../src/formats/native-save';

test('gzip transport roundtrips exact Unicode JSON and interoperates with external gzip',async()=>{
  const text=JSON.stringify({name:'Farm 🌾',data:'terrain'.repeat(10000)});
  const compressed=await compressSave(text),bytes=new Uint8Array(await compressed.arrayBuffer());
  expect(compressed.type).toBe('application/gzip');expect([...bytes.slice(0,2)]).toEqual([31,139]);
  expect(compressed.size).toBeLessThan(text.length/10);expect(gunzipSync(bytes).toString()).toBe(text);
  expect(new TextDecoder().decode(await readSaveFile(compressed))).toBe(text);
  expect(new TextDecoder().decode(await readSaveFile(new Blob([gzipSync(text)])))).toBe(text);
  expect(new TextDecoder().decode(await readSaveFile(new Blob([text])))).toBe(text);
  expect(await readSaveFile(new Blob([new Uint8Array([0x18,0,255])]))).toEqual(new Uint8Array([0x18,0,255]));
});
test('bounds apply to compressed input and expanded bytes; malformed gzip rejects',async()=>{
  await expect(compressSave('x'.repeat(MAX_SAVE_BYTES+1))).rejects.toThrow('too large');
  await expect(readSaveFile(new Blob([new Uint8Array(MAX_SAVE_BYTES+1)]))).rejects.toThrow('too large');
  await expect(readSaveFile(new Blob([gzipSync('x'.repeat(MAX_SAVE_BYTES+1))]))).rejects.toThrow('expanded');
  expect((await readSaveFile(new Blob([gzipSync('x'.repeat(MAX_SAVE_BYTES))]))).length).toBe(MAX_SAVE_BYTES);
  const valid=gzipSync('valid'),corrupt=Buffer.from(valid);corrupt[corrupt.length-5]^=0xff;
  for(const bytes of [valid.subarray(0,-4),corrupt,Buffer.from([31,139,0])])await expect(readSaveFile(new Blob([bytes]))).rejects.toThrow();
});
test('cancelled decoding never returns a partial checkpoint',async()=>{
  const controller=new AbortController();controller.abort();
  await expect(readSaveFile(new Blob(['{}']),controller.signal)).rejects.toThrow();
  const running=new AbortController(),result=readSaveFile(new Blob([gzipSync('x'.repeat(MAX_SAVE_BYTES))]),running.signal);
  running.abort();await expect(result).rejects.toThrow();
});
