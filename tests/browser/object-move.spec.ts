import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { supplyMovementFixture } from '../support/supply-movement';
import { browserCrops } from '../support/crop-catalog';
import { checkEquipmentPickup } from '../../src/simulation/manual-equipment-move';
import { checkSupplyPickup } from '../../src/simulation/manual-supply-move';
import { readNativeSave,writeNativeSave } from '../../src/formats/native-save';
import { createInventoryItem } from '../../src/simulation/harvest-storage';
import { cropPlantTile,cropHarvestTile } from '../../src/formats/crop-slots';
import { worldIndex } from '../../src/formats/scenario';
import { reveal } from '../support/workspace';
import { GameSimulation } from '../support/game';
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'move.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await p).path())!,'utf8'));}
async function point(page:Page,x:number,y:number){await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-20)*16,Math.max(0,p.y-15)*16),{x,y});const r=(await page.locator('#world').boundingBox())!;await page.mouse.click(r.x+x*16+8,r.y+y*16+8);}
async function move(page:Page){await page.getByRole('button',{name:'Move object',exact:true}).click();await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');}

test('Move object picks stored machinery directly, cancels without withdrawal, rejects unowned land and queues saved travel',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;f.state.scenario.cells[worldIndex(60,60)].overlay=0;
  const g=f.load().withAllCrops(browserCrops);g.dispatch({type:'build',buildingType:67,x:20,y:20});g.dispatch({type:'build',buildingType:67,x:40,y:40});g.dispatch({type:'buy-equipment',equipmentType:4,x:20,y:20});
  await page.goto('/');await load(page,g.save(4));await move(page);await point(page,20,21);
  await expect(page.locator('#object-move-result')).toContainText('Open the building');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.getByRole('button',{name:'View object',exact:true}).click();await point(page,20,21);await page.locator('#examine-building').click();g.dispatch({type:'toggle-building-interior',x:20,y:21,slot:1});
  await move(page);await point(page,20,21);await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','drop');await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('Choose a destination.');
  await expect(page.locator('[data-window=actions]')).toBeHidden();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.keyboard.press('Escape');await expect(page.locator('#cancel-object-move')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await move(page);await point(page,20,21);await point(page,60,60);await expect(page.locator('#object-move-result')).toHaveText('Choose a destination on your land.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  const selected=checkEquipmentPickup(g.getSnapshot().scenario,20,21);if(!selected.ok)throw new Error('Missing machine');
  await point(page,40,40);g.dispatch({type:'move-equipment',selected,x:40,y:40});await expect(page.locator('#object-move-result')).toContainText('Movement ordered');await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));await page.screenshot({path:'artifacts/browser-object-move.png'});
  await page.reload();await load(page,g.save(4));await expect(page.locator('#cancel-object-move')).toHaveCount(0);
  for(let i=0;i<8;i++){await reveal(page,'#next-day');await page.locator('#next-day').click();g.dispatch({type:'advance-day'});}
  expect(g.getSnapshot().scenario.equipment[1].flags&4).toBe(4);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('one Move object tool transfers every supply category, retains rejected/cancelled state and discards empty feed',async({page})=>{
  const f=supplyMovementFixture();f.state.disasters.enabled=false;f.state.scenario.cells[worldIndex(60,60)].overlay=0;
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));await move(page);
  for(const x of [10,12,14,16,18]){
    const selected=checkSupplyPickup(g.getSnapshot().scenario,g.getSnapshot().finances,x,10);if(!selected.ok)throw new Error('Missing supply');
    await point(page,x,10);await expect(page.locator('#map-tool-hint')).toContainText(`Move ${selected.kind}`);await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('Choose a destination.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
    await point(page,60,60);await expect(page.locator('#object-move-result')).toHaveText('Choose a destination on your land.');
    await point(page,x,20);g.dispatch({type:'move-supply',selected,x,y:20});await expect(page.locator('#object-move-result')).toHaveText('Supply moved.');expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  await point(page,10,20);await page.getByRole('button',{name:'Cancel move',exact:true}).click();expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  const state=readNativeSave(g.save(4)).state,feed=state.scenario.inventory.find(i=>i.active&&i.type===300)!;feed.bytes[2]=0;feed.bytes[3]=0;
  const saved=writeNativeSave(state,4);await load(page,saved);
  const native=GameSimulation.load(saved,browserCrops).simulation;
  const selected=checkSupplyPickup(native.getSnapshot().scenario,native.getSnapshot().finances,18,20);if(!selected.ok)throw new Error('Missing empty feed');
  await move(page);await point(page,18,20);await point(page,18,22);native.dispatch({type:'move-supply',selected,x:18,y:22});await expect(page.locator('#object-move-result')).toHaveText('Empty feed discarded.');expect(await save(page)).toEqual(JSON.parse(native.save(4)));
});

test('selection respects busy machinery and switching tools discards the draft without changing the farm',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);g.dispatch({type:'buy-equipment',equipmentType:0,x:40,y:40});
  const state=readNativeSave(g.save(4)).state;state.scenario.equipment[1].flags|=1;const busy=writeNativeSave(state,4);
  await page.goto('/');await load(page,busy);await move(page);await point(page,40,40);await expect(page.locator('#object-move-result')).toHaveText('This machine is in use or already moving.');await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('Cannot move item in use.');expect(await save(page)).toEqual(JSON.parse(busy));
  await load(page,g.save(4));await move(page);await point(page,40,40);await page.getByRole('button',{name:'View object',exact:true}).click();await point(page,40,40);await expect(page.getByRole('dialog',{name:'Examine',exact:true})).toBeVisible();
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));await move(page);await point(page,40,40);await page.locator('#window-buy').click();await expect(page.locator('#cancel-object-move')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
});

test('direct supply selection preserves all24 seed and harvest identities through movement and reload',async({page})=>{
  test.setTimeout(60000);const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops),state=readNativeSave(g.save(4)).state,w=state.scenario;
  for(const c of w.chemicals)c.bytes[2]&=~32;
  for(let slot=0;slot<24;slot++)for(const harvest of [false,true]){
    const x=10+slot*2,y=harvest?20:10,type=(harvest?168:192)+slot;createInventoryItem(w,type,40,9,x,y);
    (harvest?w.harvestDefinitions:w.seedDefinitions)[slot].count++;w.cells[worldIndex(x,y)].terrain=harvest?cropHarvestTile(slot):cropPlantTile(slot);
  }
  const initial=writeNativeSave(state,4),native=GameSimulation.load(initial,browserCrops).simulation;
  await page.goto('/');await load(page,initial);await move(page);
  for(let slot=0;slot<24;slot++)for(const y of [10,20]){
    const x=10+slot*2,selected=checkSupplyPickup(native.getSnapshot().scenario,native.getSnapshot().finances,x,y);if(!selected.ok)throw new Error('Missing crop supply');expect(selected.type).toBe((y===10?192:168)+slot);
    await point(page,x,y);await point(page,x,y+2);native.dispatch({type:'move-supply',selected,x,y:y+2});await expect(page.locator('#object-move-result')).toHaveText('Supply moved.');
  }
  expect(await save(page)).toEqual(JSON.parse(native.save(4)));await page.reload();await load(page,native.save(4));expect(await save(page)).toEqual(JSON.parse(native.save(4)));
});
