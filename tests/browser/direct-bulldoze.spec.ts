import {readSaveText} from '../support/save-file';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bulldozeFixture,bulldozeTargets } from '../support/bulldoze';
import { breedingFixture } from '../support/animal-lifecycle';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { GameSimulation } from '../support/game';
import { checkManualRemoval } from '../../src/simulation/manual-removal';
import { readScenario,worldIndex } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { reveal } from '../support/workspace';
async function load(page:Page,text:string){await page.goto('/');await page.locator('#load-farm-file').setInputFiles({name:'direct-bulldoze.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await p).path())!));}
async function point(page:Page,x:number,y:number,scroll=true){const zoom=Number(await page.locator('#zoom').inputValue());if(scroll)await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x*16*p.z-120),Math.max(0,p.y*16*p.z-120)),{x,y,z:zoom});const r=(await page.locator('#world').boundingBox())!;return{x:r.x+(x+.5)*16*zoom,y:r.y+(y+.5)*16*zoom};}
async function click(page:Page,x:number,y:number){const p=await point(page,x,y);await page.mouse.click(p.x,p.y);}
async function tool(page:Page){await page.getByRole('button',{name:'Bulldoze',exact:true}).click();await expect(page.locator('#cancel-bulldoze')).toBeVisible();await expect(page.locator('[data-window=actions]')).toBeHidden();}
function remove(g:GameSimulation,x:number,y:number){const q=checkManualRemoval(g.getSnapshot().scenario,x,y);if(!q.ok)throw new Error(q.reason);g.dispatch({type:'remove-object',x,y,kind:q.kind,slot:q.slot,tile:q.tile});}

test('direct Bulldoze clears supplies, chemicals and every network family with exact saves and no extra panel',async({page})=>{
  const f=bulldozeFixture(),g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));await tool(page);
  for(const [x,y] of bulldozeTargets){await click(page,x,y);remove(g,x,y);await expect(page.getByRole('dialog',{name:'Message',exact:true})).toHaveCount(0);await expect(page.locator('#bulldoze-result')).toContainText('removed for $25.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));}
  await page.keyboard.press('Escape');await expect(page.locator('#cancel-bulldoze')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.reload();await load(page,g.save(4));for(let day=0;day<8;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('original movable MESSAGE confirmation cancels without mutation, blocks background input and destroys stored contents only on YES',async({page})=>{
  const f=breedingFixture(),g=f.load().withAllCrops(browserCrops);g.dispatch({type:'build',buildingType:67,x:40,y:40});g.dispatch({type:'buy-equipment',equipmentType:0,x:40,y:40});
  await load(page,g.save(4));await tool(page);await click(page,21,21);
  const dialog=page.getByRole('dialog',{name:'Message',exact:true});await expect(dialog).toBeVisible();expect(await dialog.boundingBox()).toEqual({x:192,y:150,width:256,height:192});
  await expect(dialog.locator('#bulldoze-message-text')).toHaveText('Are you sure you want to\ndestroy this structure?');
  expect(await dialog.getByRole('button',{name:'YES',exact:true}).boundingBox()).toEqual({x:232,y:306,width:48,height:24});
  const photo=dialog.locator('.message-portrait');expect(await photo.boundingBox()).toEqual({x:264,y:174,width:112,height:64});
  expect(await dialog.evaluate(d=>(d as HTMLDialogElement).open&&d.matches(':modal'))).toBe(true);
  // A map click outside the modal cannot demolish anything or switch tools.
  await page.mouse.click(700,500);await expect(dialog).toBeVisible();
  const title=dialog.locator('.game-window-title'),r=(await title.boundingBox())!;await page.mouse.move(r.x+120,r.y+8);await page.mouse.down();await page.mouse.move(r.x+180,r.y+48,{steps:4});await page.mouse.up();expect(await dialog.boundingBox()).toMatchObject({x:252,y:190});
  await page.screenshot({path:'artifacts/browser-direct-bulldoze-confirmation.png'});
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.locator('#cancel-bulldoze')).toBeVisible();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await click(page,21,21);await dialog.getByRole('button',{name:'CANCEL',exact:true}).click();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  for(const [x,y] of [[21,21],[41,41]]){await click(page,x,y);await dialog.getByRole('button',{name:'YES',exact:true}).click();remove(g,x,y);await expect(dialog).toHaveCount(0);await expect(page.locator('#bulldoze-result')).toHaveText('Building removed for $25.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));}
  expect(g.getSnapshot().scenario.animals[1].active).toBe(false);expect(g.getSnapshot().scenario.equipment.filter(e=>e.active)).toHaveLength(0);
});

test('busy fields show original text, growing fields ask confirmation, and the modal suspends elapsed time without changing pause state',async({page})=>{
  await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url)),w=readScenario(source('SCEN4.SSM')),crops=w.cropFiles.map(n=>readCrop(n.replace('.crp',''),source('CROPS/'+n.toUpperCase())));w.farm.cash=100000;
  const g=new GameSimulation(w,crops).withAllCrops(browserCrops);g.dispatch({type:'buy-land',regionX:0,regionY:2});g.dispatch({type:'set-auto-clear',enabled:true});g.dispatch({type:'create-field',x:0,y:16,cropSlot:0});
  await load(page,g.save(4));await tool(page);await click(page,1,17);const dialog=page.getByRole('dialog',{name:'Message',exact:true});
  await expect(dialog).toContainText('You cannot bulldoze a field while equipment is operating in it.');await expect(dialog.getByRole('button',{name:'YES',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'OK',exact:true}).click();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});await tool(page);await click(page,1,17);await expect(dialog).toContainText('destroy this field?');await dialog.getByRole('button',{name:'CANCEL',exact:true}).click();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await reveal(page,'#play-pause');await page.locator('#play-pause').click();g.dispatch({type:'set-paused',paused:false});await tool(page);await click(page,1,17);
  await page.clock.runFor(12000);await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'YES',exact:true}).click();remove(g,1,17);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  // The clock resumes naturally; no accumulated12-second catch-up is applied.
  const before=await page.locator('#time-status').textContent();await page.clock.runFor(4016);expect(await page.locator('#time-status').textContent()).not.toBe(before);
});

test('drag clearing stops on leaving Edit or cancellation; primary Bulldoze removes a valve rather than toggling it',async({page})=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;w.farm.cash=100;
  for(let x=10;x<14;x++)w.cells[worldIndex(x,10)].terrain=x===10?122:161;
  w.cells[worldIndex(14,10)].terrain=161;w.cells[worldIndex(14,10)].overlay=0x4800;
  const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));await tool(page);
  let a=await point(page,10,10),b=await point(page,11,10,false);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+2,a.y+2,{steps:4});await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.move(400,8);const c=await point(page,12,10,false);await page.mouse.move(c.x,c.y);await page.mouse.up();
  remove(g,10,10);remove(g,11,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await click(page,14,10);await expect(page.locator('#bulldoze-result')).toContainText('Town-owned');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await reveal(page,'#zoom');await page.locator('#zoom').selectOption('2');await tool(page);a=await point(page,12,10);b=await point(page,13,10,false);const session=await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await session.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.mouse.move(b.x,b.y);remove(g,12,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));await session.detach();
  await click(page,13,10);remove(g,13,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));await click(page,15,10);await expect(page.locator('#bulldoze-result')).toContainText('need $25');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.locator('#window-buy').click();await expect(page.locator('#cancel-bulldoze')).toHaveCount(0);
});


test('Bulldoze cash warning is an original status, respects town priority and stops at the25 boundary',async({page})=>{
  for(const cash of [24,25]){
    const f=shopFixture(),w=f.state.scenario;w.farm.cash=cash;
    w.cells[worldIndex(40,40)].terrain=161;w.cells[worldIndex(41,40)].overlay=0x4800;
    const g=f.load().withAllCrops(browserCrops);await load(page,g.save(4));await tool(page);
    const status=page.getByRole('button',{name:'Edit message history'}),p=await point(page,40,40);
    await page.mouse.move(p.x,p.y);await expect(status).toHaveText('Bulldoze');
    await click(page,41,40);await expect(status).toHaveText('Bulldoze');await expect(page.locator('#bulldoze-result')).toContainText('Town-owned');
    await click(page,40,40);
    if(cash===25){remove(g,40,40);await expect(status).toHaveText('Bulldoze');await click(page,42,40);}
    await expect(status).toHaveText('Not enough money.');await expect(page.getByRole('dialog',{name:'Message',exact:true})).toHaveCount(0);
    await click(page,42,40);await status.click();await expect(page.getByRole('list',{name:'Recent Edit messages'}).locator('li')).toHaveText(['Not enough money.','Bulldoze']);
    await page.keyboard.press('Escape');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  await page.screenshot({path:'artifacts/browser-bulldoze-status.png'});
});
