import {test,expect} from 'bun:test';
import {readFileSync,readdirSync} from 'node:fs';
import {readArchive} from '../src/formats/archive';

const source=(name:string)=>readFileSync(new URL(`../../simfarm-dos/${name}`,import.meta.url));

test('imports retain every raw archive member while removing retired derived assets',()=>{
  const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  for(const entry of entries)
    expect(readFileSync(`public/assets/raw/${entry.name}`)).toEqual(Buffer.from(entry.bytes));
  const obsolete=new Set(['bank-terminal.png','evaluation-window.png','market-window.png','examine-window.png',
    'message-button.png','town-choice-pressed.png','crop-tiles.png','mini-tiles.png','scenario.png','prsnt480.png',
    'tiles.png','edit-help.png','sell-conditions.png']);
  const retired=readdirSync('public/assets').filter(name=>obsolete.has(name)||
    name.endsWith('.bmp.png')&&name!=='popup.bmp.png'||/^scenario\d+\.tiles\.png$/.test(name)||
    /\.(?:music|audio)\.json$|\.mp3$/.test(name));
  expect(retired).toEqual([]);
});
