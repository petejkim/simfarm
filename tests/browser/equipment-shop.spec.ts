import {readSaveText} from '../support/save-file';
import { farmSnapshot } from '../support/field-checkpoint';
import { clickFarmTile, setAutoDoze } from '../support/field-actions';
import { reveal, expectFarmCash } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { worldIndex } from '../../src/formats/scenario';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function selectMachine(page:Page,type:number){
  await reveal(page,'#viewport');await page.locator('#window-buy').click();
  const catalog=page.getByRole('region',{name:'Buy catalog'});await catalog.getByRole('button',{name:'Machinery',exact:true}).click();
  const index=[0,1,2,3,4,5,7,8].indexOf(type);if(index<0)throw new Error('Machine not in original catalog');
  for(let i=0;i<index;i++)await catalog.getByRole('button',{name:'Next item'}).click();
  await page.locator('#catalog-buy').click();await catalog.getByRole('button',{name:'CLOSE',exact:true}).click();
}
async function save(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readSaveText(path));
}
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'equipment.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}

test('original Buy purchases ground sprites and stored machines with exact saved continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = shopFixture(), game = f.load().withAllCrops(browserCrops);
  game.dispatch({ type: 'build', buildingType: 66, x: 20, y: 20 });
  await page.goto('/'); await load(page, game.save(4));
  await selectMachine(page,0);await clickFarmTile(page,10,10);game.dispatch({type:'buy-equipment',equipmentType:0,x:10,y:10});
  await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  await clickFarmTile(page,10,10);await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  await selectMachine(page,4);await clickFarmTile(page,21,20);game.dispatch({type:'buy-equipment',equipmentType:4,x:21,y:20});
  await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  const machines=(await farmSnapshot(page)).scenario.equipment.filter(e=>e.active);expect(machines).toHaveLength(2);expect(machines.every(e=>!(e.flags&64))).toBe(true);
  const path = 'artifacts/browser-equipment-shop.simfarm.json'; expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, game.save(4));
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal')), ground = decodePlanar(asset('ega16til.til').subarray(15 * 128, 16 * 128), 16, 16, palette).rgba;
  const tractor = decodePlanar(asset('mskdtile.til').subarray(0, 128), 16, 16, palette, 7).rgba;
  for (let p = 0; p < ground.length; p += 4) if (tractor[p + 3]) ground.set(tractor.subarray(p, p + 4), p);
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(160, 160, 16, 16).data))).toEqual(Array.from(ground));
  for (let d = 0; d < 7; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, path)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('machinery shop explains cash, trees and incompatible storage and fits a narrow screen', async ({ page }) => {
  const f = shopFixture(); f.state.scenario.farm.cash = 425; f.state.scenario.cells[worldIndex(10, 10)].terrain = 535;
  const game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await selectMachine(page,0);await clickFarmTile(page,10,10);
  expect(await save(page,'artifacts/browser-equipment-blocked.simfarm.json')).toEqual(JSON.parse(game.save(4)));
  await setAutoDoze(page,true);game.dispatch({type:'set-auto-clear',enabled:true});
  await selectMachine(page,7);await clickFarmTile(page,10,10);await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  expect(await save(page,'artifacts/browser-equipment-cash.simfarm.json')).toEqual(JSON.parse(game.save(4)));
  await selectMachine(page,0);await clickFarmTile(page,10,10);
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  await expect(page.locator('#farm-cash')).toHaveText('$0');
  expect(await save(page, 'artifacts/browser-equipment-shop-clearing.simfarm.json')).toEqual(JSON.parse(game.save(4)));
  const storage = shopFixture(), stored = storage.load().withAllCrops(browserCrops); stored.dispatch({ type: 'build', buildingType: 64, x: 20, y: 20 });
  await load(page,stored.save(4));await selectMachine(page,0);await clickFarmTile(page,20,20);
  expect(await save(page,'artifacts/browser-equipment-storage-rejected.simfarm.json')).toEqual(JSON.parse(stored.save(4)));
  await page.setViewportSize({width:1280,height:844});await clickFarmTile(page,22,20);stored.dispatch({type:'buy-equipment',equipmentType:0,x:22,y:20});
  await expectFarmCash(page,stored.getSnapshot().scenario.farm.cash);
  expect(await save(page,'artifacts/browser-equipment-ground.simfarm.json')).toEqual(JSON.parse(stored.save(4)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-equipment-shop.png', fullPage: true });
});
