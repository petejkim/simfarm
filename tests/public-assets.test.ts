import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { build } from 'vite';
import { publicAssets } from '../tools/public-assets';

test('production packaging excludes preservation leftovers and dotfiles while retaining runtime files byte-for-byte', async () => {
  const root=await mkdtemp(resolve('artifacts/public-build-'));
  try{
    const publicFiles={
      'manifest.webmanifest':'{"name":"SimFarm"}', 'assets/terrain-tiles.png':'runtime image',
      'assets/raw/creditz.txt':'runtime credits', 'assets/raw/SCEN7.SSM':'runtime farm',
      'assets/raw/rooster.voc':'runtime sample',
      'assets/manifest.json':'source manifest', 'assets/raw/events.dat':'predecoded text',
      'assets/raw/genfarm.xmi':'converted music', 'assets/raw/crops/apples.crp':'source crop',
      'assets/raw/thunder.voc':'unused sample', 'assets/raw/local-extra.txt':'unused local file',
      'assets/local-note.txt':'not a runtime file', 'assets/unused.png':'not a runtime image',
      '.DS_Store':'macOS metadata','assets/.gitkeep':'placeholder','assets/.private/note.txt':'hidden',
    };
    for(const [name,text] of Object.entries(publicFiles)){
      const path=`${root}/public/${name}`;
      await mkdir(dirname(path),{recursive:true});await writeFile(path,text);
    }
    await writeFile(`${root}/index.html`,'<!doctype html><title>Packaging fixture</title>');
    const result=await build({configFile:false,root,logLevel:'silent',plugins:[publicAssets()],
      build:{copyPublicDir:false,write:false,reportCompressedSize:false}});
    if(!('output' in result))throw new Error('Expected a single production output');
    const emitted=new Map(result.output.map(item=>[item.fileName,item]));
    expect([...emitted.keys()].sort()).toEqual(['index.html','manifest.webmanifest','assets/terrain-tiles.png',
      'assets/raw/creditz.txt','assets/raw/SCEN7.SSM','assets/raw/rooster.voc'].sort());
    for(const [name,text] of Object.entries(publicFiles)){
      const item=emitted.get(name);
      if(item?.type==='asset')expect(Buffer.from(item.source).toString()).toBe(text);
    }
  }finally{await rm(root,{recursive:true,force:true});}
},15000);
