import {readSaveText} from '../support/save-file';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {disasterFixture} from '../support/disasters';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { reveal, openWindow, focusEdit, expectPaletteAction, expectSelectedField } from '../support/workspace';
import { readArchive } from '../../src/formats/archive';
import { readPalette, decodePlanar } from '../../src/formats/graphics';
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'field-tools.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}
async function point(page:Page,x:number,y:number){
  await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-10)*16,Math.max(0,p.y-10)*16),{x,y});
  const r=(await page.locator('#world').boundingBox())!;await page.mouse.click(r.x+x*16+8,r.y+y*16+8);
}
async function plant(page:Page,slot:number){
  await page.getByRole('button',{name:'Plant',exact:true}).click();
  await page.locator(`[data-field-tool="${slot}"]`).click();
  await expect(page.locator('#world')).toHaveCSS('cursor',/edit-bulldoze\.png.*0 0, crosshair/);
}

test('original Plant and Spray popup geometry, real labels, source icons and keyboard cancellation preserve saves',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');const before=await save(page);
  await page.getByRole('button',{name:'Plant',exact:true}).click();const menu=page.getByRole('menu',{name:'Plant Field',exact:true});
  expect(await menu.boundingBox()).toEqual({x:48,y:112,width:336,height:160});
  expect(await menu.locator('canvas').boundingBox()).toEqual({x:48,y:112,width:336,height:160});
  await expect(menu.getByRole('menuitem')).toHaveCount(24);await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('ArrowRight');await expect(menu.getByRole('menuitem').nth(8)).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(menu.getByRole('menuitem').nth(9)).toBeFocused();
  const source=(name:string)=>readFileSync(new URL('../../../simfarm-dos/'+name,import.meta.url));
  const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),palette=readPalette(archive.find(e=>e.name==='simfarm.pal')!.bytes);
  // The selected crop icon is CRP's planting image (tile832 slot0), rendered at1×.
  const file=before.scenario.cropFiles[0],bytes=source('CROPS/'+file.toUpperCase());
  const pixels=decodePlanar(bytes.subarray(0x1480,0x1500),16,16,palette).rgba;
  expect(await menu.locator('canvas').evaluate((c:HTMLCanvasElement)=>[...c.getContext('2d')!.getImageData(0,17,16,16).data])).toEqual([...pixels]);
  await page.screenshot({path:'artifacts/browser-plant-menu.png'});
  await expect(menu.getByRole('button',{name:'Next crops'})).toHaveCount(0);
  await page.keyboard.press('ArrowRight');await expect(menu.getByRole('menuitem').nth(17)).toBeFocused();
  await page.keyboard.press('End');await expect(menu.getByRole('menuitem').nth(23)).toBeFocused();
  for(let slot=0;slot<24;slot++){
    const expected=decodePlanar(source('CROPS/'+before.scenario.cropFiles[slot].toUpperCase()).subarray(0x1480,0x1500),16,16,palette).rgba;
    expect(await menu.locator('canvas').evaluate((c:HTMLCanvasElement,i)=>[...c.getContext('2d')!.getImageData(Math.floor(i/8)*112,17+i%8*17,16,16).data],slot)).toEqual([...expected]);
  }
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);expect(await save(page)).toEqual(before);
  await page.getByRole('button',{name:'Spray',exact:true}).click();const spray=page.getByRole('menu',{name:'Spray Field',exact:true});
  expect(await spray.boundingBox()).toEqual({x:48,y:192,width:112,height:88});
  expect(await spray.getByRole('menuitem').allTextContents()).toEqual(['Fertilize','Pesticide','Herbicide','Fungicide']);
  await page.screenshot({path:'artifacts/browser-spray-menu.png'});await page.keyboard.press('End');await page.keyboard.press('Enter');
  await expectPaletteAction(page,'Spray');await expect(page.locator('#world')).toHaveCSS('cursor',/edit-spray\.png.*0 0, crosshair/);await page.keyboard.press('Escape');await expect(page.locator('#world')).toHaveCSS('cursor',/edit-view\.png.*0 0, crosshair/);
  expect(await save(page)).toEqual(before);
});

test('Plant creates all24 crop fields directly, guards boundaries and occupied fields, then restores exact state',async({page})=>{
  test.setTimeout(60000);const fixture=shopFixture();fixture.state.disasters.enabled=false;
  const game=fixture.load().withAllCrops(browserCrops);await page.goto('/');await load(page,game.save(4));
  for(let slot=0;slot<24;slot++){
    await plant(page,slot);const x=5+slot%8*10,y=40+Math.floor(slot/8)*10;
    await point(page,x,y);game.dispatch({type:'create-field',x,y,cropSlot:slot});
    expect(game.getSnapshot().lastNewFieldResult?.ok).toBe(true);
    await expectPaletteAction(page,'View object');
    await expect(page.locator('#world')).toHaveCSS('cursor',/edit-view\.png.*0 0, crosshair/);
  }
  const before=await save(page);expect(before).toEqual(JSON.parse(game.save(4)));
  await plant(page,0);await point(page,5,40);await expectPaletteAction(page,'Plant');
  await point(page,95,95);await expectPaletteAction(page,'Plant');
  await page.keyboard.press('Escape');expect(await save(page)).toEqual(before);
  await page.reload();await load(page,JSON.stringify(before));expect(await save(page)).toEqual(before);
  await page.getByRole('button',{name:'View object',exact:true}).click();await point(page,6,41);
  await expect(page.getByRole('dialog',{name:'Schedule',exact:true})).toBeVisible();await expectSelectedField(page,1);
});

test('Spray applies all four treatments through canonical supplies and busy guards with continued field work',async({page})=>{
  const fixture=shopFixture();fixture.state.disasters.enabled=false;const game=fixture.load().withAllCrops(browserCrops);
  game.dispatch({type:'create-field',x:40,y:40,cropSlot:0});for(let i=0;i<7;i++)game.dispatch({type:'advance-day'});
  expect(game.getSnapshot().scenario.fields[1].state).toBe(4);
  await page.goto('/');await load(page,game.save(4));
  for(const [kind,label] of [['fertilizer','Fertilize'],['pesticide','Pesticide'],['herbicide','Herbicide'],['fungicide','Fungicide']] as const){
    await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();
    await point(page,30,30);await expectPaletteAction(page,'Spray');
    await point(page,42,42);game.dispatch({type:'treat-field',fieldSlot:1,treatment:kind});expect(game.getSnapshot().lastTreatmentResult?.ok).toBe(true);
    await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('');
    const before=await save(page);expect(before).toEqual(JSON.parse(game.save(4)));
    await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();
    await point(page,42,42);await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('Field is busy.');
    await page.keyboard.press('Escape');expect(await save(page)).toEqual(before);
    for(let i=0;i<7;i++){await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});}
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));await openWindow(page,'edit');
  }
});

test('Plant retains failed seed orders without constructing a field or changing a checkpoint',async({page})=>{
  const fixture=shopFixture();fixture.state.scenario.farm.autoBuySeeds=false;
  for(const d of fixture.state.scenario.seedDefinitions)d.count=0;
  const game=fixture.load().withAllCrops(browserCrops),before=JSON.parse(game.save(4));
  await page.goto('/');await load(page,JSON.stringify(before));await page.getByRole('button',{name:'Plant',exact:true}).click();
  await expect(page.locator('[data-field-tool="0"]')).toHaveText('NONE OWNED');await page.locator('[data-field-tool="0"]').click();
  await point(page,40,40);await expectPaletteAction(page,'Plant');
  expect(await save(page)).toEqual(before);await page.locator('#viewport').focus();await page.keyboard.press('Escape');
  await expectPaletteAction(page,'View object');
});


test('Spray shortage status covers all four supplies and cash failure without changing the checkpoint',async({page})=>{
  await page.goto('/');
  for(const autoBuy of [false,true])for(const label of ['Fertilize','Pesticide','Herbicide','Fungicide']){
    const f=disasterFixture(),w=f.state.scenario;w.farm.autoBuySeeds=autoBuy;w.farm.cash=274;
    for(const c of w.chemicals)c.bytes[2]&=~32;
    for(const d of w.chemicalDefinitions)d.count=0;
    const g=f.load().withAllCrops(browserCrops),before=g.save(4);await load(page,before);
    await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();
    await point(page,22,22);const status=page.getByRole('button',{name:'Edit message history'});
    await expect(status).toHaveText('Not enough sprays to spray field.');
    await point(page,22,22);await status.click();
    await expect(page.getByRole('list',{name:'Recent Edit messages'}).locator('li')).toHaveCount(2);
    await page.keyboard.press('Escape');expect(await save(page)).toEqual(JSON.parse(before));
  }
  await page.screenshot({path:'artifacts/browser-treatment-status.png'});
});


test('selected Spray treatment stays active across successful fields and busy rejection until another control is chosen',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const game=f.load().withAllCrops(browserCrops);
  for(const x of [40,50]){game.dispatch({type:'create-field',x,y:40,cropSlot:0});expect(game.getSnapshot().lastNewFieldResult?.ok).toBe(true);}
  for(let i=0;i<7;i++)game.dispatch({type:'advance-day'});
  await page.goto('/');await load(page,game.save(4));
  for(const [kind,label] of [['fertilizer','Fertilize'],['pesticide','Pesticide'],['herbicide','Herbicide'],['fungicide','Fungicide']] as const){
    await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();
    for(const [x,slot] of [[42,1],[52,2]]){
      await point(page,x,42);game.dispatch({type:'treat-field',fieldSlot:slot,treatment:kind});
      expect(game.getSnapshot().lastTreatmentResult?.ok).toBe(true);
      await expectPaletteAction(page,'Spray');
    }
    await point(page,52,42);await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('Field is busy.');
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    await focusEdit(page);await expectPaletteAction(page,'View object');
    for(let i=0;i<7;i++){await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});}
    await openWindow(page,'edit');
  }
  await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:'Fertilize',exact:true}).click();
  await page.getByRole('button',{name:'View object',exact:true}).click();await expectPaletteAction(page,'View object');
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
