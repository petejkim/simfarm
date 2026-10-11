import { browseSupply, selectSupply } from '../support/supply-actions';
import { clickFarmTile } from '../support/field-actions';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops, useOriginalCatalog } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { disasterFixture } from '../support/disasters';
import { GameSimulation } from '../support/game';
import { schedulePlant } from '../support/schedule-window';
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'market.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = `artifacts/browser-market-${name}.json`; await (await pending).saveAs(path);
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('scheduled planting keeps trade quotes until weekly execution updates seed purchases, with exact restored continuation', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = disasterFixture(); f.state.scenario.farm.calendar.day = 6; f.state.dayTicks = 64;
  f.state.disasters.enabled = false; f.state.random.simulation = 9029;
  const game = f.load().withAllCrops(browserCrops); game.dispatch({ type: 'build', buildingType: 66, x: 10, y: 10 });
  const before = game.getSnapshot();
  await page.goto('/'); await load(page, game.save(4));
  await schedulePlant(page,20,20,1,0);
  game.dispatch({ type: 'edit-field-plan', fieldSlot: 1, week:1, action:{kind:'plant',cropSlot:0} });
  const planted = await save(page, 'planted');
  expect(planted.runtime.market).toEqual(before.market);
  expect(planted.runtime.cropMarketPrices).toEqual(before.cropMarketPrices);
  expect(planted).toEqual(JSON.parse(game.save(4)));
  await browseSupply(page,192);await expect(page.locator('#buy-price')).toHaveText('$32');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const price = game.getSnapshot().scenario.seedDefinitions[0].price; expect(price).not.toBe(32);
  await browseSupply(page,192);await expect(page.locator('#buy-price')).toHaveText(`$${price}`);
  const week = await save(page, 'weekly'); expect(week).toEqual(JSON.parse(game.save(4)));
  // Weekly quotes are sampled before queued planting adjusts the current history sample.
  expect(week.runtime.market.history[0][29]).toBe(113);
  expect(week.runtime.cropMarketPrices[0]).toBe(150);
  expect(week.runtime.market.history.slice(1).map((h: number[]) => h[29])).toEqual(week.runtime.cropMarketPrices.slice(1));
  await load(page, JSON.stringify(week));
  await selectSupply(page,192);await clickFarmTile(page,10,10);
  game.dispatch({ type: 'buy-crop-supply', productType: 192, x: 10, y: 10 });
  await expect(page.locator('#buy-result')).toContainText('purchased.');
  expect(await save(page, 'purchase')).toEqual(JSON.parse(game.save(4)));
  expect(errors).toEqual([]);
});

test('legacy market migration keeps unknown samples through browser save/load and malformed market rejection is atomic', async ({ page }) => {
  // v15 requires phase < delay; the migrated game then uses the strict gate.
  const f = disasterFixture(); f.state.scenario.farm.calendar.day = 6; f.state.dayTicks = 63; f.state.disasters.enabled = false;
  const old = JSON.parse(f.load().withAllCrops(browserCrops).save(4)); useOriginalCatalog(old); old.version = 15; delete old.runtime.market;
  const game = GameSimulation.load(JSON.stringify(old), browserCrops).simulation.withAllCrops(browserCrops);
  await page.goto('/'); await load(page, JSON.stringify(old));
  const migrated = await save(page, 'migrated'); expect(migrated.version).toBe(26);
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
