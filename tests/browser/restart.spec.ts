import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';
import { readArchive } from '../../src/formats/archive';
import { readSetupMap } from '../../src/formats/new-farm';
import { CustomFarmSetup } from '../../src/simulation/custom-farm-setup';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const { seeds: _, ...options } = newFarmOptions;

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'restart.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const download = await pending, path = `artifacts/browser-restart-${name}.json`;
  await download.saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('accepted custom preview survives browser import and retains exact continuation and wrapper bytes', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const old = new GameSimulation(readScenario(source('SCEN4.SSM')), crops, assets.townLayouts);
  const draft = CustomFarmSetup.restart(readNativeSave(old.save(null)).state, options, assets);
  draft.generateWorld(); draft.generateWorld();
  draft.setSettings({ ...options, climate: { precipitation: 0, temperature: 3, wind: 0 }, river: false, lake: true });
  const preview = draft.getSnapshot().preview;
  const game = GameSimulation.load(writeNativeSave(draft.accept(), null), crops, assets.townLayouts).simulation;
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await load(page, game.save(null));
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  const initial = await save(page, 'preview-accepted');
  expect(initial).toEqual(JSON.parse(game.save(null)));
  expect(initial.runtime.setup.previewRaw).toEqual({ ds1521: 201, ds23db: 201 });
  expect(initial.runtime.setup.terrainHistory).toEqual(preview.terrainHistory);
  expect(initial.runtime.setup.climateSelection).toEqual({ precipitation: 0, temperature: 3, wind: 0 });
  expect(initial.runtime.weather.soilMoisture).toBe(preview.terrain.soilMoisture);
  for (let day = 0; day < 7; day++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  const advanced = await save(page, 'preview-advanced'); expect(advanced).toEqual(JSON.parse(game.save(null)));
  await load(page, JSON.stringify(advanced)); expect(await save(page, 'preview-restored')).toEqual(advanced);
  const imported = game.importOriginal(source('SCEN4.SSM'), crops).simulation;
  await page.locator('#load-farm-file').setInputFiles({ name: 'SCEN4.SSM', mimeType: 'application/octet-stream', buffer: source('SCEN4.SSM') });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  expect(await save(page, 'preview-original-import')).toEqual(JSON.parse(imported.save(null)));
  expect(imported.getSnapshot().setup.previewRaw).toEqual({ ds1521: 201, ds23db: 201 });
  expect(imported.getSnapshot().setup.climateSelection).toEqual({ precipitation: 0, temperature: 3, wind: 0 });
  expect(errors).toEqual([]);
});

test('a generated restart checkpoint preserves its original archive and continues exactly through browser save/load', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const original = new GameSimulation(readScenario(source('SCEN4.SSM')), crops, assets.townLayouts);
  original.dispatch({ type: 'advance-day' });
  const game = original.restartGenerated(options, assets);
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const requests: string[] = [];
  await page.route('**/assets/raw/SCEN*.SSM', route => { requests.push(route.request().url()); return route.abort(); });
  await load(page, game.save(null));
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  const initial = await save(page, 'initial');
  expect(initial.version).toBe(22); expect(initial.runtime.newFarm.provenance.kind).toBe('restart');
  expect(initial.runtime.setup.sourceArchive).toBe(source('SCEN4.SSM').toString('hex'));
  expect(initial).toEqual(JSON.parse(game.save(null)));
  for (let day = 0; day < 7; day++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  const advanced = await save(page, 'advanced'); expect(advanced).toEqual(JSON.parse(game.save(null)));
  await load(page, JSON.stringify(advanced)); expect(await save(page, 'restored')).toEqual(advanced);
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(await save(page, 'continued')).toEqual(JSON.parse(game.save(null)));
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('New farm restarts the active session, cancels safely and restores its generated continuation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#next-day').click();
  const before = await save(page, 'live-before');
  await page.locator('#new-farm').click();
  await expect(page.locator('#new-farm-session')).toHaveValue('restart');
  await expect(page.locator('#new-farm-seed')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await save(page, 'live-cancelled')).toEqual(before);
  await page.locator('#new-farm').click(); await page.locator('#new-farm-year').fill('1993');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'artifacts/browser-restart-mobile.png', fullPage: true });
  await page.locator('#create-farm').click(); await page.locator('#play-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const restarted = await save(page, 'live-generated');
  const draft = CustomFarmSetup.restart(readNativeSave(JSON.stringify(before)).state, restarted.runtime.newFarm.provenance.options, assets);
  const expected = GameSimulation.load(writeNativeSave(draft.accept(), null), crops, assets.townLayouts).simulation;
  expect(restarted).toEqual(JSON.parse(expected.save(null)));
  expect(restarted.runtime.newFarm.provenance.kind).toBe('restart');
  await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  const advanced = await save(page, 'live-generated-day'); expect(advanced).toEqual(JSON.parse(expected.save(null)));
  await load(page, JSON.stringify(advanced)); expect(await save(page, 'live-generated-restored')).toEqual(advanced);
});

test('all eight live restart markers retain session history and continue after original preset setup', async ({ page }) => {
  const locations = readSetupMap(readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(e => e.name === 'scenario.odt')!.bytes).locations;
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  for (const [id, x, y] of [[0,0,8],[1,1,11],[2,1,3],[3,3,6],[4,9,7],[5,11,6],[6,13,11],[7,15,8]]) {
    const before = await save(page, `live-region-before-${id}`);
    const expected = GameSimulation.load(JSON.stringify(before), crops, assets.townLayouts).simulation
      .restartRegion(source(`SCEN${id}.SSM`), locations[y * 18 + x], assets);
    await page.locator('#new-farm').click(); await page.locator('#choose-region').click();
    await page.locator(`[data-region="${x},${y}"]`).click(); await page.locator('#create-farm').click();
    await expect(page.locator('#map-status')).toHaveText(`Scenario ${id + 1} · original terrain`);
    expect(await save(page, `live-region-${id}`)).toEqual(JSON.parse(expected.save(id)));
    await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
    const advanced = await save(page, `live-region-day-${id}`); expect(advanced).toEqual(JSON.parse(expected.save(id)));
    await load(page, JSON.stringify(advanced)); expect(await save(page, `live-region-restored-${id}`)).toEqual(advanced);
  }
});

test('older original saves explain missing restart history and allow an explicit fresh farm', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const legacy = await save(page, 'live-legacy-before'); legacy.version = 18; delete legacy.runtime.setup;
  await load(page, JSON.stringify(legacy)); await page.locator('#new-farm').click();
  await expect(page.locator('#restart-unavailable')).toContainText('older save');
  await expect(page.locator('#create-farm')).toBeDisabled();
  await page.locator('#choose-region').click(); await page.locator('[data-region="0,8"]').click();
  await expect(page.locator('#create-farm')).toBeDisabled();
  await page.locator('#design-farm').click(); await expect(page.locator('#create-farm')).toBeDisabled();
  await page.locator('#new-farm-session').selectOption('fresh');
  await expect(page.locator('#new-farm-seed')).toBeEnabled(); await expect(page.locator('#restart-unavailable')).toHaveCount(0);
  await page.locator('#create-farm').click(); await page.locator('#play-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const fresh = await save(page, 'live-legacy-fresh'); expect(fresh.runtime.newFarm.provenance.kind).toBe('cold-start');
  expect(fresh.runtime.setup.terrainHistory).not.toBeNull(); expect(fresh.runtime.setup.sourceArchive).toBeNull();
});

test('invalid setup state leaves the browser farm intact and legacy original saves keep unknown terrain history', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before = await save(page, 'before-failure');
  for (const setup of [undefined, { ...before.runtime.setup, terrainHistory: [0] }, { ...before.runtime.setup, sourceArchive: '18' }]) {
    const bad = structuredClone(before); bad.runtime.setup = setup;
    await page.locator('#load-farm-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await expect(page.locator('#save-status')).toContainText('Could not load farm');
    expect(await save(page, 'after-failure')).toEqual(before);
  }
  const legacy = structuredClone(before); legacy.version = 18; delete legacy.runtime.setup;
  const expected = GameSimulation.load(JSON.stringify(legacy), crops, assets.townLayouts).simulation;
  await load(page, JSON.stringify(legacy));
  const migrated = await save(page, 'legacy');
  expect(migrated.runtime.setup).toEqual({ terrainHistory: null, sourceArchive: null, previewRaw: null, climateSelection: null });
  expect(migrated).toEqual(JSON.parse(expected.save(0)));
  await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  const advanced = await save(page, 'legacy-advanced'); expect(advanced).toEqual(JSON.parse(expected.save(0)));
  await load(page, JSON.stringify(advanced)); expect(await save(page, 'legacy-restored')).toEqual(advanced);
});


test('v20 climate selection stays unknown through browser import until an explicit new choice is accepted', async ({ page }) => {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const game = GameSimulation.createNew(newFarmOptions, assets), legacy = JSON.parse(game.save(null));
  legacy.version = 20; delete legacy.runtime.setup.climateSelection;
  await load(page, JSON.stringify(legacy));
  const migrated = await save(page, 'v20-climate');
  expect(migrated.version).toBe(22); expect(migrated.runtime.setup.climateSelection).toBeNull();
  expect(migrated.scenario).toEqual({ ...legacy.scenario, farm: { ...legacy.scenario.farm, equipmentPacingByte: null } }); expect(migrated.runtime.random).toEqual(legacy.runtime.random);
  // SSM tables are unrelated to the retained chooser level bytes.
  await page.locator('#load-farm-file').setInputFiles({ name: 'SCEN4.SSM', mimeType: 'application/octet-stream', buffer: source('SCEN4.SSM') });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  const imported = await save(page, 'unknown-after-import'); expect(imported.runtime.setup.climateSelection).toBeNull();
  for (const selection of [undefined, { precipitation: 0, temperature: 0, wind: 4 }]) {
    const bad = structuredClone(imported); bad.runtime.setup.climateSelection = selection;
    await page.locator('#load-farm-file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await expect(page.locator('#save-status')).toContainText('Could not load farm');
    expect(await save(page, 'climate-error')).toEqual(imported);
  }
  await page.locator('#new-farm').click(); await page.locator('#create-farm').click();
  await page.locator('#terrain-precipitation').focus(); await page.keyboard.press('End');
  await page.locator('#terrain-temperature').focus(); await page.keyboard.press('Home');
  await page.locator('#terrain-wind').focus(); await page.keyboard.press('End');
  await page.locator('#play-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const accepted = await save(page, 'climate-established');
  expect(accepted.runtime.setup.climateSelection).toEqual({ precipitation: 3, temperature: 0, wind: 3 });
  await load(page, JSON.stringify(accepted)); expect(await save(page, 'climate-restored')).toEqual(accepted);
});
