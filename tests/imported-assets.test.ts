import {test,expect} from 'bun:test';
import {readFileSync,readdirSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {readArchive} from '../src/formats/archive';
import {runtimePublicFiles} from '../tools/runtime-assets';

const source=(name:string)=>readFileSync(new URL(`../../simfarm-dos/${name}`,import.meta.url));

test('imports retain every raw archive member while removing retired derived assets',()=>{
  const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  for(const entry of entries)
    expect(readFileSync(`artifacts/original-assets/${entry.name}`)).toEqual(Buffer.from(entry.bytes));
  const obsolete=new Set(['bank-terminal.png','evaluation-window.png','market-window.png','examine-window.png',
    'message-button.png','town-choice-pressed.png','crop-tiles.png','mini-tiles.png','scenario.png','prsnt480.png',
    'tiles.png','edit-help.png','sell-conditions.png']);
  const retired=readdirSync('public/assets').filter(name=>obsolete.has(name)||
    name.endsWith('.bmp.png')&&name!=='popup.bmp.png'||/^scenario\d+\.tiles\.png$/.test(name)||
    /\.(?:music|audio)\.json$|\.mp3$/.test(name));
  expect(retired).toEqual([]);
});

test('public raw files are exactly the runtime set and match original bytes; preservation retains all inputs',()=>{
  const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  const originals=new Map(entries.map(e=>[e.name,Buffer.from(e.bytes)]));
  const names=['creditz.txt','townly0.cmp','itemtext.dat','scenario.odt','scenario.int','scenario.pal','far_mapc.mbm',
    'click.voc','rooster.voc','boos.voc','cheers.voc','explode.voc','bulldoze.voc','plane.voc','tornado.voc',
    'swarm.voc','wind.voc','flood.voc','plopitem.voc','ploptool.voc','uhoh.voc','smack.voc',
    'horse1.voc','cow1.voc','cow2.voc','pig.voc','sheep1.voc','sheep2.voc'];
  for(let id=0;id<8;id++)originals.set(`SCEN${id}.SSM`,source(`SCEN${id}.SSM`)),names.push(`SCEN${id}.SSM`);
  expect(readdirSync('public/assets/raw').sort()).toEqual(names.sort());
  expect(readdirSync('public/assets').filter(name=>name!=='raw'&&!name.startsWith('.')).sort())
    .toEqual([...runtimePublicFiles].filter(name=>name.startsWith('assets/')&&!name.startsWith('assets/raw/')).map(name=>name.slice(7)).sort());
  for(const name of names)expect(readFileSync(`public/assets/raw/${name}`)).toEqual(originals.get(name)!);
  const manifest=JSON.parse(readFileSync('artifacts/original-assets/manifest.json','utf8'));
  expect(manifest.entries.map((e:{name:string})=>e.name)).toEqual(entries.map(e=>e.name));
  expect(existsSync('public/assets/manifest.json')).toBe(false);
});

test('reimport removes legacy unused raw exports, retains research copies and leaves unrelated local files alone',()=>{
  const directory=mkdtempSync(resolve('artifacts/import-cleanup-'));
  try{
    mkdirSync(`${directory}/public/assets/raw/crops`,{recursive:true});
    for(const file of ['about.bmp','genfarm.xmi','events.dat','bird1.voc','bird2.voc','compbeep.voc','thunder.voc'])
      writeFileSync(`${directory}/public/assets/raw/${file}`,'legacy');
    writeFileSync(`${directory}/public/assets/raw/crops/apples.crp`,'legacy');
    writeFileSync(`${directory}/public/assets/manifest.json`,'legacy');
    writeFileSync(`${directory}/public/assets/local-note.txt`,'keep');
    const imported=Bun.spawnSync([process.execPath,resolve('tools/import.ts'),resolve('../simfarm-dos')],{cwd:directory});
    expect(imported.exitCode,new TextDecoder().decode(imported.stderr)).toBe(0);
    expect(readdirSync(`${directory}/public/assets/raw`).sort()).toEqual(readdirSync('public/assets/raw').sort());
    expect(readFileSync(`${directory}/artifacts/original-assets/about.bmp`)).toEqual(readFileSync('artifacts/original-assets/about.bmp'));
    expect(readFileSync(`${directory}/artifacts/original-assets/crops/apples.crp`)).toEqual(source('CROPS/APPLES.CRP'));
    expect(existsSync(`${directory}/public/assets/manifest.json`)).toBe(false);
    expect(readFileSync(`${directory}/public/assets/local-note.txt`,'utf8')).toBe('keep');
  }finally{rmSync(directory,{recursive:true,force:true});}
},15000);
