import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';
import { checkFieldPlacement } from '../../src/simulation/field-placement';
import { checkBuildingPlacement } from '../../src/simulation/building-placement';
import { CustomFarmSetup } from '../../src/simulation/custom-farm-setup';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';

async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const download = await pending, path = `artifacts/${name}.simfarm.json`; await download.saveAs(path);
  return { data: JSON.parse(readFileSync(path, 'utf8')), path, filename: download.suggestedFilename() };
}
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'generated.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function selectTile(page: Page, x: number, y: number) {
  await page.locator('#viewport').evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await page.locator('#viewport').scrollIntoViewIfNeeded(); const rect = await page.locator('#world').boundingBox();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}

test('create a generated farm on mobile, save it and restore without any original scenario request', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#new-farm').click();
  await page.locator('#new-farm-session').selectOption('fresh');
  await page.locator('#new-farm-year').fill('1993'); await page.locator('#new-farm-seed').fill('9029');
  await page.locator('#new-farm-lake').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'artifacts/browser-new-farm-setup.png', fullPage: true });
  const scenarioRequests: string[] = [];
  await page.route('**/assets/raw/SCEN*.SSM', route => { scenarioRequests.push(route.request().url()); return route.abort(); });
  await page.locator('#create-farm').click(); await page.locator('#play-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('.new-farm-panel')).toHaveCount(0); await expect(page.locator('#new-farm')).toHaveCount(1);
  await expect(page.locator('#farm-cash')).toHaveText('$40,000'); await expect(page.locator('#scenario')).toHaveValue('generated');
  const first = await save(page, 'browser-created-farm'); expect(first.filename).toContain('simfarm-new-farm-1993-4-');
  expect(first.data.version).toBe(24); expect(first.data.scenarioId).toBeNull(); expect(first.data.scenario.source).toBeNull();
  const draft = CustomFarmSetup.fresh(first.data.runtime.newFarm.provenance.options, newFarmAssets);
  const original = GameSimulation.load(writeNativeSave(draft.accept(), null), browserCrops, newFarmAssets.townLayouts).simulation.withAllCrops(browserCrops);
  expect(first.data).toEqual(JSON.parse(original.save(null)));
  await page.locator('#next-day').click(); original.dispatch({ type: 'advance-day' });
  expect((await save(page, 'browser-created-farm-day')).data).toEqual(JSON.parse(original.save(null)));
  await load(page, JSON.stringify(first.data));
  await expect(page.locator('.new-farm-panel')).toHaveCount(0); await expect(page.locator('#new-farm')).toHaveCount(1);
  expect((await save(page, 'browser-created-farm-restored')).data).toEqual(first.data);
  await page.screenshot({ path: 'artifacts/browser-new-farm-map.png', fullPage: true });
  expect(scenarioRequests).toEqual([]); expect(errors).toEqual([]);
  await page.unroute('**/assets/raw/SCEN*.SSM'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
});

test('generated load rejects corrupt startup state and unavailable crop assets without replacing the active farm', async ({ page }) => {
  const generated = GameSimulation.createNew(newFarmOptions, newFarmAssets).withAllCrops(browserCrops), text = generated.save(null);
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before = (await save(page, 'browser-generated-failure-before')).data;
  const invalid = JSON.parse(text); invalid.runtime.traffic.activeCount++;
  await page.locator('#load-farm-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
  await expect(page.locator('#save-status')).toContainText('Could not load farm');
  expect((await save(page, 'browser-generated-failure-invalid')).data).toEqual(before);
  await page.route('**/assets/raw/crops/corn.crp', route => route.fulfill({ status: 404, body: '' }));
  await page.locator('#load-farm-file').setInputFiles({ name: 'missing.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toContainText('Missing game asset');
  expect((await save(page, 'browser-generated-failure-asset')).data).toEqual(before);
  await page.unroute('**/assets/raw/crops/corn.crp'); await load(page, text);
  expect((await save(page, 'browser-generated-recovered')).data).toEqual(JSON.parse(text));
});

test('a previewed farm plants on its starting land and delivers harvest into newly built storage through React', async ({ page }) => {
  const draft = CustomFarmSetup.fresh(newFarmOptions, newFarmAssets);
  const generated = GameSimulation.load(writeNativeSave(draft.accept(), null), browserCrops, newFarmAssets.townLayouts).simulation.withAllCrops(browserCrops);
  generated.dispatch({ type: 'set-disasters-enabled', enabled: false });
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1'); await load(page, generated.save(null));
  generated.dispatch({ type: 'set-auto-clear', enabled: true });
  let view = generated.getSnapshot();
  const find = (check: (x: number, y: number) => boolean) => {
    for (let x = 0; x < 89; x++) for (let y = 0; y < 89; y++) if (check(x, y)) return { x, y };
    throw new Error('Missing test location');
  };
  const field = find((x, y) => checkFieldPlacement(view.scenario, x, y).ok);
  await page.locator('#map-tool').selectOption('field'); await page.locator('#auto-clear').check(); await selectTile(page, field.x, field.y);
  await expect(page.locator('#create-field')).toBeEnabled(); await page.locator('#create-field').click();
  generated.dispatch({ type: 'create-field', ...field, cropSlot: 0 });
  await expect(page.locator('#field-status')).toContainText('Planting');
  view = generated.getSnapshot(); const storage = find((x, y) => checkBuildingPlacement(view.scenario, 65, x, y, view.weather.soilMoisture).ok);
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('65'); await selectTile(page, storage.x, storage.y);
  await page.locator('#build-building').click(); generated.dispatch({ type: 'build', ...storage, buildingType: 65 });
  for (let i = 0; i < 12; i++) { await page.locator('#next-day').click(); generated.dispatch({ type: 'advance-day' }); }
  await page.locator('#field').selectOption('1');
  await expect(page.locator('#field-status')).toContainText('Growing');
  const midpoint = await save(page, 'browser-generated-growing'); expect(midpoint.data).toEqual(JSON.parse(generated.save(null)));
  await load(page, JSON.stringify(midpoint.data)); await page.locator('#field').selectOption('1');
  await page.locator('#harvest-field').click(); generated.dispatch({ type: 'harvest-field', fieldSlot: 1 });
  for (let i = 0; i < 12; i++) { await page.locator('#next-day').click(); generated.dispatch({ type: 'advance-day' }); }
  await expect(page.locator('#harvest-stock')).toHaveText('1 stored harvest');
  const slot = generated.getSnapshot().scenario.inventory.find(i => i.active && i.type === 168)!.slot;
  await page.locator('.sell-harvest').click(); generated.dispatch({ type: 'sell-harvest', inventorySlot: slot });
  await expect(page.locator('#harvest-stock')).toHaveText('No stored harvests.');
  const final = await save(page, 'browser-generated-farming'); expect(final.data).toEqual(JSON.parse(generated.save(null)));
  expect(readNativeSave(JSON.stringify(final.data)).state.scenario.sourceBytes).toBeNull();
});

test('a failed creation keeps the current session, and Cancel followed by another creation remains usable', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before = (await save(page, 'browser-create-failure-before')).data;
  await page.route('**/assets/new-farm-runtime.json', route => route.fulfill({ status: 404, body: '' }));
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toContainText('Missing game asset');
  expect((await save(page, 'browser-create-failure-after')).data).toEqual(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.unroute('**/assets/new-farm-runtime.json'); await page.locator('#new-farm').click();
  await expect(page.locator('#create-farm')).toBeEnabled(); await expect(page.locator('#new-farm-error')).toHaveCount(0);
  await page.locator('#create-farm').click(); await page.locator('#play-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
});
