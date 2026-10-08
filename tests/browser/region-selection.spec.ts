import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { newFarmAssets } from '../support/new-farm';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { readArchive } from '../../src/formats/archive';
import { readSetupMap } from '../../src/formats/new-farm';
import { readNativeSave } from '../../src/formats/native-save';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const locations = readSetupMap(readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(e => e.name === 'scenario.odt')!.bytes).locations;
async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = `artifacts/browser-region-${name}.json`; await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}
async function openMap(page: Page) {
  await page.locator('#new-farm').click(); await page.locator('#new-farm-session').selectOption('fresh'); await page.locator('#choose-region').click();
  await expect(page.locator('#region-map')).toBeVisible();
}

test('region map selects source climate, supports keyboard and mobile layout, and creates exact generated continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before = await save(page, 'before'); await openMap(page);
  await expect(page.locator('[data-region="2,8"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('#region-map button:not(:disabled)').count()).toBe(178);
  await expect(page.locator('[data-region="17,0"]')).toBeDisabled();
  await page.locator('[data-region="2,8"]').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-region="3,8"]')).toBeFocused();
  await expect(page.locator('[data-region="3,8"]')).toHaveAttribute('aria-pressed', 'true');
  const p = locations[8 * 18 + 3];
  for (const channel of ['precipitation', 'temperature', 'wind'] as const) await expect(page.locator(`#new-farm-${channel}`)).toHaveValue(String(p[channel]));
  await page.keyboard.press('Home'); const first = locations.find(p => p.selectable)!;
  await expect(page.locator(`[data-region="${first.x},${first.y}"]`)).toBeFocused();
  await page.keyboard.press('End'); const last = locations.filter(p => p.selectable).at(-1)!;
  await expect(page.locator(`[data-region="${last.x},${last.y}"]`)).toBeFocused();
  await page.locator('[data-region="3,8"]').click(); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#new-farm-year').fill('1993'); await page.locator('#new-farm-seed').fill('9029');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-region-mobile.png', fullPage: true });
  expect(await save(page, 'selection-only')).toEqual(before);
  await page.locator('#create-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const generated = await save(page, 'generated'), options = generated.runtime.newFarm.provenance.options;
  expect(options.climate).toEqual({ precipitation: p.precipitation, temperature: p.temperature, wind: p.wind });
  const game = GameSimulation.createGeographic(options, newFarmAssets); expect(generated).toEqual(JSON.parse(game.save(null)));
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(await save(page, 'next-day')).toEqual(JSON.parse(game.save(null))); expect(errors).toEqual([]);
});

test('all eight map markers apply original post-load climate and town setup while preserving the saved date', async ({ page }) => {
  await page.goto('/');
  for (const [id, x, y] of [[0,0,8],[1,1,11],[2,1,3],[3,3,6],[4,9,7],[5,11,6],[6,13,11],[7,15,8]]) {
    await openMap(page); await page.locator(`[data-region="${x},${y}"]`).click();
    await expect(page.locator('#region-selection')).toContainText(`Scenario ${id + 1}`);
    await expect(page.locator('#new-farm-year')).toBeDisabled(); await expect(page.locator('#create-farm')).toHaveText(`Open Scenario ${id + 1}`);
    await page.locator('#create-farm').click(); await expect(page.locator('#map-status')).toHaveText(`Scenario ${id + 1} · original terrain`);
    const world = readScenario(source(`SCEN${id}.SSM`));
    const crops = world.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
    const expected = GameSimulation.openGeographicRegion(world.sourceBytes!, locations[y * 18 + x], { visual: 9029, simulation: 9029, bounded: 9029 }, { ...newFarmAssets, crops });
    expect(await save(page, `preset-${id}`)).toEqual(JSON.parse(expected.save(id)));
  }
});

test('region asset failures allow custom creation or retry, and cancelled preset loads cannot replace the farm', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before = await save(page, 'failure-before');
  await page.route('**/assets/scenario.png', route => route.fulfill({ status: 404, body: '' }));
  await page.locator('#new-farm').click(); await page.locator('#choose-region').click();
  await expect(page.locator('#region-error')).toContainText('scenario.png'); await expect(page.locator('#create-farm')).toBeDisabled();
  await page.locator('#design-farm').click(); await expect(page.locator('#create-farm')).toBeEnabled();
  await page.unroute('**/assets/scenario.png'); await page.locator('#choose-region').click(); await expect(page.locator('#region-map')).toBeVisible();
  await page.locator('[data-region="15,8"]').click();
  await page.route('**/assets/raw/SCEN7.SSM', route => route.fulfill({ status: 404, body: '' }));
  await page.locator('#create-farm').click(); await expect(page.locator('#new-farm-error')).toContainText('SCEN7.SSM');
  expect(await save(page, 'failed-preset')).toEqual(before); await page.unroute('**/assets/raw/SCEN7.SSM');
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void; const started = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/assets/raw/SCEN7.SSM', async route => { requested(); await wait; await route.fulfill({ body: source('SCEN7.SSM'), contentType: 'application/octet-stream' }).catch(() => {}); });
  await page.locator('#create-farm').click(); await started;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); release();
  await page.unroute('**/assets/raw/SCEN7.SSM'); expect(await save(page, 'cancelled-preset')).toEqual(before);
  await openMap(page); await expect(page.locator('[data-region="2,8"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-region="15,8"]').click(); await page.locator('#create-farm').click();
  await expect(page.locator('#map-status')).toHaveText('Scenario 8 · original terrain');
});

test('malformed region metadata is rejected, cancelling a pending map remains usable, and manual climate stays editable', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1'); const before = await save(page, 'metadata-before');
  await page.route('**/assets/new-farm-setup.json', async route => { const r = await route.fetch(), data = await r.json(); data.farms[0].x = 18; await route.fulfill({ json: data }); });
  await page.locator('#new-farm').click(); await page.locator('#choose-region').click();
  await expect(page.locator('#region-error')).toContainText('coordinate'); expect(await save(page, 'metadata-invalid')).toEqual(before);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.unroute('**/assets/new-farm-setup.json');
  let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void; const started = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/assets/raw/scenario.odt', async route => { requested(); await wait; await route.fulfill({ body: readFileSync('public/assets/raw/scenario.odt'), contentType: 'application/octet-stream' }).catch(() => {}); });
  await page.locator('#new-farm').click(); await page.locator('#choose-region').click(); await started;
  await expect(page.locator('#create-farm')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); release(); await page.unroute('**/assets/raw/scenario.odt');
  await page.locator('#new-farm').click(); await expect(page.locator('#create-farm')).toBeEnabled();
  await page.locator('#new-farm-temperature').selectOption('0'); await expect(page.locator('#new-farm-temperature')).toHaveValue('0');
  await page.locator('#choose-region').click(); await expect(page.locator('#region-map')).toBeVisible();
  await page.locator('#design-farm').click(); await expect(page.locator('#new-farm-temperature')).toBeEnabled();
  expect(await save(page, 'metadata-recovered')).toEqual(before);
});

test('unmarked retained geography keeps soil and source water flags while applying location climate through save/load', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const old = await save(page, 'warm-before'); old.runtime.weather.soilMoisture = 5; old.runtime.weather.moistureBalance = 0;
  await page.locator('#load-farm-file').setInputFiles({ name: 'retained-soil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  const before = await save(page, 'warm-entry');
  await page.locator('#new-farm').click(); await page.locator('#choose-region').click();
  await page.locator('[data-region="3,8"]').click(); await page.locator('#new-farm-year').fill('1993');
  await expect(page.locator('#new-farm-river')).toBeDisabled(); await expect(page.locator('#new-farm-river')).not.toBeChecked();
  await expect(page.locator('#new-farm-lake')).toBeDisabled();
  await page.locator('#create-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('#terrain-design')).toHaveCount(0);
  const actual = await save(page, 'warm-generated');
  expect(actual.runtime.weather.soilMoisture).toBe(5);
  expect(actual.runtime.newFarm.provenance.options.river).toBe(false);
  expect(actual.runtime.newFarm.provenance.options.lake).toBe(false);
  const oldWorld = readNativeSave(JSON.stringify(before)).state.scenario;
  const catalog = [...newFarmAssets.crops];
  for (const file of oldWorld.cropFiles) if (!catalog.some(c => `${c.id}.crp` === file)) catalog.push(readCrop(file.slice(0, -4), source(`CROPS/${file.toUpperCase()}`)));
  const expected = GameSimulation.load(JSON.stringify(before), catalog, newFarmAssets.townLayouts).simulation
    .restartGeographic(actual.runtime.newFarm.provenance.options, { ...newFarmAssets, crops: catalog });
  expect(actual).toEqual(JSON.parse(expected.save(null)));
  await page.locator('#load-farm-file').setInputFiles({ name: 'geography.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(actual)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let i = 0; i < 7; i++) { await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' }); }
  expect(await save(page, 'warm-continued')).toEqual(JSON.parse(expected.save(null)));
});

test('fresh numbered farms honor the explicit seed for discarded terrain and retain loaded clocks and date', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const bytes = source('SCEN4.SSM'), world = readScenario(bytes);
  const crops = world.cropFiles.map(file => readCrop(file.slice(0, -4), source(`CROPS/${file.toUpperCase()}`)));
  let previous: any;
  for (const seed of [19, 65535]) {
    await openMap(page); await page.locator('[data-region="9,7"]').click();
    await expect(page.locator('#new-farm-seed')).toBeEnabled(); await page.locator('#new-farm-seed').fill(String(seed));
    await expect(page.locator('#new-farm-year')).toBeDisabled();
    await page.locator('#create-farm').click(); await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
    const actual = await save(page, `fresh-seed-${seed}`);
    const expected = GameSimulation.openGeographicRegion(bytes, locations[7 * 18 + 9], { visual: seed, simulation: seed, bounded: seed }, { ...newFarmAssets, crops });
    expect(actual).toEqual(JSON.parse(expected.save(4)));
    expect(actual.runtime.dayTicks).toBe(world.farm.animationTicks);
    expect(actual.scenario.farm.calendar).toEqual(world.farm.calendar);
    if (previous) {
      expect(actual.scenario.source).toBe(previous.scenario.source);
      expect(actual.scenario.world).toBe(previous.scenario.world);
      expect(actual.runtime.setup.terrainHistory).not.toEqual(previous.runtime.setup.terrainHistory);
      expect(actual.runtime.random).not.toEqual(previous.runtime.random);
    }
    previous = actual;
  }
});
