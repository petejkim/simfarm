import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {readArchive} from '../../src/formats/archive';
import {decodePlanar,readPalette} from '../../src/formats/graphics';
import {patchCropGraphics} from '../../src/formats/crop-graphics';
import {allCropFiles} from '../../src/formats/crop-slots';
import {readScenario} from '../../src/formats/scenario';
import {readExpertDeck} from '../../src/formats/expert-cards';
import {decodeVoc} from '../../src/formats/voc';
import {browserCrops} from '../support/crop-catalog';
import {openWindow,reveal} from '../support/workspace';
const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
const deck=readExpertDeck(id=>asset(`card${id}.hc`));
const cropFiles=allCropFiles(readScenario(source('SCEN0.SSM')).cropFiles);
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await pending).path())!,'utf8'));}
async function pixels(page:Page,x:number,y:number,w:number,h:number){return page.locator('.expert-artwork').evaluate((c:HTMLCanvasElement,r)=>Array.from(c.getContext('2d')!.getImageData(...r).data),[x,y,w,h] as [number,number,number,number]);}

test('Expert restores original home geometry, all static chapters, field icons and movable real-text pages without farm mutations',async({page})=>{
  await start(page);const before=await save(page),edit=await page.locator('#viewport').boundingBox();await openWindow(page,'expert');
  const win=page.getByRole('dialog',{name:'Farm Expert',exact:true}),client=page.getByRole('region',{name:'Farm Expert'});
  expect(await win.boundingBox()).toEqual({x:128,y:96,width:400,height:240});
  expect(await client.boundingBox()).toEqual({x:128,y:112,width:400,height:224});
  await expect(client).toContainText("Welcome to the town's Farm Bureau.");
  expect(await client.getByRole('button').count()).toBe(7);
  for(const [name,x,y] of [['Field icons',24,16],['Crops',144,16],['Sprays',264,16],['Machinery',24,96],['Structures',144,96],['Livestock',264,96]] as const)
    expect(await client.getByRole('button',{name,exact:true}).boundingBox()).toEqual({x:128+x,y:112+y,width:112,height:64});
  await page.screenshot({path:'artifacts/browser-expert-home.png'});
  await client.getByRole('button',{name:'Field icons',exact:true}).click();
  const tiles=patchCropGraphics(asset('ega16til.til'),cropFiles.map(f=>source(`CROPS/${f.toUpperCase()}`)));
  for(const c of deck.get(2)!){
    if(c.kind==='text')await expect(client.getByText(c.text,{exact:true})).toBeVisible();
    if(c.kind==='tiles')for(let i=0;i<c.columns*c.rows;i++){
      const tile=c.first+i;expect(await pixels(page,c.x+i%c.columns*16,c.y-16+Math.floor(i/c.columns)*16,16,16)).toEqual(Array.from(decodePlanar(tiles.subarray(tile*128,(tile+1)*128),16,16,palette).rgba));
    }
  }
  await client.getByRole('button',{name:'CANCEL',exact:true}).click();
  for(const [chapter,first,last] of [['Livestock',5,8],['Sprays',26,29],['Machinery',30,37],['Structures',40,48]] as const){
    await client.getByRole('button',{name:chapter,exact:true}).click();
    for(let id=first;id<=last;id++){
      await expect(client).toHaveAttribute('data-expert-page',String(id));
      for(const c of deck.get(id)!){
        if(c.kind==='text')await expect(client.getByText(c.text,{exact:true})).toBeVisible();
        if(c.kind==='picture'&&c.card!==66){
          // alltiles.btl:20-byte header,2-byte card header,3584 planar bytes.
          expect(await pixels(page,c.x,c.y-16,112,64)).toEqual(Array.from(decodePlanar(asset('alltiles.btl').subarray(22+c.card*3586,22+c.card*3586+3584),112,64,palette).rgba));
        }
      }
      await expect(client.getByRole('img',{name:'Farm Bureau expert',exact:true})).toBeVisible();
      await expect(client.locator('.expert-cap-text')).toHaveText('FARMBUREAU');
      if(id<last)await client.getByRole('button',{name:'NEXT',exact:true}).click();
      else {await expect(client.getByRole('button',{name:'NEXT',exact:true})).toHaveCount(0);await client.getByRole('button',{name:'PREV',exact:true}).click();await expect(client).toHaveAttribute('data-expert-page',String(last-1));}
    }
    await client.getByRole('button',{name:'CANCEL',exact:true}).click();
  }
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  await client.getByRole('button',{name:'Crops',exact:true}).click();await client.getByRole('button',{name:'NEXT',exact:true}).click();
  await page.keyboard.press('Escape');await expect(win).toBeHidden();await openWindow(page,'expert');
  expect(await win.boundingBox()).toMatchObject({x:138,y:96});await expect(client).toHaveAttribute('data-expert-page','1');
  await client.getByRole('button',{name:'CLOSE',exact:true}).click();await expect(win).toBeHidden();
  expect(await page.locator('#viewport').boundingBox()).toEqual(edit);expect(await save(page)).toEqual(before);
});

test('all24 Expert crops show their exact original description and photo through Next/Prev and reopening',async({page})=>{
  await start(page);const before=await save(page);await openWindow(page,'expert');const client=page.getByRole('region',{name:'Farm Expert'});
  await client.getByRole('button',{name:'Crops',exact:true}).click();const seen=new Set<string>();
  for(let i=0;i<24;i++){
    const crop=browserCrops.find(c=>`${c.id}.crp`===cropFiles[i])!;seen.add(crop.id);
    await expect(client.locator('[data-expert-crop]')).toHaveAttribute('data-expert-crop',crop.id);
    await expect(client.locator('[data-expert-crop]')).toHaveText(crop.expertDescription);
    const img=client.getByRole('img',{name:`${crop.name}, original crop illustration`});await expect(img).toBeVisible();
    const png=PNG.sync.read(await img.screenshot());expect([png.width,png.height]).toEqual([112,64]);
    expect(Array.from(png.data)).toEqual(Array.from(decodePlanar(source(`CROPS/${crop.id.toUpperCase()}.CRP`).subarray(0x400,0x1200),112,64,palette).rgba));
    if(i===0)await expect(client.getByRole('button',{name:'PREV',exact:true})).toHaveCount(0);
    if(i<23)await client.getByRole('button',{name:'NEXT',exact:true}).click();
  }
  expect(seen.size).toBe(24);await expect(client.getByRole('button',{name:'NEXT',exact:true})).toHaveCount(0);
  await page.screenshot({path:'artifacts/browser-expert-crop.png'});
  for(let i=22;i>=0;i--){await client.getByRole('button',{name:'PREV',exact:true}).click();await expect(client.locator('[data-expert-crop]')).toHaveAttribute('data-expert-crop',cropFiles[i].replace('.crp',''));}
  await client.getByRole('button',{name:'CANCEL',exact:true}).click();await expect(client).toHaveAttribute('data-expert-page','1');
  expect(await save(page)).toEqual(before);
});

test('Expert navigation and portrait play original PCM only when enabled, with mute and missing sound recovery',async({page})=>{
  const requests:string[]=[],errors:string[]=[];page.on('request',r=>{if(r.url().endsWith('.voc'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const Base=window.AudioContext,voices:{length:number;analyser:AnalyserNode}[]=[];Object.assign(window,{__expertVoices:voices});
    window.AudioContext=class extends Base{constructor(options?:AudioContextOptions){super(options);const create=this.createBufferSource.bind(this);this.createBufferSource=()=>{const s=create(),start=s.start.bind(s);s.start=(...args)=>{const analyser=this.createAnalyser();s.connect(analyser);voices.push({length:s.buffer!.length,analyser});start(...args);};return s;};}};
  });
  await start(page);const before=await save(page);await openWindow(page,'expert');
  const client=page.getByRole('region',{name:'Farm Expert'});await client.getByRole('button',{name:'Livestock',exact:true}).click();
  await client.getByRole('button',{name:'Play rooster sound',exact:true}).click();expect(requests).toHaveLength(0);
  await reveal(page,'#sound-toggle');await page.locator('#sound-toggle').click();await openWindow(page,'expert');
  await client.getByRole('button',{name:'NEXT',exact:true}).click();
  const length=decodeVoc(asset('click.voc')).samples.length;
  await expect.poll(()=>page.evaluate(n=>(window as unknown as {__expertVoices:{length:number}[]}).__expertVoices.some(v=>v.length===n),length)).toBe(true);
  await client.getByRole('button',{name:'Play rooster sound',exact:true}).click();
  const rooster=decodeVoc(asset('rooster.voc')).samples.length;
  await expect.poll(()=>page.evaluate(n=>{const v=(window as unknown as {__expertVoices:{length:number;analyser:AnalyserNode}[]}).__expertVoices.find(v=>v.length===n),data=new Float32Array(2048);v?.analyser.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));},rooster)).toBeGreaterThan(.01);
  expect(requests.filter(r=>r.endsWith('/click.voc'))).toHaveLength(1);expect(requests.filter(r=>r.endsWith('/rooster.voc'))).toHaveLength(1);
  await reveal(page,'#sound-toggle');await page.locator('#sound-toggle').click();await openWindow(page,'expert');const n=requests.length;
  await client.getByRole('button',{name:'Play rooster sound',exact:true}).click();await client.getByRole('button',{name:'NEXT',exact:true}).click();expect(requests).toHaveLength(n);
  await page.route('**/rooster.voc',r=>r.fulfill({status:404,body:'Missing rooster'}));await reveal(page,'#sound-toggle');await page.locator('#sound-toggle').click();await openWindow(page,'expert');
  await client.getByRole('button',{name:'Play rooster sound',exact:true}).click();await expect(page.locator('#sound-error')).toContainText('rooster.voc');await expect(client.getByRole('button',{name:'NEXT',exact:true})).toBeEnabled();
  expect(await save(page)).toEqual(before);expect(errors).toEqual([]);
});

test('missing or malformed Expert resources fail before creating a farm',async({page})=>{
  for(const url of ['farmburo.bmp.png','expert-portrait.png','raw/card48.hc']){
    await page.route(`**/assets/${url}`,r=>r.fulfill({status:404,body:'Missing Expert asset'}));await page.goto('/');
    await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('.loading')).toContainText(url);await expect(page.locator('#world')).toHaveCount(0);await page.unroute(`**/assets/${url}`);
  }
  await page.route('**/assets/raw/card1.hc',r=>r.fulfill({status:200,contentType:'application/octet-stream',body:Buffer.from([0x8b,0])}));await page.goto('/');
  await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
