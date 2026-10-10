import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { worldIndex } from '../../src/formats/scenario';
import { shopFixture } from '../support/livestock';

async function selectTile(page: Page, x: number, y: number) {
  await reveal(page, '#viewport'); const viewport = page.locator('#viewport');
  await viewport.evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await viewport.scrollIntoViewIfNeeded();
  const rect = await page.locator('#world').boundingBox(); expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('the livestock panel opens the shop, buys a cow and usable supplies and saves their live continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = shopFixture(), game = f.load().withAllCrops(browserCrops); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'shop.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#livestock-panel > summary'); await page.locator('#livestock-panel > summary').click(); await reveal(page, '#open-livestock-shop'); await page.locator('#open-livestock-shop').click();
  await expect(page.locator('#map-tool')).toHaveValue('livestock'); await expect(page.locator('#buy-livestock')).toBeDisabled();
  for (const [productType, x, y, name] of [[161, 10, 10, 'Cow'], [299, 12, 10, 'Water trough'], [300, 12, 11, 'Feed']] as const) {
    await reveal(page, '#livestock-product'); await page.locator('#livestock-product').selectOption(String(productType)); await selectTile(page, x, y);
    await expect(page.locator('#livestock-placement-status')).toContainText('Ready'); await reveal(page, '#buy-livestock'); await page.locator('#buy-livestock').click();
    game.dispatch({ type: 'buy-livestock', productType, x, y });
    await expect(page.locator('#livestock-purchase-result')).toContainText(`${name} purchased`);
    await expect(page.locator('#buy-livestock')).toBeDisabled();
  }
  await expect(page.locator('#livestock-panel > summary')).toContainText('1 animal');
  await expect(page.locator('#livestock-supplies')).toHaveText('Water remaining: 256 units · Feed remaining: 512 units');
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
  await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('livestock');
  await expect(page.locator('#livestock-supplies')).toHaveText('Water remaining: 252 units · Feed remaining: 496 units');
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
  await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('livestock'); await reveal(page, '#livestock-product'); await page.locator('#livestock-product').selectOption('299');
  await selectTile(page, 20, 20); await expect(page.locator('#livestock-placement-status')).toContainText('clear grass');
  await expect(page.locator('#buy-livestock')).toBeDisabled(); await reveal(page, '#livestock-auto-clear'); await page.locator('#livestock-auto-clear').check();
  game.dispatch({ type: 'set-auto-clear', enabled: true });
  await expect(page.locator('#livestock-placement-status')).toContainText('$40 ($25 clearing)');
  await reveal(page, '#livestock-product'); await page.locator('#livestock-product').selectOption('300');
  await expect(page.locator('#livestock-placement-status')).toContainText('not enough cash'); await expect(page.locator('#buy-livestock')).toBeDisabled();
  const path = 'artifacts/browser-livestock-shop-clearing.simfarm.json';
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await reveal(page, '#livestock-product'); await page.locator('#livestock-product').selectOption('299'); await reveal(page, '#buy-livestock'); await page.locator('#buy-livestock').click();
  game.dispatch({ type: 'buy-livestock', productType: 299, x: 20, y: 20 });
  await expect(page.locator('#farm-cash')).toHaveText('$0');
  await expect(page.locator('#livestock-placement-status')).toContainText('occupied');
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 1280, height: 844 }); await selectTile(page, 22, 20);
  await reveal(page, '#livestock-shop'); await page.locator('#livestock-shop').scrollIntoViewIfNeeded();
  await expect(page.locator('#livestock-placement-status')).toContainText('not enough cash');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-livestock-shop.png', fullPage: true });
});
