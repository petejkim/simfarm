import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { aircraftFixture } from '../support/aircraft';
import { purchaseAircraft } from '../../src/simulation/aircraft';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'aircraft.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('Aircraft panel buys at the original airport pad, refuels, changes and loads payload, and continues current saves', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = aircraftFixture(), game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await page.locator('#aircraft-panel > summary').click();
  await expect(page.locator('#aircraft-purchase-status')).toHaveText('Aircraft: $6,000 · Parking at 21, 22.');
  await page.locator('#buy-aircraft').click(); game.dispatch({ type: 'buy-aircraft' });
  await expect(page.locator('#aircraft-purchase-result')).toContainText('Aircraft 1 purchased for $6,000 at 21, 22');
  await expect(page.locator('#buy-aircraft')).toBeDisabled(); await expect(page.locator('#aircraft-purchase-status')).toContainText('No airport parking');
  await expect(page.locator('#aircraft-status')).toHaveText('Fuel: 0 / 255 · Payload: 0 / 255 · Wear: 0%');
  await page.locator('#aircraft-fuel').click(); game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'fuel' } });
  await expect(page.locator('#aircraft-fuel')).toBeDisabled();
  await page.locator('#aircraft-load').click(); game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'load' } });
  await expect(page.locator('#aircraft-status')).toContainText('Payload: 255 / 255 (Pesticide)');
  await page.locator('#aircraft-chemical').selectOption('223'); game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'chemical', chemicalType: 223 } });
  await expect(page.locator('#aircraft-service-result')).toContainText('Payload sold for $5,100');
  await expect(page.locator('#aircraft-status')).toContainText('Payload: 0 / 255');
  const path = 'artifacts/browser-aircraft.simfarm.json'; expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, game.save(4)); await page.locator('#aircraft-panel > summary').click();
  await expect(page.locator('#aircraft-chemical')).toHaveValue('223'); await expect(page.locator('#aircraft-service-result')).toHaveCount(0);
  await page.locator('#aircraft-load').click(); game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'load' } });
  await expect(page.locator('#aircraft-status')).toContainText('Payload: 255 / 255 (Fungicide)');
  await page.locator('#locate-aircraft').click();
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => entries.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal'));
  for (const [x, y, tile] of [[21, 22, 71], [22, 22, 72], [21, 23, 111], [22, 23, 112]]) {
    const expected = decodePlanar(asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128), 16, 16, palette).rgba;
    const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y });
    expect(actual).toEqual(Array.from(expected));
  }
  for (let d = 0; d < 7; d++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, path)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('Aircraft repairs preserve saved age, cash failures explain disabled services, invalid selections preserve the farm and narrow controls fit', async ({ page }) => {
  const f = aircraftFixture(), purchased = purchaseAircraft(f.state.scenario, f.state.finances); expect(purchased.ok).toBe(true);
  const e = f.state.scenario.equipment[1]; e.bytes[17] = 10; e.bytes[18] = 4; f.state.scenario.farm.cash = 100;
  const game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4)); await page.locator('#aircraft-panel > summary').click();
  await expect(page.locator('#aircraft-fuel')).toBeDisabled(); await expect(page.locator('#aircraft-load')).toBeDisabled();
  await expect(page.locator('#aircraft-panel')).toContainText('There is not enough cash.'); await expect(page.locator('#aircraft-repair')).toHaveText('Repair · $100');
  await page.locator('#aircraft-repair').click(); game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind: 'repair' } });
  await expect(page.locator('#aircraft-status')).toContainText('Wear: 0%'); await expect(page.locator('#farm-cash')).toHaveText('$0');
  await expect(page.locator('#aircraft-service-result')).toHaveText('Service completed for $100.');
  const path = 'artifacts/browser-aircraft-service.simfarm.json'; expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  const malformed = JSON.parse(game.save(4)); malformed.runtime.aircraftService.selectedChemical = 220;
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad-aircraft.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed)) });
  await expect(page.locator('#save-status')).toContainText('aircraft chemical'); expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#aircraft-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-aircraft.png', fullPage: true });
  f.state.finances.town.airportCount = 0; await load(page, f.load().withAllCrops(browserCrops).save(4));
  await page.locator('#aircraft-panel > summary').click(); await expect(page.locator('#buy-aircraft')).toBeDisabled();
  await expect(page.locator('#aircraft-purchase-status')).toContainText('An airport is needed');
});
