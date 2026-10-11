import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../src/formats/archive';
import {readWaterStorageMessage,WATER_STORAGE_MESSAGE} from '../src/formats/building-message';
const source=(name:string)=>readFileSync(new URL('../../simfarm-dos/'+name,import.meta.url));
test('water failure requests optional44 and the original dispatcher selects record44/portrait74',()=>{
  const exe=source('SIMFARM.EXE');
  expect(exe.subarray(0xc0e3,0xc0ea).toString('hex')).toBe('6a2c9ad80fe624');
  expect(0x30220+exe.readUInt16LE(0x3035c+44*2)).toBe(0x30286);
  expect(exe.subarray(0x30286,0x3028a).toString('hex')).toBe('c646fa4a');
  expect(WATER_STORAGE_MESSAGE).toEqual({record:44,portrait:74});
  const text=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).find(e=>e.name==='events.dat')!.bytes;
  expect(readWaterStorageMessage(text)).toBe('A water tower has burst! You may want to bulldoze it and buy another.');
  for(let length=44*256;length<45*256;length++)expect(()=>readWaterStorageMessage(text.subarray(0,length))).toThrow();
  const before=Uint8Array.from(text);readWaterStorageMessage(text);expect(text).toEqual(before);
});
