import { browserCrops } from '../support/crop-catalog';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { GameSimulation } from '../support/game';
import { removeField } from '../../src/simulation/field-removal';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
test('saved field clearing advances original animation tiles, pauses and reloads without replaying frames', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0); Object.assign(scenario.farm.calendar, { day: 0, week: 0, month: 0 });
  const { state } = readNativeSave(new GameSimulation(scenario, crops).withAllCrops(browserCrops).save(4));
  state.scenario.farm.animationTicks = state.equipmentAnimationTick = state.finances.clearing.lastTick = 0;
  state.scenario.farm.dayDelayTicks = 16;
  const { x, y, width, height } = state.scenario.fields[1];
  expect(removeField(state.scenario, 1, state.finances.clearing, state.weather.soilMoisture)).toBe(true);
  const text = writeNativeSave(state, 4), expected = GameSimulation.load(text, browserCrops).simulation.withAllCrops(browserCrops);
  await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'clearing.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  const pixels = () => page.locator('#world').evaluate((canvas: HTMLCanvasElement, box) =>
    Array.from(canvas.getContext('2d')!.getImageData(box.x * 16, box.y * 16, box.width * 16, box.height * 16).data), { x, y, width, height });
  const initial = await pixels();
  await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  const first = await pixels(); expect(first).not.toEqual(initial);
  await page.waitForTimeout(150); expect(await pixels()).toEqual(first); // Native Pause also freezes clearing.
  const download = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = 'artifacts/browser-clearing.simfarm.json'; await (await download).saveAs(path);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  expect(saved).toEqual(JSON.parse(expected.save(4))); expect(saved.runtime.finances.clearing.count).toBe(64);
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); expect(await pixels()).toEqual(first);
  for (let day = 0; day < 9; day++) { await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' }); }
  const finalDownload = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await finalDownload).saveAs(path);
  const done = JSON.parse(readFileSync(path, 'utf8'));
  expect(done).toEqual(JSON.parse(expected.save(4))); expect(done.runtime.finances.clearing.count).toBe(0);
  expect(await pixels()).not.toEqual(first);
  await page.locator('#viewport').evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await page.screenshot({ path: 'artifacts/browser-clearing-complete.png', fullPage: true });
  expect(errors).toEqual([]);
});
