import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';

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

// This verifies generated restart checkpoints in the browser. The live New farm
// dialog remains the separate cold-entry path until both chooser outcomes exist.
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
  expect(initial.version).toBe(19); expect(initial.runtime.newFarm.provenance.kind).toBe('restart');
  expect(initial.runtime.setup.sourceArchive).toBe(source('SCEN4.SSM').toString('hex'));
  expect(initial).toEqual(JSON.parse(game.save(null)));
  for (let day = 0; day < 7; day++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  const advanced = await save(page, 'advanced'); expect(advanced).toEqual(JSON.parse(game.save(null)));
  await load(page, JSON.stringify(advanced)); expect(await save(page, 'restored')).toEqual(advanced);
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(await save(page, 'continued')).toEqual(JSON.parse(game.save(null)));
  expect(requests).toEqual([]); expect(errors).toEqual([]);
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
  expect(migrated.runtime.setup).toEqual({ terrainHistory: null, sourceArchive: null });
  expect(migrated).toEqual(JSON.parse(expected.save(0)));
  await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  const advanced = await save(page, 'legacy-advanced'); expect(advanced).toEqual(JSON.parse(expected.save(0)));
  await load(page, JSON.stringify(advanced)); expect(await save(page, 'legacy-restored')).toEqual(advanced);
});
