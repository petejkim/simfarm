import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Binary } from '../../src/formats/binary';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { allocateAnimal } from '../../src/simulation/animal-allocation';
import { FarmRandom } from '../../src/simulation/random';
import { livestockFixture, shopFixture } from '../support/livestock';
import { replacementBirthFixture } from '../support/animal-lifecycle';

async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('a cow matures into the original adult sprite, begins monthly breeding and shows saved age and gestation in React', async ({ page }) => {
  const f = livestockFixture(16); new Binary(f.state.scenario.animals[1].bytes).view.setUint16(10, 80, true);
  f.state.scenario.farm.calendar.day = 6; f.state.scenario.farm.calendar.week = 3;
  const game = f.load().withAllCrops(browserCrops), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles({ name: 'adult-cow.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const a = game.getSnapshot().scenario.animals[1]; expect([a.x, a.y, a.bytes[18]]).toEqual([11, 10, 1]);
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal'));
  const ground = decodePlanar(asset('ega16til.til').subarray(15 * 128, 16 * 128), 16, 16, palette).rgba;
  const adult = decodePlanar(asset('mskdtile.til').subarray(119 * 128, 120 * 128), 16, 16, palette, 7).rgba;
  for (let p = 0; p < ground.length; p += 4) if (adult[p + 3]) ground.set(adult.subarray(p, p + 4), p);
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(11 * 16, 10 * 16, 16, 16).data))).toEqual(Array.from(ground));
  await reveal(page, '#livestock-panel > summary'); await page.locator('#livestock-panel > summary').click(); await reveal(page, '#animal-ages summary'); await page.locator('#animal-ages summary').click();
  await expect(page.locator('#livestock-life-summary')).toContainText('Adults: 1 · Expecting: 1');
  await expect(page.getByRole('table', { name: 'Animal ages and breeding' })).toContainText('81');
  await expect(page.getByRole('table', { name: 'Animal ages and breeding' })).toContainText('Expecting · week 0');
  const path = 'artifacts/browser-animal-age.simfarm.json'; expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let d = 0; d < 7; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  await reveal(page, '#livestock-panel > summary'); await page.locator('#livestock-panel > summary').click(); await reveal(page, '#animal-ages summary'); await page.locator('#animal-ages summary').click();
  await expect(page.getByRole('table', { name: 'Animal ages and breeding' })).toContainText('Expecting · week 1');
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page, '#animal-ages'); await page.locator('#animal-ages').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-animal-lifecycle.png', fullPage: true }); expect(errors).toEqual([]);
});

test('birth and old-age notices retain species when a slot is reused, and a full herd explains a failed birth', async ({ page }) => {
  const f = replacementBirthFixture(), game = f.load().withAllCrops(browserCrops); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'birth.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await reveal(page, '#livestock-panel > summary'); await page.locator('#livestock-panel > summary').click();
  await expect(page.locator('#animal-lifecycle-notices')).toContainText('Horse 1 died of old age.');
  await expect(page.locator('#animal-lifecycle-notices')).toContainText('Cow 1 was born to animal 2.');
  await expect(page.getByRole('table', { name: 'Livestock counts', exact: true }).getByRole('row', { name: 'Cow 2', exact: true })).toBeVisible();
  const path = 'artifacts/browser-animal-birth.simfarm.json'; expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await expect(page.locator('#animal-lifecycle-notices')).toHaveCount(0);
  for (let d = 0; d < 7; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  const full = shopFixture(), random = new FarmRandom(full.state.random);
  for (let slot = 1; slot <= 255; slot++) allocateAnimal(full.state.scenario, full.state.finances, random, 163, 10 + slot % 16, 10 + Math.floor(slot / 16));
  full.state.random = random.snapshot(); full.state.scenario.farm.calendar.day = 6;
  const parent = full.state.scenario.animals[255]; parent.flags |= 3; parent.bytes[28] = 24;
  const capacityGame = full.load().withAllCrops(browserCrops);
  await page.locator('#load-farm-file').setInputFiles({ name: 'full-herd.json', mimeType: 'application/json', buffer: Buffer.from(capacityGame.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); capacityGame.dispatch({ type: 'advance-day' });
  await reveal(page, '#livestock-panel > summary'); await page.locator('#livestock-panel > summary').click();
  await expect(page.locator('#animal-lifecycle-notices')).toContainText('Sheep 255 could not add a newborn because the farm has reached its animal limit.');
  expect(await download(page, path)).toEqual(JSON.parse(capacityGame.save(4)));
});
