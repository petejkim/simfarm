import {readSaveText} from '../support/save-file';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { worldIndex } from '../../src/formats/scenario';
import { reveal, expectPaletteAction } from '../support/workspace';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar,readPalette } from '../../src/formats/graphics';
async function load(page:Page,text:string){await page.goto('/');await page.locator('#load-farm-file').setInputFiles({name:'palette-supplies.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await page.locator('#viewport').evaluate(v=>v.scrollTo(0,0));}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await p).path())!));}
async function coords(page:Page,x:number,y:number){const zoom=Number(await page.locator('#zoom').inputValue()),r=(await page.locator('#world').boundingBox())!;return {x:r.x+(x+.5)*16*zoom,y:r.y+(y+.5)*16*zoom};}
async function move(page:Page,x:number,y:number,steps=1){const p=await coords(page,x,y);await page.mouse.move(p.x,p.y,{steps});}
async function click(page:Page,x:number,y:number){await move(page,x,y);await page.mouse.down();await page.mouse.up();}
async function tool(page:Page,name:string){await page.getByRole('button',{name,exact:true}).click();await expectPaletteAction(page,name);await expect(page.locator('[data-window=actions]')).toBeHidden();}
async function pixels(page:Page,x:number,y:number,tile:number){
  const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url)),archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>archive.find(a=>a.name===n)!.bytes;
  const expected=decodePlanar(asset('ega16til.til').subarray(tile*128,(tile+1)*128),16,16,readPalette(asset('simfarm.pal'))).rgba;
  expect(await page.locator('#world').evaluate((c:HTMLCanvasElement,p)=>Array.from(c.getContext('2d')!.getImageData(p.x*16,p.y*16,16,16).data),{x,y})).toEqual(Array.from(expected));
}

test('Trees, Hay and Trough paint from the original palette with exact source tiles, records and continuation',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  for(const [name,y] of [['Trees',10],['Hay',12],['Trough',14]] as const){
    await tool(page,name);await move(page,10,y);expect(await save(page)).toEqual(JSON.parse(g.save(4))); // Hover must not consume RNG.
    await move(page,10,y);await page.mouse.down();await move(page,12,y,12);await page.mouse.up();
    for(let x=10;x<=12;x++)g.dispatch(name==='Trees'?{type:'plant-tree',x,y}:{type:'buy-livestock',productType:name==='Hay'?300:299,x,y});
    expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  await page.keyboard.press('Escape');await expectPaletteAction(page,'View object');await page.mouse.move(1000,700);
  for(let x=10;x<=12;x++){await pixels(page,x,10,g.getSnapshot().scenario.cells[worldIndex(x,10)].terrain&0x7ff);await pixels(page,x,14,176);}
  const supplies=g.getSnapshot().scenario.inventory.filter(i=>i.active);expect(supplies.map(i=>[i.type,i.quantity])).toEqual([[300,512],[300,512],[300,512],[299,256],[299,256],[299,256]]);
  await page.screenshot({path:'artifacts/browser-palette-supplies.png'});
  await page.reload();await load(page,g.save(4));expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  for(let day=0;day<8;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('rejected supply/tree work preserves cash, clearing and RNG, while one stroke charges each sampled cell once',async({page})=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;f.state.weather.soilMoisture=0;w.farm.autoClear=true;w.farm.cash=109;
  w.cells[worldIndex(10,10)].terrain=535;w.cells[worldIndex(11,10)].overlay=0;w.cells[worldIndex(12,10)].overlay=0x4800;w.cells[worldIndex(13,10)].terrain=150;
  const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  await tool(page,'Hay');await click(page,10,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tool(page,'Trees');
  for(const [x,message] of [[11,'Buy this land'],[12,'Town land'],[13,'Terrain blocks']] as const){await click(page,x,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));}
  await move(page,10,10);await page.mouse.down();const p=await coords(page,10,10);await page.mouse.move(p.x+2,p.y+2,{steps:5});await page.mouse.move(p.x-2,p.y-2,{steps:5});await page.mouse.up();
  g.dispatch({type:'plant-tree',x:10,y:10});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tool(page,'Trough');await click(page,13,10);g.dispatch({type:'buy-livestock',productType:299,x:13,y:10});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await click(page,13,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.locator('#window-buy').click();await expectPaletteAction(page,'View object');
});

test('full inventory rejects Hay/Trough but allows Trees, including captured touch at2x and cancellation',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;
  for(const item of f.state.scenario.inventory.slice(1)){item.bytes.set([43,1,0,1,0,0,0,0,95,95,32,0]);}
  f.state.finances.accounts.otherDefinitions[11].count=511;
  const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));
  for(const name of ['Hay','Trough']){await tool(page,name);await click(page,10,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));}
  await reveal(page,'#zoom');await page.locator('#zoom').selectOption('2');await tool(page,'Trees');await page.locator('#viewport').evaluate(v=>v.scrollTo(20*32,20*32));
  const a=await coords(page,25,25),b=await coords(page,26,25),session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  for(let i=1;i<=4;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/4,y:a.y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  for(const x of [25,26])g.dispatch({type:'plant-tree',x,y:25});await move(page,27,25);expect(await save(page)).toEqual(JSON.parse(g.save(4)));await session.detach();
});
