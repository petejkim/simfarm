import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { worldIndex } from '../../src/formats/scenario';
import type { NetworkAction } from '../../src/simulation/network-placement';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name:'networks.json',mimeType:'application/json',buffer:Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, suffix: string) {
  const pending=page.waitForEvent('download');await page.locator('#save-farm').click();
  const path=`artifacts/browser-network-${suffix}.simfarm.json`;await (await pending).saveAs(path);return JSON.parse(readFileSync(path,'utf8'));
}
async function select(page: Page,x:number,y:number) {
  await page.locator('#viewport').evaluate((el,p)=>el.scrollTo(p.x*16,p.y*16),{x,y});
  await page.locator('#viewport').scrollIntoViewIfNeeded();const rect=(await page.locator('#world').boundingBox())!;
  await page.mouse.click(rect.x+x*16+8,rect.y+y*16+8);await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
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

test('Roads & fences shortcut constructs original networks, operates gates, plays placement PCM and restores exact saves',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await audio(page);await page.goto('/');
  const f=shopFixture();f.state.scenario.cells[worldIndex(12,10)].terrain=0x2000|98;const g=f.load();
  await load(page,g.save(4));await page.locator('#sound-toggle').click();
  await page.getByRole('button',{name:'Roads & fences',exact:true}).click();await expect(page.locator('#network-panel h2')).toBeFocused();
  await expect(page.locator('#apply-network')).toBeDisabled();
  const actions:[NetworkAction,number,number,number][]=[['road-161',10,10,20],['road-150',11,10,30],['road-150',12,10,40],['fence',10,12,50],['fence',11,12,50],['gate',10,12,75]];
  for(const [tool,x,y,price] of actions){
    await page.locator('#network-tool').selectOption(tool);await page.getByRole('button',{name:'Choose on map',exact:true}).click();
    await expect(page.locator('#viewport')).toBeFocused();await select(page,x,y);await page.getByRole('button',{name:'Review construction',exact:true}).click();
    await expect(page.locator('#network-panel h2')).toBeFocused();await expect(page.locator('#network-placement-status')).toContainText(`$${price}`);
    await page.locator('#apply-network').click();g.dispatch({type:'network',tool,x,y});await expect(page.locator('#network-result')).toContainText(`completed for $${price}`);
  }
  await expect.poll(async()=>(await played(page)).some(s=>s.length===1389&&s.peak>0.01)).toBe(true);
  await expect(page.locator('#gate-state')).toHaveText('Selected gate is closed.');
  for(const tool of ['open-gate','close-gate','open-gate'] as const){
    const sounds=(await played(page)).length;await page.locator('#network-tool').selectOption(tool);await page.locator('#apply-network').click();
    g.dispatch({type:'network',tool,x:10,y:12});await expect(page.locator('#gate-state')).toContainText(tool==='open-gate'?'is open':'is closed');expect((await played(page)).length).toBe(sounds);
  }
  await select(page,14,14); // Remove selection/preview from the source-pixel targets.
  await pixels(page,10,10,162);await pixels(page,11,10,151);await pixels(page,12,10,172);await pixels(page,10,12,191);await pixels(page,11,12,178);
  expect(await save(page,'built')).toEqual(JSON.parse(g.save(4)));
  await page.reload();await load(page,g.save(4));expect((await played(page)).length).toBe(0);
  await page.getByRole('button',{name:'Roads & fences',exact:true}).click();await expect(page.locator('#network-result')).toHaveCount(0);
  await select(page,10,12);await expect(page.locator('#gate-state')).toContainText('is open');
  await page.locator('#network-tool').selectOption('close-gate');await page.locator('#apply-network').click();g.dispatch({type:'network',tool:'close-gate',x:10,y:12});
  for(let day=0;day<3;day++){await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}
  expect(await save(page,'continued')).toEqual(JSON.parse(g.save(4)));expect(errors).toEqual([]);
});

test('construction explains land, cash, terrain and gate limits and supports map review on a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');const f=shopFixture(),w=f.state.scenario;
  w.farm.cash=44;w.farm.autoClear=true;f.state.weather.soilMoisture=0;
  w.cells[worldIndex(10,10)].terrain=535;w.cells[worldIndex(11,10)].overlay=0x4800;
  w.cells[worldIndex(12,10)].overlay=0;w.cells[worldIndex(13,10)].terrain=0x800|15;
  w.cells[worldIndex(14,10)].terrain=179;w.cells[worldIndex(15,10)].terrain=188;
  const g=f.load();await load(page,g.save(4));await page.getByRole('button',{name:'Roads & fences',exact:true}).click();
  for(const [tool,x,message] of [['road-161',10,'not enough cash'],['fence',11,'Town land'],['fence',12,'Buy this land'],['road-150',13,'clear grass'],['gate',14,'straight fence'],['open-gate',14,'existing gate']] as const){
    await page.locator('#network-tool').selectOption(tool);await page.getByRole('button',{name:'Choose on map',exact:true}).click();await select(page,x,10);
    await page.getByRole('button',{name:'Review construction',exact:true}).click();await expect(page.locator('#network-panel h2')).toBeFocused();
    await expect(page.locator('#network-placement-status')).toContainText(message);await expect(page.locator('#apply-network')).toBeDisabled();
  }
  expect(await save(page,'rejected')).toEqual(JSON.parse(g.save(4)));
  w.farm.cash=45;const funded=f.load();await load(page,funded.save(4));await page.getByRole('button',{name:'Roads & fences',exact:true}).click();
  await select(page,10,10);await page.getByRole('button',{name:'Review construction',exact:true}).click();
  await expect(page.locator('#network-placement-status')).toContainText('$45 ($25 clearing)');await page.locator('#apply-network').click();funded.dispatch({type:'network',tool:'road-161',x:10,y:10});
  await select(page,15,10);await page.locator('#network-tool').selectOption('open-gate');await page.locator('#apply-network').click();funded.dispatch({type:'network',tool:'open-gate',x:15,y:10});
  expect(await save(page,'zero-cash-gate')).toEqual(JSON.parse(funded.save(4)));
  await page.getByRole('button',{name:'Roads & fences',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/browser-network-mobile.png',fullPage:true});
});
