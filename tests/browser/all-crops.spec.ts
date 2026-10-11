import { browseSupply } from '../support/supply-actions';
import { plantField } from '../support/field-actions';
import { reveal, openWindow } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { readArchive } from '../../src/formats/archive';
import { readPalette, decodePlanar } from '../../src/formats/graphics';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'all-crops.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}

test('all crops are immediately plantable and plannable with source artwork and exact expanded save continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const fixture = shopFixture(); fixture.state.disasters.enabled = false;
  const legacy = fixture.load().save(4), game = fixture.load().withAllCrops(browserCrops);
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.getByRole('button',{name:'Plant',exact:true}).click();await expect(page.locator('[data-field-tool]')).toHaveCount(24);await page.keyboard.press('Escape');
  await load(page, legacy);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await reveal(page, '#file-menu-button'); await page.locator('#file-menu-button').click(); await expect(page.getByRole('menuitem', { name: 'Load Crop' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const slot = 23, file = game.getSnapshot().scenario.cropFiles[slot], crop = browserCrops.find(c => `${c.id}.crp` === file)!;
  await plantField(page,40,40,slot);await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  game.dispatch({ type: 'create-field', x: 40, y: 40, cropSlot: slot });
  await expect(page.locator('#field option:checked')).toContainText(crop.name);
  await expect(page.locator('#plant-crop')).toHaveCount(0);
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
  const palette = readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes);
  const pixels = decodePlanar(source('CROPS/' + file.toUpperCase()).subarray(0x1200, 0x1280), 16, 16, palette).rgba;
  // The selected field draws a border over the badge's outside pixels.
  const interior = Array.from({ length: 12 }, (_, y) => [...pixels.slice(((y + 2) * 16 + 2) * 4, ((y + 2) * 16 + 14) * 4)]).flat();
  expect(await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(642, 642, 12, 12).data))).toEqual(interior);
  await openWindow(page, 'schedule');
  await expect(page.locator('[data-plan-crop]')).toHaveCount(16);
  await page.getByRole('button', { name:'Next crops',exact:true }).click();
  await expect(page.locator('[data-plan-crop]')).toHaveCount(8);
  await page.locator('[data-plan-crop="22"]').click(); await page.locator('[data-plan-week="1"]').click();
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week: 1, action: { kind: 'plant', cropSlot: 22 } });
  await expect(page.locator('#plan-result')).toContainText('Plan updated');
  await page.screenshot({ path: 'artifacts/browser-all-crops.png', fullPage: true });
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await browseSupply(page,215);await expect(page.locator('#buy-owned')).toHaveText('0');
  await expect(page.locator('#buy-description')).toContainText(browserCrops.find(c=>`${c.id}.crp`===game.getSnapshot().scenario.cropFiles[23])!.description);
  const checkpoint = await save(page); await page.reload(); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await load(page, JSON.stringify(checkpoint)); expect(await save(page)).toEqual(checkpoint);
  for (let day = 0; day < 8; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  expect(errors).toEqual([]);
});
