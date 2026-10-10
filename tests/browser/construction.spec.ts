import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { readScenario, worldIndex } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';
import { checkBuildingPlacement } from '../../src/simulation/building-placement';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
async function selectTile(page: Page, x: number, y: number) {
  const viewport = page.locator('#viewport');
  await viewport.evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await viewport.scrollIntoViewIfNeeded();
  // Use a real pointer event at the tile center after viewport scrolling.
  const rect = await page.locator('#world').boundingBox(); expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await pending).saveAs(path); return readFileSync(path, 'utf8');
}

test('Build storage buys original roofs and usable records, persists accounts and fits a narrow screen', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const expected = new GameSimulation(scenario, crops).withAllCrops(browserCrops), initial = expected.getSnapshot();
  let point: { x: number; y: number } | undefined;
  for (let x = 0; x < 95 && !point; x++) for (let y = 0; y < 95 && !point; y++) {
    if (checkBuildingPlacement(scenario, 65, x, y, initial.weather.soilMoisture).ok) point = { x, y };
  }
  expect(point).toBeDefined(); const { x, y } = point!;
  await page.goto('/'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('65');
  await expect(page.locator('#build-building')).toBeDisabled();
  await selectTile(page, x, y); await expect(page.locator('#building-placement-status')).toContainText('Ready');
  await page.locator('#build-building').click(); expected.dispatch({ type: 'build', buildingType: 65, x, y });
  const result = expected.getSnapshot().lastBuildingResult; expect(result?.ok).toBe(true);
  await expect(page.locator('#building-result')).toContainText('Built for');
  await expect(page.locator('#build-building')).toBeDisabled(); await expect(page.locator('#building-placement-status')).toContainText('Another building');
  await expect(page.locator('#farm-cash')).toHaveText(`$${expected.getSnapshot().scenario.farm.cash.toLocaleString('en-US')}`);
  const text = await download(page, 'artifacts/browser-construction.simfarm.json');
  expect(JSON.parse(text)).toEqual(JSON.parse(expected.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles('artifacts/browser-construction.simfarm.json');
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  // No selection/preview after reload: compare all four roof tiles to the original atlas.
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) =>
    Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 32, 32).data), { x, y });
  const atlas = PNG.sync.read(readFileSync('public/assets/scenario4.tiles.png')), pixels: number[] = [];
  for (let py = 0; py < 32; py++) for (let px = 0; px < 32; px++) {
    const tile = 441 + Math.floor(py / 16) * 2 + Math.floor(px / 16);
    const pos = ((Math.floor(tile / 32) * 16 + py % 16) * atlas.width + tile % 32 * 16 + px % 16) * 4;
    pixels.push(...atlas.data.subarray(pos, pos + 4));
  }
  expect(actual).toEqual(pixels);
  await page.locator('#map-tool').selectOption('build'); await expect(page.locator('#building-result')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 }); await selectTile(page, x, y);
  await page.locator('#building-type').selectOption('69'); await page.locator('#building-type').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-construction.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('construction UI explains tree clearing and cash limits, rejects without charging, and updates its footprint', async ({ page }) => {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  Object.assign(scenario.farm, { cash: 2450, autoClear: false });
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) scenario.cells[worldIndex(x, y)] = { terrain: 15, overlay: 0x800, attribute: 0 };
  scenario.cells[0].terrain = 535; scenario.cells[worldIndex(1, 0)].terrain = 131;
  const expected = new GameSimulation(scenario, crops).withAllCrops(browserCrops);
  await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'trees.json', mimeType: 'application/json', buffer: Buffer.from(expected.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('65');
  await selectTile(page, 0, 0); await expect(page.locator('#building-placement-status')).toContainText('blocks');
  await expect(page.locator('#build-building')).toBeDisabled();
  await page.locator('#building-auto-clear').check(); expected.dispatch({ type: 'set-auto-clear', enabled: true });
  await expect(page.locator('#building-placement-status')).toContainText('$2,425 total ($25 clearing)');
  await page.locator('#building-type').selectOption('69'); await expect(page.locator('#building-placement-status')).toContainText('not enough cash');
  await expect(page.locator('#build-building')).toBeDisabled();
  await page.locator('#building-type').selectOption('65'); await page.locator('#build-building').click();
  expected.dispatch({ type: 'build', buildingType: 65, x: 0, y: 0 });
  await expect(page.locator('#farm-cash')).toHaveText('$25');
  expect(JSON.parse(await download(page, 'artifacts/browser-construction-clearing.simfarm.json'))).toEqual(JSON.parse(expected.save(4)));
  await selectTile(page, 3, 3); await expect(page.locator('#building-placement-status')).toContainText('not enough cash');
});
