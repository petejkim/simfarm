import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {weatherPalette} from '../src/assets/weather-tiles';
import {readArchive} from '../src/formats/archive';
import {readPalette} from '../src/formats/graphics';
const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));

test('weather palette selection follows source precipitation and signed32 temperature threshold',()=>{
  const b=source('SIMFARM.EXE');
  expect(createHash('sha256').update(b.subarray(0x1e50c,0x1e57f)).digest('hex')).toBe('bc9e13c4f3db43e38462bbde703c5975606e7641744f1584c2adb2e17d7f2419');
  expect(b.subarray(0x1e530,0x1e542).toString('hex')).toBe('26833e32d52073061e683e40eb041e68de3f');
  for(const current of [0,1,2,3,4])for(const temperature of [-2147483648,-1,0,31,32,33,65536,2147483647])
    expect(weatherPalette({current,temperature})).toBe(current<3?'normal':temperature<32?'frost':'rain');
});

test('rain and frost change only source index7; duplicate normal RGB entries cannot be substituted indiscriminately',()=>{
  const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  const palettes=['simfarm.pal','rainpal.pal','frostpal.pal'].map(n=>readPalette(entries.find(e=>e.name===n)!.bytes));
  expect(palettes.map(p=>p[7])).toEqual([[146,113,57],[0,0,235],[255,255,255]]);
  for(let i=0;i<16;i++)if(i!==7){expect(palettes[1][i]).toEqual(palettes[0][i]);expect(palettes[2][i]).toEqual(palettes[0][i]);}
  expect(palettes[0][7]).toEqual(palettes[0][11]);
});
