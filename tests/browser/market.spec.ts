import { reveal, openWindow } from '../support/workspace';
import { browserCrops, useOriginalCatalog } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { disasterFixture } from '../support/disasters';
import { GameSimulation } from '../support/game';
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'market.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = `artifacts/browser-market-${name}.json`; await (await pending).saveAs(path);
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('planting keeps trade quotes until the weekly market updates seed purchases, with exact restored continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = disasterFixture(); f.state.scenario.farm.calendar.day = 6; f.state.dayTicks = 64;
  f.state.disasters.enabled = false; f.state.random.simulation = 9029;
  const game = f.load().withAllCrops(browserCrops); game.dispatch({ type: 'build', buildingType: 66, x: 10, y: 10 });
  const before = game.getSnapshot();
  await page.goto('/'); await load(page, game.save(4));
  await reveal(page, '#field'); await page.locator('#field').selectOption('1'); await reveal(page, '#plant-crop'); await page.locator('#plant-crop').selectOption('0'); await reveal(page, '#plant-field'); await page.locator('#plant-field').click();
  game.dispatch({ type: 'plant-field', fieldSlot: 1, cropSlot: 0 });
  const planted = await save(page, 'planted');
  expect(planted.runtime.market.history[0][29]).toBe(113);
  expect(planted.runtime.cropMarketPrices).toEqual(before.cropMarketPrices);
  expect(planted).toEqual(JSON.parse(game.save(4)));
  await openWindow(page, 'navigation'); await page.getByRole('button', { name: 'Seeds & chemicals', exact: true }).click();
  await reveal(page, '#crop-supply-type'); await page.locator('#crop-supply-type').selectOption('192'); await reveal(page, '#crop-supply-storage'); await page.locator('#crop-supply-storage').selectOption('1');
  await expect(page.locator('#crop-supply-quote')).toContainText('$32 total');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const price = game.getSnapshot().scenario.seedDefinitions[0].price; expect(price).not.toBe(32);
  await expect(page.locator('#crop-supply-quote')).toContainText(`$${price} total`);
  const week = await save(page, 'weekly'); expect(week).toEqual(JSON.parse(game.save(4)));
  expect(week.runtime.market.history.map((h: number[]) => h[29])).toEqual(week.runtime.cropMarketPrices);
  await load(page, JSON.stringify(week));
  await openWindow(page, 'navigation'); await page.getByRole('button', { name: 'Seeds & chemicals', exact: true }).click();
  await reveal(page, '#crop-supply-storage'); await page.locator('#crop-supply-storage').selectOption('1'); await reveal(page, '#buy-crop-supply'); await page.locator('#buy-crop-supply').click();
  game.dispatch({ type: 'buy-crop-supply', productType: 192, x: 10, y: 10 });
  await expect(page.locator('#crop-supply-result')).toContainText(`purchased for $${price}`);
  expect(await save(page, 'purchase')).toEqual(JSON.parse(game.save(4)));
  expect(errors).toEqual([]);
});

test('legacy market migration keeps unknown samples through browser save/load and malformed market rejection is atomic', async ({ page }) => {
  // v15 requires phase < delay; the migrated game then uses the strict gate.
  const f = disasterFixture(); f.state.scenario.farm.calendar.day = 6; f.state.dayTicks = 63; f.state.disasters.enabled = false;
  const old = JSON.parse(f.load().withAllCrops(browserCrops).save(4)); useOriginalCatalog(old); old.version = 15; delete old.runtime.market;
  const game = GameSimulation.load(JSON.stringify(old), browserCrops).simulation.withAllCrops(browserCrops);
  await page.goto('/'); await load(page, JSON.stringify(old));
  const migrated = await save(page, 'migrated'); expect(migrated.version).toBe(25);
  expect(migrated.runtime.dayTicks).toBe(old.runtime.dayTicks);
  expect(migrated.runtime.random).toEqual(old.runtime.random);
  expect(migrated.runtime.market.history[0]).toEqual([...Array(29).fill(null), old.runtime.cropMarketPrices[0]]);
  const bad = structuredClone(migrated); bad.runtime.market.history[0][29] = null;
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#save-status')).toContainText('Could not load farm');
  expect(await save(page, 'rejected')).toEqual(migrated);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const next = await save(page, 'migrated-week'); expect(next).toEqual(JSON.parse(game.save(4)));
  expect(next.runtime.market.history[0].filter((p: number | null) => p === null)).toHaveLength(28);
  await load(page, JSON.stringify(next)); expect(await save(page, 'migrated-restored')).toEqual(next);
});
