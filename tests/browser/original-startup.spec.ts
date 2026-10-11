import { reveal, openWindow } from '../support/workspace';
import { browserCrops, useOriginalCatalog } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { readCrop } from '../../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const date = { year: 1993, dayOfWeek: 1 }, seeds = { visual: 9029, simulation: 9029, bounded: 9029 };
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}
async function chooser(page: Page) {
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await page.locator('#new-farm-seed').fill('9029');
  await expect(page.locator('#region-map')).toBeVisible(); await expect(page.locator('#region-load')).toBeEnabled();
}
async function pick(page: Page, name: string, buffer: Buffer) {
  const picker = page.waitForEvent('filechooser'); await reveal(page, '#region-load'); await page.locator('#region-load').click();
  await (await picker).setFiles({ name, mimeType: name.endsWith('.SSM') ? 'application/octet-stream' : 'application/json', buffer });
}
async function restore(page: Page, value: unknown) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'checkpoint.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}

test('fresh chooser SSM runs original startup and native checkpoints bypass it even with different setup choices', async ({ page }) => {
  await start(page); await chooser(page); await page.locator('[data-region="1,3"]').click();
  const bytes = Buffer.from(source('SCEN6.SSM')); bytes[0x21719] = 1;
  const expected = GameSimulation.openOriginalSave(bytes, { date, seeds }, assets).withAllCrops(browserCrops);
  await pick(page, 'SCEN6.SSM', bytes); await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
  const actual = await save(page); expect(actual).toEqual(JSON.parse(expected.save(null)));
  expect(actual.runtime.setup.climateSelection).toEqual({ precipitation: 0, temperature: 0, wind: 0 });
  expect(actual.runtime.retainedSetup).not.toBeNull(); expect(actual.runtime.newFarm).toBeNull();
  for (let day = 0; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' }); }
  const advanced = await save(page); expect(advanced).toEqual(JSON.parse(expected.save(null)));
  await chooser(page); await reveal(page, '#new-farm-seed'); await page.locator('#new-farm-seed').fill('19');
  // Checkpoint restoration needs neither temporary terrain nor setup assets.
  await page.route('**/assets/new-farm-runtime.json', route => route.abort());
  await pick(page, 'exact.json', Buffer.from(JSON.stringify(advanced)));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); expect(await save(page)).toEqual(advanced);
});

test('chooser SSM starts fresh independently of old finances and the highlighted region', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 }); await start(page);
  const generated = GameSimulation.createNew({ ...newFarmOptions, climate: { precipitation: 3, temperature: 0, wind: 2 } }, assets).withAllCrops(browserCrops);
  const state = readNativeSave(generated.save(null)).state; state.weather.soilMoisture = 5; state.weather.moistureBalance = 0;
  state.scenario.farm.workerExpenses = 123456; state.finances.accounts.buildingBookValue = 234567;
  const prior = GameSimulation.load(writeNativeSave(state, null), browserCrops, assets.townLayouts).simulation.withAllCrops(browserCrops);
  const bytes = source('SCEN4.SSM'), expected = GameSimulation.openOriginalSave(bytes, {date,seeds}, assets).withAllCrops(browserCrops);
  for (const region of ['1,3', '15,8']) {
    await restore(page, JSON.parse(prior.save(null))); await chooser(page); await page.locator(`[data-region="${region}"]`).click();
    await pick(page, 'SCEN4.SSM', bytes); await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
    const actual = await save(page); expect(actual).toEqual(JSON.parse(expected.save(null)));
    expect(actual.runtime.setup.climateSelection).toEqual({ precipitation: 0, temperature: 0, wind: 0 });
    expect(actual.scenario.farm.workerExpenses).not.toBe(123456); expect(actual.runtime.finances.accounts.buildingBookValue).not.toBe(234567);
    expect(actual.runtime.random).not.toEqual(JSON.parse(prior.importOriginal(bytes, crops).simulation.withAllCrops(browserCrops).save(null)).runtime.random);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' }); expect(await save(page)).toEqual(JSON.parse(expected.save(null)));
});

test('legacy checkpoints restore unknown climate exactly and New Game loading needs no retained history', async ({ page }) => {
  await start(page); const legacy = await save(page); useOriginalCatalog(legacy); legacy.version = 20; delete legacy.runtime.setup.climateSelection;
  await chooser(page); await pick(page, 'legacy.json', Buffer.from(JSON.stringify(legacy)));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  const before = await save(page); expect(before.runtime.setup.climateSelection).toBeNull();
  await chooser(page); await pick(page, 'SCEN4.SSM', source('SCEN4.SSM'));
  await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
  expect(await save(page)).toEqual(JSON.parse(GameSimulation.openOriginalSave(source('SCEN4.SSM'), { date, seeds }, assets).withAllCrops(browserCrops).save(null)));
});

test('malformed saves, picker cancellation and cancellation during startup or tile loading preserve the current farm', async ({ page }) => {
  await start(page); const before = await save(page); await chooser(page);
  await page.locator('#setup-load-file').dispatchEvent('cancel'); expect(await save(page)).toEqual(before);
  for (const [name, bytes] of [['bad.SSM', source('SCEN4.SSM').subarray(0, -1)], ['bad.json', Buffer.from('{}')]] as const) {
    await pick(page, name, bytes); await reveal(page, '#new-farm-error'); await expect(page.locator('#new-farm-error')).toBeVisible(); expect(await save(page)).toEqual(before);
  }
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  for (const asset of ['new-farm-runtime.json', 'raw/ega16til.til']) {
    let requested!: () => void, finish!: () => void;
    const started = new Promise<void>(resolve => { requested = resolve; }), release = new Promise<void>(resolve => { finish = resolve; });
    await chooser(page);
    await page.route(`**/assets/${asset}`, async route => { requested(); await release; await route.continue().catch(() => {}); });
    await pick(page, 'SCEN4.SSM', source('SCEN4.SSM')); await started;
    await expect(page.locator('#region-load')).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); finish();
    await page.unroute(`**/assets/${asset}`); expect(await save(page)).toEqual(before);
    await reveal(page, '#new-farm'); await expect(page.locator('#new-farm')).toBeVisible();
  }
  await chooser(page); await pick(page, 'SCEN4.SSM', source('SCEN4.SSM'));
  await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
});
