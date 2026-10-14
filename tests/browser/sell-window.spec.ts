import {readSaveText} from '../support/save-file';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { expectCropPhoto } from '../support/crop-photo';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { GameSimulation } from '../support/game';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'sell.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}

test('original Sell browses three rows, excludes rentals, explains busy machinery and sells the selected item with exact continuation',async({page})=>{
  const game=shopFixture().load().withAllCrops(browserCrops);
  for(let i=0;i<7;i++)game.dispatch({type:'buy-equipment',equipmentType:0,x:10+i*2,y:10});
  game.dispatch({type:'buy-livestock',productType:161,x:10,y:15});
  const state=readNativeSave(game.save(4)).state;state.scenario.equipment[1].flags|=64;state.scenario.equipment[2].flags|=1;
  const original=writeNativeSave(state,4),expected=GameSimulation.load(original,browserCrops).simulation;
  await start(page);await load(page,original);await page.locator('#window-sell').click();
  const catalog=page.getByRole('region',{name:'Sell catalog'});
  await expect(catalog).toContainText('NOTHINGFOR SALE');await expect(page.locator('#catalog-sell')).toBeDisabled();
  await catalog.getByRole('button',{name:'Machinery',exact:true}).click();
  await expect(page.getByRole('option')).toHaveCount(3);
  await expect(page.locator('#sell-position')).toHaveText('Item: 1 of 6');
  await expect(page.locator('#catalog-sell')).toBeDisabled(); // machine in use
  await catalog.getByRole('button',{name:'Next item'}).click();await expect(page.locator('#catalog-sell')).toBeEnabled();
  await expect(page.locator('.sell-row[aria-selected=true]')).toHaveAttribute('data-slot','3');
  await expect(page.locator('.condition-letter').first()).toHaveText('A');await expect(page.locator('.condition-word').first()).toHaveText('HIGH');
  await catalog.focus();await page.keyboard.press('End');await expect(page.locator('#sell-position')).toHaveText('Item: 6 of 6');
  expect(await page.locator('.sell-row').evaluateAll(els=>els.map(e=>e.getAttribute('data-slot')))).toEqual(['5','6','7']);
  await expect(catalog.getByRole('button',{name:'Next item'})).toBeDisabled();
  // Shared frame around a 176×248 client built from components; no background bitmap or canvas.
  await expect(catalog.locator('img,canvas')).toHaveCount(0);
  expect(await catalog.locator('.sunken-inset').count()).toBe(2); // photo, sale list
  await expect(page.locator('#catalog-sell')).toHaveCSS('font-size','10px');await expect(page.locator('#catalog-sell')).toHaveText('SELL');
  // Each row shows its item graphic as tile sprites (here masked tile 848 = masked atlas 0,0), then badge and price.
  const tile=page.locator('.sell-row').first().locator('.sell-tiles .sprite').first();
  expect(await tile.evaluate(el=>[getComputedStyle(el).backgroundImage.endsWith('/assets/masked-tiles.png")'),getComputedStyle(el).backgroundPosition])).toEqual([true,'0px 0px']); // masked sheet file, tile 0
  expect(await page.locator('.sell-row').first().evaluate(el=>[...el.children].map(c=>c.className.split(' ')[0]))).toEqual(['sell-tiles','condition-badge','sell-price','sale-accessible-detail']);
  await page.screenshot({path:'artifacts/browser-sell-catalog.png'});
  expect(await save(page)).toEqual(JSON.parse(original));
  await page.locator('#catalog-sell').click();expected.dispatch({type:'sell-asset',kind:'equipment',slot:7});
  await expect(page.locator('#sell-position')).toHaveText('Item: 5 of 5');
  expect(await save(page)).toEqual(JSON.parse(expected.save(4)));
  await catalog.getByRole('button',{name:'Livestock',exact:true}).click();await expect(page.locator('#sell-item-name')).toHaveText('Cow');
  await page.locator('#catalog-sell').click();expected.dispatch({type:'sell-asset',kind:'animal',slot:1});
  await expect(page.locator('#catalog-sell')).toBeDisabled();
  expect(await save(page)).toEqual(JSON.parse(expected.save(4)));
});

test('Sell handles all24 crop identities, live prices, last-lot removal and source-sized movable controls',async({page})=>{
  const game=shopFixture().load().withAllCrops(browserCrops),state=readNativeSave(game.save(4)).state;
  for(let i=0;i<24;i++){
    const item=state.scenario.inventory[i+1],v=new DataView(item.bytes.buffer,item.bytes.byteOffset,item.bytes.byteLength);
    v.setUint16(0,168+i,true);v.setUint16(2,300,true);v.setUint16(4,(i%4)*16384,true);item.bytes[8]=10+i;item.bytes[9]=20;item.bytes[10]=32;state.scenario.harvestDefinitions[i].count=1;
  }
  const original=writeNativeSave(state,4),expected=GameSimulation.load(original,browserCrops).simulation;
  await start(page);await load(page,original);await page.locator('#window-sell').click();
  const catalog=page.getByRole('region',{name:'Sell catalog'});const names=new Set<string>();
  for(let i=0;i<24;i++){
    names.add((await page.locator('#sell-item-name').textContent())!);
    await expectCropPhoto(catalog.locator('.sell-card .sprite'),state.scenario.cropFiles[i].slice(0,-4));
    if(i<23)await catalog.getByRole('button',{name:'Next item'}).click();
  }
  expect(names.size).toBe(24);await expect(page.locator('#sell-position')).toHaveText('Item: 24 of 24');
  const before=expected.getSnapshot().scenario.farm;
  await page.locator('#catalog-sell').click();expected.dispatch({type:'sell-harvest',inventorySlot:24});
  const after=readNativeSave(JSON.stringify(await save(page))).state.scenario.farm;
  expect(after.cropIncome-before.cropIncome).toBe(after.cash-before.cash);
  expect(after.salesAccumulator-before.salesAccumulator).toBe(after.cash-before.cash);
  await expect(page.locator('#harvest-stock')).toHaveText('23 stored harvests');
  expect(await save(page)).toEqual(JSON.parse(expected.save(4)));
  await page.getByRole('dialog',{name:'Sell',exact:true}).locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  await catalog.getByRole('button',{name:'CLOSE',exact:true}).click();await page.locator('#window-sell').click();
  await page.reload();await load(page,expected.save(4));
});

test('condition badges share one clean ring with a centred shadowed letter and 8px word in Sell and Schedule',async({page})=>{
  const {chooseField}=await import('../support/workspace');
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const check=async(badge:ReturnType<Page['locator']>)=>{
    
    expect(await badge.evaluate(el=>{const s=getComputedStyle(el);return [s.backgroundImage.includes('sell-condition.png'),s.backgroundPosition];})).toEqual([true,'0% 0%']);
    const letter=badge.locator('.condition-letter'),word=badge.locator('.condition-word');
    expect(await letter.evaluate(el=>{const s=getComputedStyle(el);return [s.textShadow,s.justifyContent,s.alignItems];})).toEqual(['rgb(130, 130, 130) 1px 1px 0px','center','center']);
    expect(await word.evaluate(el=>{const s=getComputedStyle(el);return [s.fontSize,s.fontWeight,s.webkitTextStroke||`${s.getPropertyValue('-webkit-text-stroke-width')} ${s.getPropertyValue('-webkit-text-stroke-color')}`,s.paintOrder,s.justifyContent,s.alignItems];})).toEqual(['8px','700','2px rgb(194, 194, 194)','stroke','center','center']);
  };
  await chooseField(page,1);await check(page.locator('.schedule-quality'));
  await page.locator('#window-sell').click();await page.getByRole('button',{name:'Machinery',exact:true}).click();await check(page.locator('.sell-condition').first());
});
