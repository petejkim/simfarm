import {readSaveText} from '../support/save-file';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { worldIndex } from '../../src/formats/scenario';
import { reveal } from '../support/workspace';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar,readPalette } from '../../src/formats/graphics';
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'construction.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await p).path())!));}
async function coords(page:Page,x:number,y:number){const zoom=Number(await page.locator('#zoom').inputValue()),r=(await page.locator('#world').boundingBox())!;return {x:r.x+(x+.5)*16*zoom,y:r.y+(y+.5)*16*zoom};}
async function move(page:Page,x:number,y:number,steps=1){const p=await coords(page,x,y);await page.mouse.move(p.x,p.y,{steps});}
async function click(page:Page,x:number,y:number){await move(page,x,y);await page.mouse.down();await page.mouse.up();}
async function tool(page:Page,name:string){await page.getByRole('button',{name,exact:true}).click();await expect(page.locator('#cancel-construction')).toBeVisible();}
async function pixels(page:Page,x:number,y:number,tile:number){
  const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url)),archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>archive.find(a=>a.name===n)!.bytes;
  const expected=decodePlanar(asset('ega16til.til').subarray(tile*128,(tile+1)*128),16,16,readPalette(asset('simfarm.pal'))).rgba;
  expect(await page.locator('#world').evaluate((c:HTMLCanvasElement,p)=>Array.from(c.getContext('2d')!.getImageData(p.x*16,p.y*16,16,16).data),{x,y})).toEqual(Array.from(expected));
}

test('six original palette tools build directly, drag connected lines, retain source pixels and continue exact saves',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;f.state.scenario.cells[worldIndex(14,10)].terrain=39;f.state.scenario.cells[worldIndex(14,16)].terrain=150;
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));await page.locator('#viewport').evaluate(v=>v.scrollTo(0,0));
  for(const [name,kind,y] of [['Paved road','road-150',10],['Dirt road','road-161',12],['Fence','fence',14],['Ditch','ditch',16]] as const){
    await tool(page,name);await move(page,10,y);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
    await move(page,10,y);await page.mouse.down();await move(page,12,y,12);await page.mouse.up();
    for(let x=10;x<=12;x++)g.dispatch(kind==='ditch'?{type:'irrigation',tool:kind,x,y}:{type:'network',tool:kind,x,y});
    await expect(page.locator('[data-window=actions]')).toBeHidden();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  for(const [name,x,y] of [['Gate',11,14],['Valve',11,16],['Paved road',14,10],['Ditch',14,16]] as const){
    await tool(page,name);await click(page,x,y);
    if(name==='Ditch'||name==='Valve')g.dispatch({type:'irrigation',tool:name==='Ditch'?'ditch':'valve',x,y});
    else g.dispatch({type:'network',tool:name==='Gate'?'gate':'road-150',x,y});
    expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  await page.getByRole('button',{name:'Stop construction',exact:true}).click();await page.mouse.move(1100,700);
  for(const [x,y,t] of [[11,10,151],[11,12,162],[11,14,190],[11,16,122],[14,10,172],[14,16,172]])await pixels(page,x,y,t);
  await page.screenshot({path:'artifacts/browser-direct-construction.png'});
  await page.reload();await load(page,g.save(4));await expect(page.locator('#cancel-construction')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  for(let d=0;d<3;d++){await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('construction failures preserve clearing and cash, and hover or same-cell motion never repeat a purchase',async({page})=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;f.state.weather.soilMoisture=0;w.farm.cash=54;w.farm.autoClear=true;
  w.cells[worldIndex(10,10)].terrain=535;w.cells[worldIndex(11,10)].overlay=0x4800;w.cells[worldIndex(12,10)].overlay=0;
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));await page.locator('#viewport').evaluate(v=>v.scrollTo(0,0));
  await tool(page,'Paved road');await click(page,10,10);await expect(page.locator('#construction-result')).toContainText('not enough cash');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await click(page,11,10);await expect(page.locator('#construction-result')).toContainText('Town land');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tool(page,'Fence');await click(page,12,10);await expect(page.locator('#construction-result')).toContainText('Buy this land');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tool(page,'Paved road');await move(page,14,10);await page.mouse.down();const p=await coords(page,14,10);
  await page.mouse.move(p.x+2,p.y+2,{steps:5});await page.mouse.move(p.x-2,p.y-2,{steps:5});await page.mouse.up();
  g.dispatch({type:'network',tool:'road-150',x:14,y:10});await expect(page.locator('#construction-result')).toHaveText('Paved road placed for $30.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.keyboard.press('Escape');await expect(page.locator('#cancel-construction')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('release outside the viewport, pointer cancellation, blur and Escape stop a stroke without undoing completed cells',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));await page.locator('#viewport').evaluate(v=>v.scrollTo(0,0));
  for(const [y,stop] of [[10,'outside'],[12,'cancel'],[14,'blur'],[16,'escape']] as const){
    await tool(page,'Dirt road');await move(page,10,y);await page.mouse.down();g.dispatch({type:'network',tool:'road-161',x:10,y});
    if(stop==='outside'){await page.mouse.move(400,8);await page.mouse.up();}
    else if(stop==='cancel')await page.locator('#world').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true,pointerType:'mouse'});
    else if(stop==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    else await page.keyboard.press('Escape');
    await move(page,11,y);await page.mouse.up();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
    await expect(page.getByRole('dialog',{name:'Examine',exact:true})).toBeHidden();
  }
  await tool(page,'Fence');await page.locator('#window-buy').click();await expect(page.locator('#cancel-construction')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('initial valve press consumes construction and gate press toggles before placement; dragged-over valves are not toggled',async({page})=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;w.cells[worldIndex(10,10)].terrain=188;w.cells[worldIndex(10,12)].terrain=122;w.cells[worldIndex(11,14)].terrain=122;
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));await page.locator('#viewport').evaluate(v=>v.scrollTo(0,0));
  await tool(page,'Dirt road');await click(page,10,10);g.dispatch({type:'network',tool:'open-gate',x:10,y:10});g.dispatch({type:'network',tool:'road-161',x:10,y:10});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tool(page,'Ditch');await move(page,10,12);await page.mouse.down();await move(page,11,12,5);await page.mouse.up();g.dispatch({type:'toggle-valve',x:10,y:12});
  await expect(page.locator('#construction-result')).toHaveText('Valve closed.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await click(page,11,12);g.dispatch({type:'irrigation',tool:'ditch',x:11,y:12});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await move(page,10,14);await page.mouse.down();await move(page,11,14,5);await page.mouse.up();g.dispatch({type:'irrigation',tool:'ditch',x:10,y:14});g.dispatch({type:'irrigation',tool:'ditch',x:11,y:14});
  expect(g.getSnapshot().scenario.cells[worldIndex(11,14)].terrain).toBe(122);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('touch construction at2x uses captured map coordinates and cancellation stops further tiles',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
  await reveal(page,'#zoom');await page.locator('#zoom').selectOption('2');await tool(page,'Dirt road');await page.locator('#viewport').evaluate(v=>v.scrollTo(20*32,20*32));
  const a=await coords(page,25,25),b=await coords(page,26,25),session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  for(let i=1;i<=4;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/4,y:a.y}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  for(const x of [25,26])g.dispatch({type:'network',tool:'road-161',x,y:25});
  await move(page,27,25);expect(await save(page)).toEqual(JSON.parse(g.save(4)));await session.detach();
});
