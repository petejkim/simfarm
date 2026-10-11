import {loadScenarioCheckpoint} from '../support/scenario-checkpoint';
import { clickFarmTile, setAutoDoze } from '../support/field-actions';
import { buyBuilding, selectBuilding } from '../support/building-actions';
import { reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { readScenario, worldIndex } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';
import { checkBuildingPlacement } from '../../src/simulation/building-placement';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  await (await pending).saveAs(path); return readFileSync(path, 'utf8');
}

test('original Buy purchases storage roofs and usable records and persists accounts', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const expected = new GameSimulation(scenario, crops).withAllCrops(browserCrops), initial = expected.getSnapshot();
  let point: { x: number; y: number } | undefined;
  for (let x = 0; x < 95 && !point; x++) for (let y = 0; y < 95 && !point; y++) {
    if (checkBuildingPlacement(scenario, 65, x, y, initial.weather.soilMoisture).ok) point = { x, y };
  }
  expect(point).toBeDefined(); const { x, y } = point!;
  await page.goto('/'); await loadScenarioCheckpoint(page,4);
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await buyBuilding(page,65,x,y); expected.dispatch({ type: 'build', buildingType: 65, x, y });
  const result = expected.getSnapshot().lastBuildingResult; expect(result?.ok).toBe(true);
  await clickFarmTile(page,x,y); await expect(page.locator('#buy-result')).toHaveText('This location is occupied.');
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
  await expect(page.locator('#cancel-buy-placement')).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 844 }); await selectBuilding(page,69);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-construction.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('original building placement rejects blocked ground and cash limits, and Options AutoDoze clears trees', async ({ page }) => {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  Object.assign(scenario.farm, { cash: 2450, autoClear: false });
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) scenario.cells[worldIndex(x, y)] = { terrain: 15, overlay: 0x800, attribute: 0 };
  scenario.cells[0].terrain = 535; scenario.cells[worldIndex(1, 0)].terrain = 131;
  const expected = new GameSimulation(scenario, crops).withAllCrops(browserCrops);
  await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'trees.json', mimeType: 'application/json', buffer: Buffer.from(expected.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await selectBuilding(page,65);await clickFarmTile(page,0,0);
  await expect(page.locator('#buy-result')).toHaveText('Choose clear ground or compatible storage.');
  expect(JSON.parse(await download(page,'artifacts/browser-construction-blocked.simfarm.json'))).toEqual(JSON.parse(expected.save(4)));
  await setAutoDoze(page,true);expected.dispatch({type:'set-auto-clear',enabled:true});
  await selectBuilding(page,69);await clickFarmTile(page,0,0);await expect(page.locator('#buy-result')).toHaveText('Not enough cash.');
  expect(JSON.parse(await download(page,'artifacts/browser-construction-cash.simfarm.json'))).toEqual(JSON.parse(expected.save(4)));
  await buyBuilding(page,65,0,0);
  expected.dispatch({ type: 'build', buildingType: 65, x: 0, y: 0 });
  await expect(page.locator('#farm-cash')).toHaveText('$25');
  expect(JSON.parse(await download(page, 'artifacts/browser-construction-clearing.simfarm.json'))).toEqual(JSON.parse(expected.save(4)));
  await selectBuilding(page,65);await clickFarmTile(page,3,3);await expect(page.locator('#buy-result')).toHaveText('Not enough cash.');
});
