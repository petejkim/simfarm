import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import {clickFarmTile} from '../support/field-actions';
import { reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { worldIndex } from '../../src/formats/scenario';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name:'networks.json',mimeType:'application/json',buffer:Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, suffix: string) {
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  const path=`artifacts/browser-network-${suffix}.simfarm.json`;await (await pending).saveAs(path);return JSON.parse(readSaveText(path));
}
const labels={'road-161':'Dirt road','road-150':'Paved road',fence:'Fence',gate:'Gate'} as const;
async function tool(page:Page,name:string){await reveal(page,'#viewport');await page.getByRole('button',{name,exact:true}).click();}
async function gate(page:Page,x:number,y:number){
  await tool(page,'View object');
  await page.locator('#viewport').evaluate((el,p)=>el.scrollTo(Math.max(0,p.x-3)*16,Math.max(0,p.y-3)*16),{x,y});
  const rect=(await page.locator('#world').boundingBox())!;await page.mouse.click(rect.x+x*16+8,rect.y+y*16+8,{button:'right'});
}
async function pixels(page: Page,x:number,y:number,tile:number) {
  const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
  const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>archive.find(a=>a.name===n)!.bytes;
  const expected=decodePlanar(asset('ega16til.til').subarray(tile*128,(tile+1)*128),16,16,readPalette(asset('simfarm.pal'))).rgba;
  const actual=await page.locator('#world').evaluate((c:HTMLCanvasElement,p)=>Array.from(c.getContext('2d')!.getImageData(p.x*16,p.y*16,16,16).data),{x,y});
  expect(actual).toEqual(Array.from(expected));
}
async function audio(page:Page) {
  await page.addInitScript(()=>{
    const Base=window.AudioContext;Object.assign(window,{networkAudio:[] as {length:number;peak:number}[]});
    window.AudioContext=class extends Base {
      constructor(options?:AudioContextOptions){super(options);const make=this.createBufferSource.bind(this);
        this.createBufferSource=()=>{const source=make(),start=source.start.bind(source);
          source.start=(...args)=>{const entry={length:source.buffer?.length??0,peak:0},analyser=this.createAnalyser();source.connect(analyser);
            (window as unknown as {networkAudio:typeof entry[]}).networkAudio.push(entry);
            const timer=setInterval(()=>{const data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);entry.peak=Math.max(entry.peak,...Array.from(data,Math.abs));},10);
            source.addEventListener('ended',()=>clearInterval(timer));start(...args);};return source;};}
    };
  });
}
const played=(page:Page)=>page.evaluate(()=>(window as unknown as {networkAudio:{length:number;peak:number}[]}).networkAudio);

test('network controls construct original networks, operate gates, play placement PCM and restore exact saves',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await audio(page);await page.goto('/');
  const f=shopFixture();f.state.scenario.cells[worldIndex(12,10)].terrain=0x2000|98;const g=f.load().withAllCrops(browserCrops);
  await load(page,g.save(4));await toggleOption(page,'Sound Effects');
  await expect(page.locator('#network-panel')).toHaveCount(0);
  const actions:[keyof typeof labels,number,number,number][]=[['road-161',10,10,20],['road-150',11,10,30],['road-150',12,10,40],['fence',10,12,50],['fence',11,12,50],['gate',10,12,75]];
  for(const [kind,x,y,price] of actions){
    await tool(page,labels[kind]);await clickFarmTile(page,x,y);
    g.dispatch({type:'network',tool:kind,x,y});
  }
  await expect.poll(async()=>(await played(page)).some(s=>s.length===1389&&s.peak>0.01)).toBe(true);
  for(const action of ['open-gate','close-gate','open-gate'] as const){
    const sounds=(await played(page)).filter(s=>s.length!==2667).length;await gate(page,10,12);
    g.dispatch({type:'network',tool:action,x:10,y:12});
    expect((await played(page)).filter(s=>s.length!==2667).length).toBe(sounds);
  }
  await tool(page,'View object'); // Remove placement preview from source-pixel targets.
  await pixels(page,10,10,162);await pixels(page,11,10,151);await pixels(page,12,10,172);await pixels(page,10,12,191);await pixels(page,11,12,178);
  expect(await save(page,'built')).toEqual(JSON.parse(g.save(4)));
  await page.reload();await load(page,g.save(4));expect((await played(page)).length).toBe(0);
  await gate(page,10,12);g.dispatch({type:'network',tool:'close-gate',x:10,y:12});
  for(let day=0;day<3;day++){await reveal(page, '#next-day'); await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}
  expect(await save(page,'continued')).toEqual(JSON.parse(g.save(4)));expect(errors).toEqual([]);
});

test('original construction rejects land, cash, terrain and gate limits and still operates gates without cash',async({page})=>{
  await page.setViewportSize({width:1280,height:844});await page.goto('/');const f=shopFixture(),w=f.state.scenario;
  w.farm.cash=44;w.farm.autoClear=true;f.state.weather.soilMoisture=0;
  w.cells[worldIndex(10,10)].terrain=535;w.cells[worldIndex(11,10)].overlay=0x4800;
  w.cells[worldIndex(12,10)].overlay=0;w.cells[worldIndex(13,10)].terrain=0x800|15;
  w.cells[worldIndex(14,10)].terrain=179;w.cells[worldIndex(15,10)].terrain=188;
  const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  for(const [kind,x,message] of [['road-161',10,'not enough cash'],['fence',11,'Town land'],['fence',12,'Buy this land'],['road-150',13,'Terrain blocks'],['gate',14,'straight fence']] as const){
    await tool(page,labels[kind]);await clickFarmTile(page,x,10);
  }
  expect(await save(page,'rejected')).toEqual(JSON.parse(g.save(4)));
  w.farm.cash=45;const funded=f.load().withAllCrops(browserCrops);await load(page,funded.save(4));
  await tool(page,'Dirt road');await clickFarmTile(page,10,10);
  funded.dispatch({type:'network',tool:'road-161',x:10,y:10});
  await gate(page,15,10);funded.dispatch({type:'network',tool:'open-gate',x:15,y:10});
  expect(await save(page,'zero-cash-gate')).toEqual(JSON.parse(funded.save(4)));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({path:'artifacts/browser-network-mobile.png',fullPage:true});
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
