import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { readCrop } from '../../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { miniTileAtlas, readPalette } from '../../src/formats/graphics';
import { readPreviewMarkers } from '../../src/formats/preview-markers';
import { renderLocatedTerrainPreview } from '../../src/render/terrain-preview';
import { GameSimulation } from '../../src/simulation/game';
import { CustomFarmSetup } from '../../src/simulation/custom-farm-setup';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const raw = (name: string) => readFileSync(new URL('../../public/assets/raw/' + name, import.meta.url));
const crops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const options = { ...newFarmOptions, seeds: { visual: 9029, simulation: 9029, bounded: 9029 } };
const miniature = miniTileAtlas(raw('far_mapc.mbm'), readPalette(raw('scenario.pal'))), markers = readPreviewMarkers(raw('egafont.fnt'));
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = await (await pending).path(); return JSON.parse(readFileSync(path!, 'utf8'));
}
async function pixels(page: Page) {
  return page.locator('#terrain-preview').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(0, 0, 192, 192).data));
}
async function expectPreview(page: Page, draft: CustomFarmSetup) {
  const p = draft.getSnapshot().preview;
  expect(await pixels(page)).toEqual(Array.from(renderLocatedTerrainPreview(p.world, miniature, markers, p.locations!).rgba));
}
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}

test('original custom screen draws exact source pixels and Play accepts its unchanged map after option edits', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); const before = await save(page);
  await page.locator('#new-farm').click(); await page.locator('#new-farm-session').selectOption('fresh');
  await page.locator('#create-farm').click(); await expect(page.getByRole('heading', { name: 'Design your terrain' })).toBeFocused();
  const draft = CustomFarmSetup.fresh(options, assets); await expectPreview(page, draft);
  expect(await save(page)).toEqual(before);
  await page.locator('#terrain-precipitation').focus(); await page.keyboard.press('Home');
  await page.locator('#terrain-temperature').focus(); await page.keyboard.press('End');
  await page.locator('#terrain-river').click(); await page.locator('#terrain-lake').click();
  draft.setSettings({ ...options, climate: { precipitation: 0, temperature: 3, wind: 1 }, river: false, lake: true });
  await expect(page.locator('#terrain-settings')).toContainText('Rainfall: Low');
  await expectPreview(page, draft); // No regeneration on either keyboard or water changes.
  await page.locator('#terrain-design').screenshot({ path: 'artifacts/browser-terrain-design-desktop.png' });
  await page.locator('#play-farm').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const expected = GameSimulation.load(writeNativeSave(draft.accept(), null), crops, assets.townLayouts).simulation;
  expect(await save(page)).toEqual(JSON.parse(expected.save(null)));
  await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  expect(await save(page)).toEqual(JSON.parse(expected.save(null)));
  expect(errors).toEqual([]);
});

test('mobile restart rerolls retain original streams, respond to keyboard and continue exactly after Play', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await start(page);
  const before = await save(page), draft = CustomFarmSetup.restart(readNativeSave(JSON.stringify(before)).state, options, assets);
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click();
  await expectPreview(page, draft);
  await page.getByRole('button', { name: 'Increase rainfall', exact: true }).click();
  draft.setSettings({ ...options, climate: { ...options.climate, precipitation: 3 } });
  await page.locator('#generate-world').focus();
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Enter'); draft.generateWorld(); await expectPreview(page, draft); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.locator('#terrain-design').screenshot({ path: 'artifacts/browser-terrain-design-mobile.png' });
  await page.locator('#play-farm').click();
  const game = GameSimulation.load(writeNativeSave(draft.accept(), null), crops, assets.townLayouts).simulation;
  const accepted = await save(page); expect(accepted).toEqual(JSON.parse(game.save(null)));
  await page.locator('#load-farm-file').setInputFiles({ name: 'preview.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(accepted)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let i = 0; i < 7; i++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(null)));
});

test('missing preview assets and cancellation leave the old farm intact and allow a fresh preview', async ({ page }) => {
  await start(page); const before = await save(page);
  await page.route('**/assets/raw/egafont.fnt', route => route.fulfill({ status: 200, body: Buffer.alloc(3007), contentType: 'application/octet-stream' }));
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toContainText('Truncated terrain preview font');
  expect(await save(page)).toEqual(before);
  await page.unroute('**/assets/raw/egafont.fnt'); await page.locator('#create-farm').click();
  await page.locator('#generate-world').click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await save(page)).toEqual(before);
  let requested!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/assets/defworld.png', async route => { requested(); await release; await route.continue().catch(() => {}); });
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click(); await started;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); finish();
  await page.unroute('**/assets/defworld.png'); expect(await save(page)).toEqual(before);
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click();
  await expectPreview(page, CustomFarmSetup.restart(readNativeSave(JSON.stringify(before)).state, options, assets));
});

test('extreme retained soil rejects unplaceable terrain atomically and Start fresh remains available', async ({ page }) => {
  await start(page); const original = await save(page); original.runtime.weather.soilMoisture = -128;
  await page.locator('#load-farm-file').setInputFiles({ name: 'soil-boundary.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); const before = await save(page);
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toContainText('No starting property fits this preview');
  await expect(page.locator('#play-farm')).toHaveCount(0); expect(await save(page)).toEqual(before);
  await page.locator('#new-farm-session').selectOption('fresh'); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toHaveCount(0);
  await expect(page.locator('#play-farm')).toBeEnabled(); await page.locator('#play-farm').click();
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  expect((await save(page)).runtime.weather.soilMoisture).toBe(8);
});
