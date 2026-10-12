import {readSaveText} from '../support/save-file';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readScenario, worldIndex } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
test('weekly town construction repaints the map and resumes exactly after a browser reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar, { day: 6, week: 0, month: 1 });
  const ri = 3 * 12 * 7;
  scenario.regionalConditions[ri] = 6;
  for (let x = 24; x < 32; x++) for (let y = 0; y < 8; y++) {
    scenario.cells[worldIndex(x, y)].terrain = 15; scenario.cells[worldIndex(x, y)].overlay = 0;
  }
  const initial = new GameSimulation(scenario, crops).withAllCrops(browserCrops).save(4), expected = GameSimulation.load(initial, browserCrops).simulation.withAllCrops(browserCrops);
  await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'town.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(initial) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  const pixels = () => page.locator('#world').evaluate((canvas: HTMLCanvasElement) =>
    Array.from(canvas.getContext('2d')!.getImageData(24 * 16, 0, 128, 128).data));
  const before = await pixels();
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  expect(await pixels()).not.toEqual(before);
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const download = await pending, path = 'artifacts/browser-town.simfarm.json'; await download.saveAs(path);
  const saved = JSON.parse(readSaveText(path));
  expect(saved).toEqual(JSON.parse(expected.save(4)));
  expect(Buffer.from(saved.scenario.regions, 'hex')[ri]).toBe(0x16);
  expect(saved.runtime.finances.town.townRevenue).toBe(4700);
  const grown = await pixels(); await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); expect(await pixels()).toEqual(grown);
  for (let day = 0; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' }); }
  const nextDownload = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await nextDownload).saveAs(path);
  expect(JSON.parse(readSaveText(path))).toEqual(JSON.parse(expected.save(4)));
  await page.locator('#viewport').evaluate(el => el.scrollTo(24 * 16, 0));
  await page.screenshot({ path: 'artifacts/browser-town.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('missing and truncated original town layouts prevent startup with a clear asset error', async ({ page }) => {
  await page.route('**/assets/raw/townly0.cmp', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SimFarm assets unavailable' })).toBeVisible();
  await expect(page.locator('.loading')).toContainText('Missing game asset: raw/townly0.cmp');
  await page.unroute('**/assets/raw/townly0.cmp');
  await page.route('**/assets/raw/townly0.cmp', route => route.fulfill({ body: Buffer.alloc(1919), contentType: 'application/octet-stream' }));
  await page.reload();
  await expect(page.locator('.loading')).toContainText('Invalid town layout size');
  await expect(page.locator('#play-pause')).toHaveCount(0);
});
