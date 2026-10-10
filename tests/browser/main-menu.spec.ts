import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { readCrop } from '../../src/formats/crop';
import { newFarmAssets } from '../support/new-farm';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n)).map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function command(page: Page, name: string) {
  await reveal(page, '#file-menu-button'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name, exact: true }).click();
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await command(page, 'Save'); const download = await pending;
  return { data: JSON.parse(readFileSync((await download.path())!, 'utf8')), filename: download.suggestedFilename() };
}
async function pick(page: Page, name: string, buffer: Buffer) {
  const pending = page.waitForEvent('filechooser'); await command(page, 'Load Game');
  await (await pending).setFiles({ name, mimeType: 'application/octet-stream', buffer });
}

test('source menu order uses selectable text, keyboard navigation and original desktop spacing', async ({ page }) => {
  await start(page);
  const bar = page.getByRole('navigation', { name: 'Original game menus' });
  expect(await bar.locator(':scope > button').allTextContents()).toEqual(['File', 'Options', 'Speed', 'Windows', 'Disasters']);
  await reveal(page, '#file-menu-button'); await page.locator('#file-menu-button').focus(); await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'File' });
  expect(await menu.getByRole('menuitem').allTextContents()).toEqual(['About SimFarm', 'New Game', 'Save', 'Save As', 'Load Game', 'Quit']);
  await expect(page.getByRole('menuitem', { name: 'About SimFarm' })).toBeFocused();
  await expect(page.getByRole('menuitem', { name: 'Load Crop' })).toHaveCount(0);
  await page.keyboard.press('End'); await expect(page.getByRole('menuitem', { name: 'Quit' })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(page.getByRole('menuitem', { name: 'Load Game' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(page.locator('#file-menu-button')).toBeFocused();
  await command(page, 'About SimFarm'); await expect(page.getByRole('dialog')).toContainText('Preservation is still in progress');
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await reveal(page, '#file-menu-button'); await page.locator('#file-menu-button').click(); await page.screenshot({ path: 'artifacts/browser-main-menu-desktop.png', fullPage: false });
  await page.locator('.edit-title').click({ position: { x: 400, y: 10 } }); await expect(menu).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page, '#file-menu-button'); await page.locator('#file-menu-button').click();
  const box = await menu.boundingBox(); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  const text = await page.getByRole('menuitem', { name: 'About SimFarm' }).evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); const selection = getSelection()!;
    selection.removeAllRanges(); selection.addRange(range); return selection.toString();
  });
  expect(text).toBe('About SimFarm');
  await page.screenshot({ path: 'artifacts/browser-main-menu-mobile.png', fullPage: false });
  await page.keyboard.press('Escape');
  await command(page, 'New Game'); await expect(page.getByRole('region', { name: 'New farm', exact: true })).toBeVisible();
});

test('File Save As names downloads, Save retains that name, and Load Game restores the exact native checkpoint', async ({ page }) => {
  await start(page); await reveal(page, '#next-day'); await page.locator('#next-day').click(); const before = await save(page);
  await command(page, 'Save As'); await page.getByLabel('Filename', { exact: true }).fill('Preserved farm');
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download save' }).click();
  const download = await pending; expect(download.suggestedFilename()).toBe('Preserved farm.simfarm.json');
  expect(JSON.parse(readFileSync((await download.path())!, 'utf8'))).toEqual(before.data);
  expect((await save(page)).filename).toBe('Preserved farm.simfarm.json');
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await pick(page, 'checkpoint.json', Buffer.from(JSON.stringify(before.data))); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  expect((await save(page)).data).toEqual(before.data);
  await pick(page, 'broken.json', Buffer.from('{')); await expect(page.locator('#save-status')).toContainText('Could not load farm');
  expect((await save(page)).data).toEqual(before.data);
});

test('File Load Game follows ordinary original import without replaying chooser generation', async ({ page }) => {
  await start(page); await reveal(page, '#next-day'); await page.locator('#next-day').click();
  const before = (await save(page)).data, bytes = source('SCEN6.SSM');
  const prior = GameSimulation.load(JSON.stringify(before), browserCrops, newFarmAssets.townLayouts).simulation.withAllCrops(browserCrops);
  const expected = prior.importOriginal(bytes, crops).simulation.withAllCrops(browserCrops);
  await page.route('**/assets/new-farm-runtime.json', route => route.abort());
  await pick(page, 'SCEN6.SSM', bytes); await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
  expect((await save(page)).data).toEqual(JSON.parse(expected.save(null)));
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  expect((await save(page)).data).toEqual(JSON.parse(expected.save(null)));
});

test('Quit cancellation retains running state; save-and-pause downloads and leaves a resumable farm', async ({ page }) => {
  await start(page); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await command(page, 'Quit'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#time-status')).toContainText('Running');
  const before = await save(page);
  await command(page, 'Quit'); const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save and pause' }).click();
  expect(JSON.parse(readFileSync((await (await pending).path())!, 'utf8'))).toEqual(before.data);
  await expect(page.locator('#time-status')).toContainText('Paused'); await expect(page.locator('#save-status')).toContainText('Farm paused');
  const paused = (await save(page)).data;
  expect(paused).toEqual({ ...before.data, runtime: { ...before.data.runtime, paused: true, elapsed: 0 } });
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await expect(page.locator('#time-status')).toContainText('Running');
});
