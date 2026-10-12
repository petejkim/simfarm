import {readSaveText} from '../support/save-file';
import { focusEdit } from '../support/workspace';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { readArchive } from '../../src/formats/archive';
import { readPalette,decodePlanar } from '../../src/formats/graphics';
async function save(page:Page){const d=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await d).path())!));}
async function point(page:Page,x:number,y:number){await focusEdit(page);await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-30)*16,Math.max(0,p.y-20)*16),{x,y});const r=(await page.locator('#world').boundingBox())!;await page.mouse.click(r.x+x*16+8,r.y+y*16+8);}
async function load(page:Page,text:string){await page.goto('/');await page.locator('#load-farm-file').setInputFiles({name:'examine.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}

test('View object shows original building card, exact1× photo, HTML captions and canonical interior controls',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'build',buildingType:67,x:40,y:40});g.dispatch({type:'buy-equipment',equipmentType:0,x:40,y:40});
  expect(g.getSnapshot().lastEquipmentPurchaseResult?.ok).toBe(true);
  const initial=g.save(4);await load(page,initial);await page.getByRole('button',{name:'View object',exact:true}).click();await point(page,40,40);
  const dialog=page.getByRole('dialog',{name:'Examine',exact:true});await expect(dialog).toBeVisible();
  expect(await dialog.locator('.examine-window').boundingBox()).toEqual({x:32,y:80,width:208,height:192});
  await expect(dialog.locator('[data-kind=building]')).toBeVisible();await expect(page.locator('#examine-text')).toHaveText('Large Shed');
  expect(await dialog.locator('canvas').boundingBox()).toEqual({x:32,y:80,width:208,height:192});
  const source=(s:string)=>readFileSync(new URL('../../../simfarm-dos/'+s,import.meta.url)),a=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  const asset=(s:string)=>a.find(e=>e.name===s)!.bytes,card=g.getSnapshot().scenario.buildingDefinitions[3].bytes[11];
  const pixels=decodePlanar(asset('alltiles.btl').subarray(22+card*3586,22+card*3586+3584),112,64,readPalette(asset('simfarm.pal'))).rgba;
  expect(await dialog.locator('canvas').evaluate((c:HTMLCanvasElement)=>[...c.getContext('2d')!.getImageData(48,8,112,64).data])).toEqual([...pixels]);
  await page.screenshot({path:'artifacts/browser-examine-building.png'});expect(await save(page)).toEqual(JSON.parse(initial));
  await page.locator('#examine-building').click();g.dispatch({type:'toggle-building-interior',x:40,y:40,slot:1});
  await expect(dialog.locator('[data-kind=equipment]')).toBeVisible();await expect(page.locator('#examine-text')).toHaveText('Tractor');
  await expect(page.locator('#examine-value')).toHaveText(`$${g.getSnapshot().scenario.equipmentDefinitions[0].price}`);
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));await page.screenshot({path:'artifacts/browser-examine-equipment.png'});
  const title=dialog.locator('.game-window-title');await title.focus();await page.keyboard.press('ArrowRight');expect(await dialog.boundingBox()).toMatchObject({x:42,y:64});
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await point(page,40,40);expect(await dialog.boundingBox()).toMatchObject({x:42,y:64});
  await page.locator('#examine-building').click();g.dispatch({type:'toggle-building-interior',x:40,y:40,slot:1});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await expect(page.getByRole('button',{name:'Object actions',exact:true})).toHaveCount(0);
});

test('Examine covers ground machinery, livestock, chemicals and terrain without mutating farm state',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'buy-equipment',equipmentType:0,x:40,y:40});g.dispatch({type:'buy-livestock',productType:161,x:45,y:40});
  g.dispatch({type:'build',buildingType:66,x:50,y:40});
  g.dispatch({type:'buy-crop-supply',productType:220,x:50,y:40});expect(g.getSnapshot().lastCropSupplyPurchaseResult?.ok).toBe(true);
  g.dispatch({type:'toggle-building-interior',x:50,y:40,slot:1});
  const before=g.save(4);await load(page,before);await page.getByRole('button',{name:'View object',exact:true}).click();
  for(const [x,kind] of [[40,'equipment'],[45,'animal'],[50,'chemical'],[55,'terrain']] as const){
    await point(page,x,40);await expect(page.locator(`.examine-window[data-kind=${kind}]`)).toBeVisible();
    if(kind!=='terrain')await expect(page.locator('.examine-condition')).toBeVisible();
    expect(await save(page)).toEqual(JSON.parse(before));
  }
  await page.reload();await page.locator('#load-farm-file').setInputFiles({name:'examine.json',mimeType:'application/json',buffer:Buffer.from(before)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await point(page,40,40);await expect(page.locator('#examine-text')).toHaveText('Tractor');expect(await save(page)).toEqual(JSON.parse(before));
});

test('missing Examine artwork stops asset loading before play',async({page})=>{
  await page.route('**/assets/examine-window.png',r=>r.abort());await page.goto('/');
  await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});

test('long original crop descriptions stay inside Examine and remain keyboard-scrollable in full',async({page})=>{
  const {cropPlantTile}=await import('../../src/formats/crop-slots');const {worldIndex}=await import('../../src/formats/scenario');
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops),state=g.getSnapshot();
  const crop=[...browserCrops].sort((a,b)=>b.description.length-a.description.length)[0],slot=state.scenario.cropFiles.indexOf(`${crop.id}.crp`);
  const saved=JSON.parse(g.save(4));
  const {readNativeSave,writeNativeSave}=await import('../../src/formats/native-save');const fixture=readNativeSave(JSON.stringify(saved));
  const cell=fixture.state.scenario.cells[worldIndex(55,40)];cell.terrain=cropPlantTile(slot);cell.overlay=0;
  const initial=writeNativeSave(fixture.state,4);await load(page,initial);await point(page,55,40);
  const text=page.locator('#examine-text');await expect(text).toHaveText(crop.description);
  const box=(await text.boundingBox())!,frame=(await page.locator('.examine-window').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(frame.x);expect(box.x+box.width).toBeLessThanOrEqual(frame.x+frame.width);
  expect(box.y+box.height).toBeLessThanOrEqual(frame.y+frame.height-16);
  expect(await text.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  expect(await text.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
  await text.focus();await page.keyboard.press('End');await expect.poll(()=>text.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  expect(await save(page)).toEqual(JSON.parse(initial));await page.screenshot({path:'artifacts/browser-examine-text.png'});
});
