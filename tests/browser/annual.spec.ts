import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
function yearEnd(cash = 40000) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar, { day: 6, week: 3, month: 11 });
  Object.assign(scenario.farm, { cash, salesAccumulator: 1000 });
  const save = JSON.parse(new GameSimulation(scenario, crops).save(4));
  save.runtime.finances.town.townRevenue = 50000; save.runtime.finances.town.recreationCount = 7;
  return JSON.stringify(save);
}
const file = (text: string) => ({ name: 'annual.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(text) });

test('annual taxes open a saved town choice, reject unavailable recreation and resume once after reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles(file(yearEnd()));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#tax-panel summary').click(); await expect(page.locator('#tax-estimate')).toHaveText('$4,715');
  await page.locator('#next-day').click();
  await expect(page.locator('#town-choice')).toBeVisible(); await expect(page.locator('#farm-cash')).toHaveText('$35,285');
  await expect(page.locator('#tax-result')).toHaveText('Paid $4,715 in annual tax.');
  await expect(page.locator('#play-pause')).toBeDisabled(); await expect(page.locator('#next-day')).toBeDisabled();
  await expect(page.locator('#simulation-speed')).toBeDisabled();
  await page.locator('#loan-panel summary').click(); await expect(page.locator('#borrow-loan')).toBeDisabled();
  await page.locator('#town-recreational').click(); await expect(page.locator('#town-choice-error')).toContainText('cannot support');
  const download = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = 'artifacts/browser-pending-town.simfarm.json'; await (await download).saveAs(path);
  const checkpoint = JSON.parse(readFileSync(path, 'utf8'));
  expect(checkpoint.runtime.pendingTown.phase).toBe('annual-reset'); expect(checkpoint.runtime.daysAdvanced).toBe(0);
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await expect(page.locator('#town-choice')).toBeVisible();
  await expect(page.locator('#farm-cash')).toHaveText('$35,285');
  const bad = structuredClone(checkpoint); bad.runtime.pendingTown.phase = 'tax';
  await page.locator('#load-farm-file').setInputFiles(file(JSON.stringify(bad)));
  await expect(page.locator('#save-status')).toContainText('pending town phase'); await expect(page.locator('#town-choice')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#town-choice').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-annual-choice.png', fullPage: true });
  await page.locator('#town-airport').click();
  await expect(page.locator('#town-choice')).toHaveCount(0); await expect(page.locator('#next-day')).toBeEnabled();
  await expect(page.locator('#time-status')).toContainText('Paused · 1 days advanced');
  await expect(page.locator('#farm-cash')).toHaveText('$35,285');
  await page.locator('#tax-panel summary').click(); await expect(page.locator('#tax-prior')).toHaveText('$4,715');
  await page.locator('#next-day').click(); await expect(page.locator('#farm-date')).toContainText('January 2, 1994');
  await expect(page.locator('#farm-cash')).toHaveText('$35,285'); expect(errors).toEqual([]);
});

test('unpaid annual taxes show the original penalty, persist and retry at the next month boundary', async ({ page }) => {
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles(file(yearEnd(0)));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#next-day').click();
  await expect(page.locator('#town-choice')).toHaveCount(0); await page.locator('#tax-panel summary').click();
  await expect(page.locator('#tax-result')).toHaveText('Unable to pay $4,715 in annual tax.');
  await expect(page.locator('#tax-debt')).toHaveText('$5,893'); await expect(page.locator('#tax-retries')).toContainText('3 monthly retries');
  const download = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = 'artifacts/browser-tax-debt.simfarm.json'; await (await download).saveAs(path);
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#tax-panel summary').click();
  await expect(page.locator('#tax-debt')).toHaveText('$5,893');
  for (let day = 0; day < 28; day++) await page.locator('#next-day').click();
  await expect(page.locator('#farm-date')).toContainText('February 1, 1994');
  await expect(page.locator('#tax-retries')).toContainText('2 monthly retries');
  await expect(page.locator('#tax-notices')).toHaveText('Taxes remain unpaid.');
});
