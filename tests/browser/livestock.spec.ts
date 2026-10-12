import {readSaveText} from '../support/save-file';
import { farmSnapshot } from '../support/field-checkpoint';
import { reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { worldIndex } from '../../src/formats/scenario';
import { livestockFixture } from '../support/livestock';

async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readSaveText(path));
}

test('live livestock moves with original pixels, drinks and preserves frame state across browser save and reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = livestockFixture(16), game = f.load().withAllCrops(browserCrops);
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles({ name: 'animals.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  expect((await farmSnapshot(page)).scenario.animals.filter(a=>a.active).map(a=>[a.slot,a.type])).toEqual([[1,161]]);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const a = game.getSnapshot().scenario.animals[1]; expect([a.x, a.y]).toEqual([11, 10]);
  expect(game.getSnapshot().scenario.inventory[1].quantity).toBe(506);
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => entries.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal')), ground = decodePlanar(asset('ega16til.til').subarray(15 * 128, 16 * 128), 16, 16, palette).rgba;
  const cow = decodePlanar(asset('mskdtile.til').subarray(118 * 128, 119 * 128), 16, 16, palette, 7).rgba;
  for (let p = 0; p < ground.length; p += 4) if (cow[p + 3]) ground.set(cow.subarray(p, p + 4), p);
  const pixels = await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(11 * 16, 10 * 16, 16, 16).data));
  expect(pixels).toEqual(Array.from(ground));
  const path = 'artifacts/browser-livestock.simfarm.json', saved = await download(page, path);
  expect(saved.version).toBe(28); expect(saved.runtime.animalFrame.lastMoveTick).toBe(16); expect(saved).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let day = 0; day < 21; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4))); expect(game.getSnapshot().animalFrame.lastCentreTick).toBeGreaterThan(320);
  expect(errors).toEqual([]);
});

test('livestock loss is shown in React, malformed frame saves preserve the current farm and controls fit a narrow screen', async ({ page }) => {
  const f = livestockFixture(16); f.state.scenario.inventory[1].bytes[10] &= ~32;
  f.state.scenario.cells[worldIndex(12, 10)].terrain = 15; f.state.scenario.animals[1].bytes[14] = 255;
  const game = f.load().withAllCrops(browserCrops); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'thirst.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect((await farmSnapshot(page)).scenario.animals.filter(a=>a.active)).toHaveLength(0);
  const status=page.getByRole('button',{name:'Edit message history'});
  await expect(status).toHaveText('Livestock are dying!');await status.click();
  await expect(page.getByRole('list',{name:'Recent Edit messages'}).locator('li')).toHaveText(['Livestock are dying!']);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Message',exact:true})).toHaveCount(0);
  const bad = JSON.parse(game.save(4)); bad.runtime.animalFrame.herd = '00';
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#save-status')).toContainText('Invalid native save: animal herd cache');
  const path = 'artifacts/browser-livestock-death.simfarm.json'; expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page, '#viewport');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-livestock.png' });
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  expect((await farmSnapshot(page)).scenario.animals.filter(a=>a.active)).toHaveLength(0);
  await expect(status).toBeVisible();await expect(status).toHaveText('');
});
