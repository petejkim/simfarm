import {readSaveText} from '../support/save-file';
import { test,expect,type Page } from '@playwright/test';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { readNativeSave,writeNativeSave } from '../../src/formats/native-save';
import { worldIndex } from '../../src/formats/scenario';
import { checkEquipmentPickup } from '../../src/simulation/manual-equipment-move';
import { reveal, focusEdit } from '../support/workspace';
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'interaction.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await p).path())!));}
async function pointer(page:Page,x:number,y:number){const zoom=Number(await page.locator('#zoom').inputValue());await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-20)*16*p.zoom,Math.max(0,p.y-15)*16*p.zoom),{x,y,zoom});const r=(await page.locator('#world').boundingBox())!;await page.mouse.move(r.x+(x+.5)*16*zoom,r.y+(y+.5)*16*zoom);}
async function right(page:Page,x:number,y:number){await pointer(page,x,y);await page.mouse.down({button:'right'});await page.mouse.up({button:'right'});}

test('right press opens storage during Move object, release does not retoggle and the selected machine stays protected',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'build',buildingType:67,x:20,y:20});g.dispatch({type:'buy-equipment',equipmentType:4,x:20,y:20});
  await page.goto('/');await load(page,g.save(4));await page.getByRole('button',{name:'Move object',exact:true}).click();
  await pointer(page,20,21);await page.mouse.down({button:'right'});
  await expect(page.locator('#map-interaction-result')).toHaveText('Building opened.');g.dispatch({type:'toggle-building-interior',x:20,y:21,slot:1});
  await page.mouse.up({button:'right'});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');await expect(page.getByRole('dialog',{name:'Examine',exact:true})).toBeHidden();
  await pointer(page,20,21);await page.mouse.down();await page.mouse.up();
  await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','drop');
  const selected=checkEquipmentPickup(g.getSnapshot().scenario,20,21);if(!selected.ok)throw new Error('Missing stored machinery');
  await right(page,20,21);g.dispatch({type:'toggle-building-interior',x:20,y:21,slot:1});
  await expect(page.locator('#map-interaction-result')).toHaveText('Building closed.');await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','drop');
  await pointer(page,40,40);await page.mouse.down();await page.mouse.up();await expect(page.locator('#object-move-result')).toContainText('Open the building');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await right(page,20,21);g.dispatch({type:'toggle-building-interior',x:20,y:21,slot:1});
  // Plain ground, a secondary release and the browser context event cannot submit a movement order.
  await right(page,40,40);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await pointer(page,40,40);await page.mouse.down();await page.mouse.up();g.dispatch({type:'move-equipment',selected,x:40,y:40});
  await expect(page.locator('#object-move-result')).toContainText('Movement ordered');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.reload();await load(page,g.save(4));expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('right-click toggles both gate orientations and every valve state with exact field bits, flags and saved continuation',async({page})=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;
  const field=w.fields[1];field.bytes[7]|=1;field.bytes[10]=field.bytes[11]=11;field.bytes[12]=field.bytes[13]=8;field.bytes[6]=254;
  for(let i=0;i<4;i++){w.cells[worldIndex(10+i*2,10)].terrain=0x8000|122+i;w.cells[worldIndex(10+i*2,24)].terrain=0x8000|188+i;}
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
  for(let i=0;i<4;i++){
    await right(page,10+i*2,10);g.dispatch({type:'toggle-valve',x:10+i*2,y:10});
    await expect(page.locator('#map-interaction-result')).toHaveText(i%2?'Valve opened.':'Valve closed.');
    expect(g.getSnapshot().scenario.fields[1].bytes[6]).toBe(i===0?254:255);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
    await right(page,10+i*2,24);g.dispatch({type:'network',tool:i%2?'close-gate':'open-gate',x:10+i*2,y:24});
    await expect(page.locator('#map-interaction-result')).toHaveText(i%2?'Gate closed.':'Gate opened.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  await expect(page.locator('[data-window=actions]')).toBeHidden();await page.screenshot({path:'artifacts/browser-map-interaction.png'});
  await page.reload();await load(page,g.save(4));expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  for(let i=0;i<3;i++){await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('secondary map coordinates follow zoom and scrolling, ignore middle clicks and preserve default gates',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;f.state.scenario.cells[worldIndex(80,80)].terrain=188;
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
  for(const zoom of ['2','0.5']){
    await reveal(page,'#zoom');await page.locator('#zoom').selectOption(zoom);await focusEdit(page);
    await pointer(page,80,80);await page.mouse.down({button:'middle'});await page.mouse.up({button:'middle'});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
    await right(page,80,80);g.dispatch({type:'network',tool:zoom==='2'?'open-gate':'close-gate',x:80,y:80});
    expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  const state=readNativeSave(g.save(4)).state;state.finances.defaultDecision={status:'pending',originalExitCode:0};
  const blocked=writeNativeSave(state,4);await load(page,blocked);await right(page,80,80);expect(await save(page)).toEqual(JSON.parse(blocked));
});
