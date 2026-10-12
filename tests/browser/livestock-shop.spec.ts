import {readSaveText} from '../support/save-file';
import { farmSnapshot } from '../support/field-checkpoint';
import { clickFarmTile, setAutoDoze } from '../support/field-actions';
import { reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { worldIndex } from '../../src/formats/scenario';
import { shopFixture } from '../support/livestock';

async function selectProduct(page:Page,type:number){
  await reveal(page,'#viewport');
  if(type>=299){await page.getByRole('button',{name:type===299?'Trough':'Hay',exact:true}).click();return;}
  await page.locator('#window-buy').click();const catalog=page.getByRole('region',{name:'Buy catalog'});
  await catalog.getByRole('button',{name:'Livestock',exact:true}).click();
  for(let i=0;i<[161,162,163,160].indexOf(type);i++)await catalog.getByRole('button',{name:'Next item'}).click();
  await page.locator('#catalog-buy').click();await catalog.getByRole('button',{name:'CLOSE',exact:true}).click();
}
async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readSaveText(path));
}

test('original Buy and palette purchase a cow and usable supplies and save their live continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = shopFixture(), game = f.load().withAllCrops(browserCrops); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'shop.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for(const [productType,x,y] of [[161,10,10],[299,12,10],[300,12,11]]){
    await selectProduct(page,productType);await clickFarmTile(page,x,y);game.dispatch({type:'buy-livestock',productType,x,y});
    await expect(page.locator(productType<299?'#buy-result':'#construction-result')).toContainText(productType<299?'purchased.':'placed for');
    await clickFarmTile(page,x,y);await expect(page.locator(productType<299?'#buy-result':'#construction-result')).toContainText('occupied');
  }
  expect((await farmSnapshot(page)).scenario.animals.filter(a=>a.active)).toHaveLength(1);
  expect((await farmSnapshot(page)).scenario.inventory.filter(i=>i.active&&(i.type===299||i.type===300)).map(i=>[i.type,i.quantity])).toEqual([[299,256],[300,512]]);
  await expect(page.locator('#farm-cash')).toHaveText('$99,405');
  const path = 'artifacts/browser-livestock-shop.simfarm.json';
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  // Verify source full-trough pixels after reload removes the selection border.
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement) =>
    Array.from(c.getContext('2d')!.getImageData(12 * 16, 10 * 16, 16, 16).data));
  const atlas = PNG.sync.read(readFileSync('public/assets/scenario4.tiles.png')), pixels: number[] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const offset = ((Math.floor(176 / 32) * 16 + y) * atlas.width + 176 % 32 * 16 + x) * 4;
    pixels.push(...atlas.data.subarray(offset, offset + 4));
  }
  expect(actual).toEqual(pixels);
  for (let day = 0; day < 4; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect((await farmSnapshot(page)).scenario.inventory.filter(i=>i.active&&(i.type===299||i.type===300)).map(i=>[i.type,i.quantity])).toEqual([[299,252],[300,496]]);
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let day = 0; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  expect(errors).toEqual([]);
});

test('livestock purchases explain clearing and cash limits and are usable on a narrow screen', async ({ page }) => {
  const f = shopFixture(); f.state.scenario.farm.cash = 40;
  f.state.scenario.cells[worldIndex(20, 20)].terrain = 535;
  const game = f.load().withAllCrops(browserCrops); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'shop-trees.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await selectProduct(page,299);await clickFarmTile(page,20,20);await expect(page.locator('#construction-result')).toContainText('Terrain blocks');
  expect(await download(page,'artifacts/browser-livestock-blocked.simfarm.json')).toEqual(JSON.parse(game.save(4)));
  await setAutoDoze(page,true);game.dispatch({type:'set-auto-clear',enabled:true});
  await selectProduct(page,300);await clickFarmTile(page,20,20);await expect(page.locator('#construction-result')).toContainText('not enough cash');
  const path = 'artifacts/browser-livestock-shop-clearing.simfarm.json';
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await selectProduct(page,299);await clickFarmTile(page,20,20);
  game.dispatch({ type: 'buy-livestock', productType: 299, x: 20, y: 20 });
  await expect(page.locator('#farm-cash')).toHaveText('$0');
  await clickFarmTile(page,20,20);await expect(page.locator('#construction-result')).toContainText('occupied');
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 1280, height: 844 }); await selectProduct(page,299);await clickFarmTile(page,22,20);
  await expect(page.locator('#construction-result')).toContainText('not enough cash');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-livestock-shop.png', fullPage: true });
});
