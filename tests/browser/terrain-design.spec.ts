import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { readCrop } from '../../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { miniTileAtlas, readPalette } from '../../src/formats/graphics';
import { renderTerrainPreview } from '../../src/render/terrain-preview';
import { PRECIPITATION_PATTERNS } from '../../src/simulation/weather';
import { GameSimulation } from '../../src/simulation/game';
import { CustomFarmSetup } from '../../src/simulation/custom-farm-setup';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const raw = (name: string) => readFileSync(new URL('../../public/assets/raw/' + name, import.meta.url));
const crops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n))
  .map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
const assets = { ...newFarmAssets, crops };
const options = { ...newFarmOptions, seeds: { visual: 9029, simulation: 9029, bounded: 9029 } };
const miniature = miniTileAtlas(raw('far_mapc.mbm'), readPalette(raw('scenario.pal')));
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = await (await pending).path(); return JSON.parse(readFileSync(path!, 'utf8'));
}
async function pixels(page: Page) {
  return page.locator('#terrain-preview').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(0, 0, 192, 192).data));
}
async function expectPreview(page: Page, draft: CustomFarmSetup) {
  const p = draft.getSnapshot().preview;
  expect(await pixels(page)).toEqual(Array.from(renderTerrainPreview(p.world, miniature).rgba));
  await expect(page.locator('.terrain-marker')).toHaveText(['T', 'H']);
  const panel = (await page.locator('#terrain-design').boundingBox())!;
  for (const [letter, site] of [['T', p.locations!.town], ['H', p.locations!.player]] as const) {
    const marker = (await page.locator('.terrain-marker').filter({ hasText: letter }).boundingBox())!;
    expect((marker.x - panel.x) / panel.width).toBeCloseTo((264 + site.regionX * 16 - 128) / 352, 3);
    expect((marker.y - panel.y) / panel.height).toBeCloseTo((72 + site.regionY * 16 - 32) / 304, 3);
  }
  await expect(page.locator('#terrain-design .setup-title')).toHaveText('DESIGN YOUR TERRAIN');
  await expect(page.locator('#terrain-design label')).toHaveText(['Rainfall', 'Temperature', 'Wind speed']);
  await expect(page.locator('#terrain-design .setup-button')).toHaveText(['River', 'Lake', 'Generate World', 'Play']);
  // Text remains selectable/copyable and fits at desktop and narrow widths.
  expect(await page.locator('#terrain-design .setup-title').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    return range.toString();
  })).toBe('DESIGN YOUR TERRAIN');
  expect(await page.locator('#terrain-design .setup-button, #terrain-design .setup-text').evaluateAll(els =>
    els.every(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight))).toBe(true);
}
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}

test('custom screen uses HTML text over exact terrain pixels and Play accepts its unchanged map after option edits', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/raw/egafont.fnt', route => route.abort()); // Live text has no font-bitmap dependency.
  await start(page); const before = await save(page);
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await reveal(page, '#new-farm-session'); await page.locator('#new-farm-session').selectOption('fresh');
  await reveal(page, '#create-farm'); await page.locator('#create-farm').click(); await expect(page.getByRole('heading', { name: 'Design your terrain' })).toBeFocused();
  const draft = CustomFarmSetup.fresh(options, assets); await expectPreview(page, draft);
  expect(await save(page)).toEqual(before);
  await reveal(page, '#terrain-precipitation'); await page.locator('#terrain-precipitation').focus(); await page.keyboard.press('Home');
  await reveal(page, '#terrain-temperature'); await page.locator('#terrain-temperature').focus(); await page.keyboard.press('End');
  await reveal(page, '#terrain-river'); await page.locator('#terrain-river').click(); await reveal(page, '#terrain-lake'); await page.locator('#terrain-lake').click();
  draft.setSettings({ ...options, climate: { precipitation: 0, temperature: 3, wind: 1 }, river: false, lake: true });
  await expect(page.locator('#terrain-settings')).toContainText('Rainfall: Low');
  await expectPreview(page, draft); // No regeneration on either keyboard or water changes.
  await page.locator('#terrain-design').screenshot({ path: 'artifacts/browser-terrain-design-desktop.png' });
  await reveal(page, '#play-farm'); await page.locator('#play-farm').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const expected = GameSimulation.load(writeNativeSave(draft.accept('selected-climate'), null), browserCrops, assets.townLayouts).simulation.withAllCrops(browserCrops);
  expect(await save(page)).toEqual(JSON.parse(expected.save(null)));
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  expect(await save(page)).toEqual(JSON.parse(expected.save(null)));
  expect(errors).toEqual([]);
});

test('mobile restart rerolls retain original streams, respond to keyboard and continue exactly after Play', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 }); await start(page);
  const before = await save(page), draft = CustomFarmSetup.restart(readNativeSave(JSON.stringify(before)).state, options, assets);
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await reveal(page, '#create-farm'); await page.locator('#create-farm').click();
  await expectPreview(page, draft);
  await page.getByRole('button', { name: 'Increase rainfall', exact: true }).click();
  draft.setSettings({ ...options, climate: { ...options.climate, precipitation: 3 } });
  await reveal(page, '#generate-world'); await page.locator('#generate-world').focus();
  for (let i = 0; i < 2; i++) { await page.keyboard.press('Enter'); draft.generateWorld(); await expectPreview(page, draft); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.locator('#terrain-design').screenshot({ path: 'artifacts/browser-terrain-design-mobile.png' });
  await reveal(page, '#play-farm'); await page.locator('#play-farm').click();
  const game = GameSimulation.load(writeNativeSave(draft.accept('selected-climate'), null), browserCrops, assets.townLayouts).simulation.withAllCrops(browserCrops);
  const accepted = await save(page); expect(accepted).toEqual(JSON.parse(game.save(null)));
  await page.locator('#load-farm-file').setInputFiles({ name: 'preview.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(accepted)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  for (let i = 0; i < 7; i++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(null)));
});

test('missing preview assets and cancellation leave the old farm intact and allow a fresh preview', async ({ page }) => {
  await start(page); const before = await save(page);
  await page.route('**/assets/raw/far_mapc.mbm', route => route.fulfill({ status: 200, body: Buffer.alloc(0), contentType: 'application/octet-stream' }));
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await reveal(page, '#create-farm'); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toContainText('Invalid miniature tile atlas');
  expect(await save(page)).toEqual(before);
  await page.unroute('**/assets/raw/far_mapc.mbm'); await reveal(page, '#create-farm'); await page.locator('#create-farm').click();
  await reveal(page, '#generate-world'); await page.locator('#generate-world').click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await save(page)).toEqual(before);
  let requested!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/assets/defworld.png', async route => { requested(); await release; await route.continue().catch(() => {}); });
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await reveal(page, '#create-farm'); await page.locator('#create-farm').click(); await started;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); finish();
  await page.unroute('**/assets/defworld.png'); expect(await save(page)).toEqual(before);
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await reveal(page, '#create-farm'); await page.locator('#create-farm').click();
  await expectPreview(page, CustomFarmSetup.restart(readNativeSave(JSON.stringify(before)).state, options, assets));
});

test('extreme retained soil rejects unplaceable terrain atomically and Start fresh remains available', async ({ page }) => {
  await start(page); const original = await save(page); original.runtime.weather.soilMoisture = -128;
  await page.locator('#load-farm-file').setInputFiles({ name: 'soil-boundary.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); const before = await save(page);
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await reveal(page, '#create-farm'); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toContainText('No starting property fits this preview');
  await expect(page.locator('#play-farm')).toHaveCount(0); expect(await save(page)).toEqual(before);
  await reveal(page, '#new-farm-session'); await page.locator('#new-farm-session').selectOption('fresh'); await reveal(page, '#create-farm'); await page.locator('#create-farm').click();
  await expect(page.locator('#new-farm-error')).toHaveCount(0);
  await expect(page.locator('#play-farm')).toBeEnabled(); await reveal(page, '#play-farm'); await page.locator('#play-farm').click();
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  expect((await save(page)).runtime.weather.soilMoisture).toBe(8);
});


for (const session of ['fresh', 'restart']) test(`${session} custom farms start with the selected climate and remembered Options`,async({page})=>{
  await start(page);
  const prior = await save(page);
  Object.assign(prior.runtime.weather, { nextForecast: Array(7).fill(3), forecast: Array(7).fill(3), current: 3,
    wind: 75, windAnomaly: 60, temperatureAnomaly: 22, moistureBalance: 32, precipitationBonus: 4 });
  prior.runtime.disasters.flags |= 31; prior.runtime.disasterFlags = prior.runtime.disasters.flags;
  await page.locator('#load-farm-file').setInputFiles({name:'storm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prior))});
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'AutoDoze',exact:true}).click();
  await reveal(page,'#new-farm');await page.locator('#new-farm').click();await reveal(page,'#new-farm-session');await page.locator('#new-farm-session').selectOption(session);
  await reveal(page,'#create-farm');await page.locator('#create-farm').click();
  for(const channel of ['precipitation','temperature','wind']){await reveal(page,'#terrain-'+channel);await page.locator('#terrain-'+channel).focus();await page.keyboard.press('Home');}
  await expect(page.locator('#terrain-settings')).toContainText('Rainfall: Low · Temperature: Low · Wind: Low');
  await reveal(page,'#play-farm');await page.locator('#play-farm').click();await expect(page.locator('#map-status')).toContainText('Generated farm');
  const state=readNativeSave(JSON.stringify(await save(page))).state;
  expect(state.setup.climateSelection).toEqual({precipitation:0,temperature:0,wind:0});
  expect(state.scenario.climate).toEqual({precipitation:assets.climate.precipitation[0],temperature:assets.climate.temperature[0],wind:assets.climate.wind[0]});
  expect(state.scenario.farm.autoClear).toBe(true);
  const {weather:w,scenario:{climate, farm:{calendar:c}}}=state, index=c.month*4+c.week;
  expect(w.temperature).toBe(climate.temperature[index]);expect(w.wind).toBe(climate.wind[index]);
  expect(w.forecast.map(code=>Number(code>=3))).toEqual(PRECIPITATION_PATTERNS[climate.precipitation[index]]);
  expect(w.nextForecast.map(code=>Number(code>=3))).toEqual(PRECIPITATION_PATTERNS[climate.precipitation[index+1]]);
  expect(w.current).toBe(w.forecast[c.day]);expect(w.precipitationActive).toBe(w.current>=3);
  expect([w.windAnomaly,w.temperatureAnomaly,w.moistureBalance,w.precipitationBonus]).toEqual([0,0,0,0]);
  expect(state.disasters.flags&31).toBe(0);expect(w.soilMoisture).toBe(8);
  const accepted=await save(page);
  await page.locator('#load-farm-file').setInputFiles({name:'accepted.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(accepted))});
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');expect(await save(page)).toEqual(accepted);
});
