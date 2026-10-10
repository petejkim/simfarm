import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { Binary } from '../../src/formats/binary';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { worldIndex } from '../../src/formats/scenario';
import { GameSimulation } from '../support/game';
import { waterStorageFixture } from '../support/water-storage';

async function selectTile(page: Page, x: number, y: number) {
  const viewport = page.locator('#viewport');
  await viewport.evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await viewport.scrollIntoViewIfNeeded();
  const rect = await page.locator('#world').boundingBox(); expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('Build water storage collects from live irrigation, refills distant troughs weekly and saves the original building pixels and state', async ({ page }) => {
  const f = waterStorageFixture(), game = f.load().withAllCrops(browserCrops), errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'water-store.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('72');
  await expect(page.locator('#building-type option:checked')).toHaveText('Water storage · $200');
  await selectTile(page, 13, 11); await page.locator('#build-building').click();
  game.dispatch({ type: 'build', buildingType: 72, x: 13, y: 11 });
  await expect(page.locator('#building-result')).toHaveText('Built for $200.');
  await expect(page.locator('#water-storage-status')).toContainText('217 / 255 units');
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
  await page.locator('#livestock-panel > summary').click();
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await expect(page.locator('#livestock-stored-water')).toContainText('255 units');
  for (let day = 1; day < 7; day++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  await expect(page.locator('#livestock-stored-water')).toContainText('191 units');
  await page.locator('#map-tool').selectOption('livestock'); await expect(page.locator('#livestock-supplies')).toContainText('Water remaining: 128 units');
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let day = 0; day < 7; day++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#map-tool').selectOption('build');
  await page.locator('#building-type').selectOption('72'); await selectTile(page, 13, 11);
  await page.locator('#water-storage-status').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await page.locator('#livestock-panel > summary').click();
  await expect(page.locator('#water-storage-worn')).toContainText('Water storage worn out at 13, 11');
  await expect(page.locator('#livestock-stored-water')).toContainText('0 units');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('72');
  await selectTile(page, 13, 11); await expect(page.locator('#water-storage-status')).toContainText('Worn out');
  await page.locator('#map-tool').selectOption('livestock'); await expect(page.locator('#livestock-supplies')).toContainText('Water remaining: 0 units');
  expect(await download(page, 'artifacts/browser-worn-water-storage.simfarm.json')).toEqual(JSON.parse(game.save(4)));
});
