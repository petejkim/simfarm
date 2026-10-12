import {readSaveText} from '../support/save-file';
import { focusEdit } from '../support/workspace';
import { test,expect,type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { readArchive } from '../../src/formats/archive';
import { readPalette,decodePlanar } from '../../src/formats/graphics';
async function save(page:Page){const d=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await d).path())!));}
async function point(page:Page,x:number,y:number,button:'left'|'right'='left'){await focusEdit(page);await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-30)*16,Math.max(0,p.y-20)*16),{x,y});const r=(await page.locator('#world').boundingBox())!;await page.mouse.click(r.x+x*16+8,r.y+y*16+8,{button});}
async function load(page:Page,text:string){await page.goto('/');await page.locator('#load-farm-file').setInputFiles({name:'examine.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}

test('View object shows original building card, exact1× photo, HTML captions and canonical interior controls',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'build',buildingType:67,x:40,y:40});g.dispatch({type:'buy-equipment',equipmentType:0,x:40,y:40});
  expect(g.getSnapshot().lastEquipmentPurchaseResult?.ok).toBe(true);
  const initial=g.save(4);await load(page,initial);await page.getByRole('button',{name:'View object',exact:true}).click();await point(page,40,40);
  const dialog=page.getByRole('dialog',{name:'Examine',exact:true});await expect(dialog).toBeVisible();
  // Shared wooden frame (8px sides) around a 192×184 client; no canvas or background bitmap.
  expect(await dialog.locator('.examine-window').boundingBox()).toEqual({x:40,y:80,width:192,height:184});
  await expect(dialog.locator('canvas,img')).toHaveCount(0);
  expect(await dialog.locator('.game-window-body').evaluate(el=>{const s=getComputedStyle(el);return [s.borderLeftWidth,s.borderRightWidth,s.borderBottomWidth,s.borderTopWidth,s.borderImageSource.includes('window-frame.png')];})).toEqual(['8px','8px','8px','0px',true]);
  await expect(dialog.locator('[data-kind=building]')).toBeVisible();await expect(page.locator('#examine-text')).toHaveText('Large Shed');
  // Sunken photo box (source 46,22) holds the buy-cards photo sprite at source (48,24).
  const card=g.getSnapshot().scenario.buildingDefinitions[3].bytes[11],photo=dialog.locator('.examine-card');
  expect(await dialog.locator('.examine-photo').boundingBox()).toEqual({x:78,y:86,width:116,height:68});
  expect(await photo.boundingBox()).toEqual({x:80,y:88,width:112,height:64});
  expect(await photo.evaluate(el=>[getComputedStyle(el).backgroundPosition,getComputedStyle(el).backgroundImage.includes('buy-cards.png')])).toEqual([`${-(card%8)*112}px ${-Math.floor(card/8)*64}px`,true]);
  expect(await dialog.locator('.examine-photo').evaluate(el=>[getComputedStyle(el).borderTopColor,getComputedStyle(el).borderBottomColor,getComputedStyle(el).borderTopWidth])).toEqual(['rgb(130, 130, 130)','rgb(255, 255, 255)','2px']);
  await page.screenshot({path:'artifacts/browser-examine-building.png'});expect(await save(page)).toEqual(JSON.parse(initial));
  // Right-click opens the building on the map (source interaction); Examine then shows its contents.
  await point(page,40,40,'right');g.dispatch({type:'toggle-building-interior',x:40,y:40,slot:1});
  await expect(dialog.locator('[data-kind=equipment]')).toBeVisible();await expect(page.locator('#examine-text')).toHaveText('Tractor');
  await expect(page.locator('#examine-value')).toHaveText(`$${g.getSnapshot().scenario.equipmentDefinitions[0].price}`);
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));await page.screenshot({path:'artifacts/browser-examine-equipment.png'});
  const title=dialog.locator('.game-window-title');await title.focus();await page.keyboard.press('ArrowRight');expect(await dialog.boundingBox()).toMatchObject({x:42,y:64});
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await point(page,40,40);expect(await dialog.boundingBox()).toMatchObject({x:42,y:64});
  await point(page,40,40,'right');g.dispatch({type:'toggle-building-interior',x:40,y:40,slot:1});expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await expect(page.getByRole('button',{name:'Object actions',exact:true})).toHaveCount(0);await expect(page.locator('#examine-building')).toHaveCount(0);
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
  // The scrolling text box is exactly the sunken information inset's interior (client 16,80; source 24,96).
  expect(box).toEqual({x:frame.x+16,y:frame.y+80,width:160,height:96});
  expect(await text.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  expect(await text.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
  await text.focus();await page.keyboard.press('End');await expect.poll(()=>text.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);
  expect(await save(page)).toEqual(JSON.parse(initial));await page.screenshot({path:'artifacts/browser-examine-text.png'});
});

test('choosing another palette action closes Examine; View object keeps it open',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'build',buildingType:67,x:40,y:40});await load(page,g.save(4));
  const dialog=page.getByRole('dialog',{name:'Examine',exact:true}),palette=page.getByRole('toolbar',{name:'Edit tools'});
  for(const name of ['Fence','Plant','Spray']){
    await palette.getByRole('button',{name:'View object',exact:true}).click();await point(page,40,40);await expect(dialog).toBeVisible();
    await palette.getByRole('button',{name:'View object',exact:true}).click();await expect(dialog).toBeVisible();
    await palette.getByRole('button',{name,exact:true}).click();await expect(dialog).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});

test('examining a non-field object closes the field Schedule window',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'create-field',x:30,y:40,cropSlot:0});expect(g.getSnapshot().lastNewFieldResult?.ok).toBe(true);
  g.dispatch({type:'build',buildingType:67,x:50,y:40});await load(page,g.save(4));
  const schedule=page.getByRole('dialog',{name:'Schedule',exact:true}),examine=page.getByRole('dialog',{name:'Examine',exact:true});
  await page.getByRole('button',{name:'View object',exact:true}).click();
  await point(page,32,42);await expect(schedule).toBeVisible();
  await point(page,50,40);await expect(examine).toBeVisible();await expect(schedule).toBeHidden();
  await point(page,32,42);await expect(schedule).toBeVisible();
});
