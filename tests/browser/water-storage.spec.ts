import {readSaveText} from '../support/save-file';
import { storedWater } from '../../src/simulation/water-storage';
import { farmSnapshot } from '../support/field-checkpoint';
import { buyBuilding } from '../support/building-actions';
import { reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Binary } from '../../src/formats/binary';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { worldIndex } from '../../src/formats/scenario';
import { GameSimulation } from '../support/game';
import { waterStorageFixture } from '../support/water-storage';

async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readSaveText(path));
}

test('Build water storage collects from live irrigation, refills distant troughs weekly and saves the original building pixels and state', async ({ page }) => {
  const f = waterStorageFixture(), game = f.load().withAllCrops(browserCrops), errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'water-store.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await buyBuilding(page,72,13,11);
  game.dispatch({ type: 'build', buildingType: 72, x: 13, y: 11 });
  expect(storedWater((await farmSnapshot(page)).scenario.buildings[2])).toBe(217);
  const path = 'artifacts/browser-water-storage.simfarm.json';
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement) =>
    Array.from(c.getContext('2d')!.getImageData(13 * 16, 11 * 16, 16, 16).data));
  const atlas = PNG.sync.read(readFileSync('public/assets/scenario4.tiles.png')), pixels: number[] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const offset = ((Math.floor(481 / 32) * 16 + y) * atlas.width + 481 % 32 * 16 + x) * 4;
    pixels.push(...atlas.data.subarray(offset, offset + 4));
  }
  expect(actual).toEqual(pixels);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(storedWater((await farmSnapshot(page)).scenario.buildings[2])).toBe(255);
  for (let day = 1; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(storedWater((await farmSnapshot(page)).scenario.buildings[2])).toBe(191);
  expect((await farmSnapshot(page)).scenario.inventory.filter(i=>i.active&&i.type===299).reduce((sum,i)=>sum+i.quantity,0)).toBe(128);
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let day = 0; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page, '#viewport');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-water-storage.png', fullPage: true });
});

test('water storage wear is visible and removes its supply before weekly refills', async ({ page }) => {
  const f = waterStorageFixture(), initial = f.load().withAllCrops(browserCrops); initial.dispatch({ type: 'build', buildingType: 72, x: 13, y: 11 });
  const { state } = readNativeSave(initial.save(4)), store = state.scenario.buildings[2], v = new Binary(store.bytes).view;
  v.setUint16(8, 480, true); state.scenario.cells[worldIndex(13, 10)].terrain = 99;
  state.scenario.farm.calendar.day = 6; state.dayTicks = 15; state.random.visual = 10; // Weekly traffic draws1792, then wear draws7.
  const game = GameSimulation.load(writeNativeSave(state, 4), browserCrops).simulation.withAllCrops(browserCrops);
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles({ name: 'worn-water-store.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await expect(page.locator('#building-message-text')).toHaveText('A water tower has burst! You may want to bulldoze it and buy another.');
  await expect(page.getByRole('dialog',{name:'Message',exact:true})).toBeVisible();
  await page.locator('#building-message-ok').click();
  const worn=(await farmSnapshot(page)).scenario.buildings[2];expect([worn.x,worn.y,worn.bytes[6]]).toEqual([13,11,255]);
  expect(storedWater((await farmSnapshot(page)).scenario.buildings[2])).toBe(0);
  expect((await farmSnapshot(page)).scenario.inventory.filter(i=>i.active&&i.type===299).reduce((sum,i)=>sum+i.quantity,0)).toBe(0);
  expect(await download(page, 'artifacts/browser-worn-water-storage.simfarm.json')).toEqual(JSON.parse(game.save(4)));
});
