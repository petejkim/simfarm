import {readSaveText} from '../support/save-file';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { GameSimulation } from '../support/game';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}
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
  expect(await catalog.boundingBox()).toEqual({x:128,y:96,width:192,height:256});
  await expect(catalog).toContainText('NOTHINGFOR SALE');await expect(page.locator('#catalog-sell')).toBeDisabled();
  await catalog.getByRole('button',{name:'Machinery',exact:true}).click();
  await expect(page.getByRole('option')).toHaveCount(3);
  await expect(page.locator('#sell-position')).toHaveText('Item: 1 of 6');
  await expect(page.locator('#catalog-sell')).toBeDisabled();await expect(page.getByRole('status')).toContainText(['This machine is in use. Finish its work before selling.']);
  await catalog.getByRole('button',{name:'Next item'}).click();await expect(page.locator('#catalog-sell')).toBeEnabled();
  await expect(page.locator('.sell-row[aria-selected=true]')).toHaveAttribute('data-slot','3');
  await expect(page.locator('.condition-letter').first()).toHaveText('A');await expect(page.locator('.condition-word').first()).toHaveText('HIGH');
  await catalog.focus();await page.keyboard.press('End');await expect(page.locator('#sell-position')).toHaveText('Item: 6 of 6');
  expect(await page.locator('.sell-row').evaluateAll(els=>els.map(e=>e.getAttribute('data-slot')))).toEqual(['5','6','7']);
  await expect(catalog.getByRole('button',{name:'Next item'})).toBeDisabled();
  expect(await page.locator('.sell-preview').boundingBox()).toMatchObject({width:192,height:256});
  await expect(page.locator('#catalog-sell')).toHaveCSS('font-size','10px');
  const source=(name:string)=>readFileSync(new URL('../../../simfarm-dos/'+name,import.meta.url));
  const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(name:string)=>archive.find(e=>e.name===name)!.bytes;
  const graphic=decodePlanar(asset('mskdtile.til').subarray(0,128),16,16,readPalette(asset('simfarm.pal')),7);
  // Canvas compositing zeros RGB for fully transparent pixels.
  for(let p=0;p<graphic.rgba.length;p+=4)if(!graphic.rgba[p+3])graphic.rgba.fill(0,p,p+4);
  expect(await page.locator('.sell-preview').evaluate((el:HTMLCanvasElement)=>Array.from(el.getContext('2d')!.getImageData(48,104,16,16).data))).toEqual(Array.from(graphic.rgba));
  await page.screenshot({path:'artifacts/browser-sell-catalog.png'});
  expect(await save(page)).toEqual(JSON.parse(original));
  await page.locator('#catalog-sell').click();expected.dispatch({type:'sell-asset',kind:'equipment',slot:7});
  await expect(page.locator('#sell-position')).toHaveText('Item: 5 of 5');
  expect(await save(page)).toEqual(JSON.parse(expected.save(4)));
  await catalog.getByRole('button',{name:'Livestock',exact:true}).click();await expect(page.locator('#sell-item-name')).toHaveText('Cow');
  await page.locator('#catalog-sell').click();expected.dispatch({type:'sell-asset',kind:'animal',slot:1});
  await expect(page.locator('#catalog-sell')).toBeDisabled();await expect(page.locator('#catalog-sale-result')).toContainText('Animal sold');
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
  for(let i=0;i<24;i++){names.add((await page.locator('#sell-item-name').textContent())!);if(i<23)await catalog.getByRole('button',{name:'Next item'}).click();}
  expect(names.size).toBe(24);await expect(page.locator('#sell-position')).toHaveText('Item: 24 of 24');
  await page.locator('#catalog-sell').click();expected.dispatch({type:'sell-harvest',inventorySlot:24});
  await expect(page.locator('#sale-result')).toContainText('Harvest sold');await expect(page.locator('#harvest-stock')).toHaveText('23 stored harvests');
  expect(await save(page)).toEqual(JSON.parse(expected.save(4)));
  await page.getByRole('dialog',{name:'Sell',exact:true}).locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  expect(await catalog.boundingBox()).toMatchObject({x:138,width:192,height:256});
  await catalog.getByRole('button',{name:'CLOSE',exact:true}).click();await page.locator('#window-sell').click();
  expect(await catalog.boundingBox()).toMatchObject({x:138});
  await page.reload();await load(page,expected.save(4));await expect(page.locator('#sale-result')).toHaveCount(0);
});
