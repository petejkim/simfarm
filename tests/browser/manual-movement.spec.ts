import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { checkEquipmentPickup } from '../../src/simulation/manual-equipment-move';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'movement.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = 'artifacts/browser-movement.simfarm.json'; await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}
async function selectTile(page: Page, x: number, y: number) {
  await reveal(page, '#viewport'); const viewport = page.locator('#viewport'); await viewport.evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await viewport.scrollIntoViewIfNeeded(); const rect = await page.locator('#world').boundingBox();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function tilePixels(page: Page, x: number, y: number, tile: number) {
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => archive.find(e => e.name === n)!.bytes;
  const expected = decodePlanar(asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128), 16, 16, readPalette(asset('simfarm.pal'))).rgba;
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y });
  expect(actual).toEqual(Array.from(expected));
}

test('move shortcut opens stored machinery, cancels safely and delivers to storage with exact saves and original interior pixels', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = shopFixture(), game = f.load().withAllCrops(browserCrops);
  game.dispatch({ type: 'build', buildingType: 67, x: 20, y: 20 }); game.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 4, x: 20, y: 20 });
  await page.goto('/'); await load(page, game.save(4));
  await reveal(page, '#machinery-panel > summary'); await page.locator('#machinery-panel > summary').click(); await reveal(page, '#open-equipment-move'); await page.locator('#open-equipment-move').click();
  await expect(page.locator('#map-tool')).toHaveValue('move'); await selectTile(page, 20, 21);
  await expect(page.locator('#equipment-move-quote')).toContainText('Open the building'); await expect(page.locator('#select-equipment-move')).toBeDisabled();
  await reveal(page, '#toggle-building-interior'); await page.locator('#toggle-building-interior').click(); game.dispatch({ type: 'toggle-building-interior', x: 20, y: 21, slot: 1 });
  await expect(page.locator('#building-interior-status')).toHaveText('Interior visible'); await tilePixels(page, 22, 22, 217);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await reveal(page, '#select-equipment-move'); await page.locator('#select-equipment-move').click(); await reveal(page, '#cancel-equipment-move'); await page.locator('#cancel-equipment-move').click();
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await selectTile(page, 20, 21); await reveal(page, '#select-equipment-move'); await page.locator('#select-equipment-move').click(); await selectTile(page, 40, 40);
  const selected = checkEquipmentPickup(game.getSnapshot().scenario, 20, 21); expect(selected.ok).toBe(true); if (!selected.ok) throw new Error('Missing machine');
  await reveal(page, '#move-equipment'); await page.locator('#move-equipment').click(); game.dispatch({ type: 'move-equipment', selected, x: 40, y: 40 });
  await expect(page.locator('#equipment-move-result')).toContainText('Movement ordered for machine 1');
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); await tilePixels(page, 20, 20, 217);
  // Save/reload while moving; source interior remains open and destination closed.
  await page.reload(); await load(page, game.save(4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('move');
  await expect(page.locator('#equipment-move-result')).toHaveCount(0);
  for (let d = 0; d < 8; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(game.getSnapshot().scenario.equipment[1].flags & 4).toBe(4); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('inspect'); await selectTile(page, 40, 40);
  await reveal(page, '#toggle-building-interior'); await page.locator('#toggle-building-interior').click(); game.dispatch({ type: 'toggle-building-interior', x: 40, y: 40, slot: 2 });
  await tilePixels(page, 42, 42, 217);
  await reveal(page, '#toggle-building-interior'); await page.locator('#toggle-building-interior').click(); game.dispatch({ type: 'toggle-building-interior', x: 40, y: 40, slot: 2 });
  // Type67 graphic9 base451, bottom-right of its3x3 roof is459.
  await tilePixels(page, 42, 42, 459); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('move');
  await selectTile(page, 40, 40); await reveal(page, '#equipment-move-panel'); await page.locator('#equipment-move-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-manual-movement.png', fullPage: true }); expect(errors).toEqual([]);
});

test('move controls explain busy and unowned targets, then tow an implement and return its tractor', async ({ page }) => {
  const f = shopFixture(), game = f.load().withAllCrops(browserCrops);
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 }); game.dispatch({ type: 'buy-equipment', equipmentType: 1, x: 11, y: 10 });
  const state = readNativeSave(game.save(4)).state; state.scenario.equipment[1].flags |= 1;
  await page.goto('/'); await load(page, writeNativeSave(state, 4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('move');
  await selectTile(page, 10, 10); await expect(page.locator('#equipment-move-quote')).toContainText('in use'); await expect(page.locator('#select-equipment-move')).toBeDisabled();
  state.scenario.equipment[1].flags &= ~1; state.scenario.cells[30 * 96 + 30].overlay = 0;
  await load(page, writeNativeSave(state, 4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('move');
  await selectTile(page, 11, 10); await reveal(page, '#select-equipment-move'); await page.locator('#select-equipment-move').click(); await selectTile(page, 30, 30);
  await expect(page.locator('#equipment-move-quote')).toHaveText('Choose a destination on your land.'); await expect(page.locator('#move-equipment')).toBeDisabled();
  expect(await save(page)).toEqual(JSON.parse(writeNativeSave(state, 4)));
  await load(page, game.save(4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('move');
  await selectTile(page, 11, 10); await reveal(page, '#select-equipment-move'); await page.locator('#select-equipment-move').click(); await selectTile(page, 30, 30);
  const selected = checkEquipmentPickup(game.getSnapshot().scenario, 11, 10); if (!selected.ok) throw new Error('Missing implement');
  await reveal(page, '#move-equipment'); await page.locator('#move-equipment').click(); game.dispatch({ type: 'move-equipment', selected, x: 30, y: 30 });
  for (let d = 0; d < 12; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  const w = game.getSnapshot().scenario;
  expect([w.equipment[1].x, w.equipment[1].y, w.equipment[1].attachment]).toEqual([10, 10, 0]);
  expect([w.equipment[2].x, w.equipment[2].y, w.equipment[2].parent]).toEqual([30, 30, 0]);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
