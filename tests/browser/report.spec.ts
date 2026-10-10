import { browserCrops } from '../support/crop-catalog';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));

test('Farm report displays original totals and field conditions, updates after payments and survives reload without rewriting caches', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const scenario = readScenario(source('SCEN4.SSM')); scenario.schedule.bytes.fill(0);
  for (const f of scenario.fields) { f.bytes[54] = 0; f.bytes[55] = 0; }
  scenario.fields[1].bytes[54] = 0x84; scenario.fields[2].bytes[54] = 4;
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const save = JSON.parse(new GameSimulation(scenario, crops).withAllCrops(browserCrops).save(4)), f = save.runtime.finances;
  Object.assign(save.scenario.farm, { cropIncome: 500, contractGains: 0, seedExpenses: 1000, rentalExpenses: 0,
    landExpenses: 0, contractLosses: 0, workerExpenses: 20, chemicalExpenses: 30 });
  Object.assign(f.accounts, { landIncome: 0, equipmentExpenses: 0, taxExpenses: 0, balancePayments: 40 });
  Object.assign(f.accounts.assets, { equipmentIncome: 0, livestockIncome: 0 });
  for (const key of Object.keys(f.annual)) f.annual[key] = 0;
  Object.assign(f.annual, { reportIncome: 123, reportExpenses: 456, reportNet: 789 });
  await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'report.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#farm-report summary').click();
  await expect(page.locator('#report-income')).toHaveText('$500'); await expect(page.locator('#report-expenses')).toHaveText('$1,000');
  await expect(page.locator('#report-net')).toHaveText('-$500'); await expect(page.locator('#report-workers')).toHaveText('$20');
  await expect(page.locator('#report-chemicals')).toHaveText('$30'); await expect(page.locator('#report-loans')).toHaveText('$40');
  await expect(page.locator('#report-fields')).toHaveText('8'); await expect(page.locator('#report-nutrients')).toHaveText('1');
  await expect(page.locator('#report-toxicity')).toHaveText('2'); await expect(page.locator('#report-alerts')).toHaveText('2');
  await page.locator('#loan-panel summary').click(); await page.locator('#loan-amount').fill('1000'); await page.locator('#borrow-loan').click();
  await page.locator('#repay-loan').click();
  await expect(page.locator('#report-net')).toHaveText('-$500'); await expect(page.locator('#report-loans')).toHaveText('$1,040');
  const download = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = 'artifacts/browser-report.simfarm.json'; await (await download).saveAs(path);
  const saved = JSON.parse(readFileSync(path, 'utf8')); expect(saved.runtime.finances.annual).toEqual(f.annual);
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#farm-report summary').click(); await expect(page.locator('#report-net')).toHaveText('-$500');
  await expect(page.locator('#report-loans')).toHaveText('$1,040');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#farm-report').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-farm-report.png', fullPage: true });
  expect(errors).toEqual([]);
});
