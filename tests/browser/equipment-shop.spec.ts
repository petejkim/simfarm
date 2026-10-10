import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { worldIndex } from '../../src/formats/scenario';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function selectTile(page: Page, x: number, y: number) {
  await page.locator('#viewport').evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await reveal(page, '#viewport'); await page.locator('#viewport').scrollIntoViewIfNeeded();
  const rect = await page.locator('#world').boundingBox(); expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function save(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'equipment.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}

test('machinery shortcut buys original ground sprites and stored machines with exact saved continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = shopFixture(), game = f.load().withAllCrops(browserCrops);
  game.dispatch({ type: 'build', buildingType: 66, x: 20, y: 20 });
  await page.goto('/'); await load(page, game.save(4));
  await reveal(page, '#machinery-panel > summary'); await page.locator('#machinery-panel > summary').click(); await reveal(page, '#open-equipment-shop'); await page.locator('#open-equipment-shop').click();
  await expect(page.locator('#map-tool')).toHaveValue('equipment'); await expect(page.locator('#buy-equipment')).toBeDisabled();
  await selectTile(page, 10, 10); await expect(page.locator('#equipment-placement-status')).toContainText('$400 total');
  await reveal(page, '#buy-equipment'); await page.locator('#buy-equipment').click(); game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  await expect(page.locator('#equipment-purchase-result')).toHaveText('Tractor purchased for $400.');
  await expect(page.locator('#buy-equipment')).toBeDisabled();
  await reveal(page, '#equipment-type'); await page.locator('#equipment-type').selectOption('4'); await selectTile(page, 21, 20);
  await expect(page.locator('#equipment-placement-status')).toContainText('Will enter equipment storage');
  await reveal(page, '#buy-equipment'); await page.locator('#buy-equipment').click(); game.dispatch({ type: 'buy-equipment', equipmentType: 4, x: 21, y: 20 });
  await expect(page.locator('#equipment-purchase-result')).toContainText('Harvester purchased for $400 and placed in storage');
  await expect(page.locator('#machinery-summary')).toHaveText('Owned: 2 · Rented: 0');
  const path = 'artifacts/browser-equipment-shop.simfarm.json'; expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, game.save(4));
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal')), ground = decodePlanar(asset('ega16til.til').subarray(15 * 128, 16 * 128), 16, 16, palette).rgba;
  const tractor = decodePlanar(asset('mskdtile.til').subarray(0, 128), 16, 16, palette, 7).rgba;
  for (let p = 0; p < ground.length; p += 4) if (tractor[p + 3]) ground.set(tractor.subarray(p, p + 4), p);
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(160, 160, 16, 16).data))).toEqual(Array.from(ground));
  await expect(page.locator('#equipment-purchase-result')).toHaveCount(0);
  for (let d = 0; d < 7; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, path)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('machinery shop explains cash, trees and incompatible storage and fits a narrow screen', async ({ page }) => {
  const f = shopFixture(); f.state.scenario.farm.cash = 425; f.state.scenario.cells[worldIndex(10, 10)].terrain = 535;
  const game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('equipment'); await selectTile(page, 10, 10);
  await expect(page.locator('#equipment-placement-status')).toContainText('Choose clear grass'); await expect(page.locator('#buy-equipment')).toBeDisabled();
  await reveal(page, '#equipment-auto-clear'); await page.locator('#equipment-auto-clear').check(); game.dispatch({ type: 'set-auto-clear', enabled: true });
  await expect(page.locator('#equipment-placement-status')).toContainText('$425 total ($25 clearing)');
  await reveal(page, '#equipment-type'); await page.locator('#equipment-type').selectOption('7'); await expect(page.locator('#equipment-placement-status')).toContainText('not enough cash');
  await reveal(page, '#equipment-type'); await page.locator('#equipment-type').selectOption('0'); await reveal(page, '#buy-equipment'); await page.locator('#buy-equipment').click();
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  await expect(page.locator('#farm-cash')).toHaveText('$0');
  expect(await save(page, 'artifacts/browser-equipment-shop-clearing.simfarm.json')).toEqual(JSON.parse(game.save(4)));
  const storage = shopFixture(), stored = storage.load().withAllCrops(browserCrops); stored.dispatch({ type: 'build', buildingType: 64, x: 20, y: 20 });
  await load(page, stored.save(4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('equipment'); await selectTile(page, 20, 20);
  await expect(page.locator('#equipment-placement-status')).toContainText('cannot store the machine'); await expect(page.locator('#buy-equipment')).toBeDisabled();
  await page.setViewportSize({ width: 1280, height: 844 }); await selectTile(page, 22, 20);
  await reveal(page, '#equipment-shop'); await page.locator('#equipment-shop').scrollIntoViewIfNeeded(); await expect(page.locator('#buy-equipment')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-equipment-shop.png', fullPage: true });
});
