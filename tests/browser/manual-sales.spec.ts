import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { breedingFixture } from '../support/animal-lifecycle';
import { aircraftFixture } from '../support/aircraft';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { checkManualAssetSale } from '../../src/simulation/manual-asset-sale';
import { readArchive } from '../../src/formats/archive';
import { readPalette, decodePlanar } from '../../src/formats/graphics';
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'sale.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, file: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await pending).saveAs(file); return JSON.parse(readFileSync(file, 'utf8'));
}

test('Livestock controls sell a live newborn and stored parent, show original quotes/income and continue exact saved state', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = breedingFixture(); f.state.random.visual = 10; // Newborn moves NW onto free ground after the traffic draw.
  f.state.scenario.animals[1].flags |= 3; f.state.scenario.animals[1].bytes[28] = 40;
  const game = f.load(); await page.goto('/'); await load(page, game.save(4));
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await page.locator('#livestock-panel > summary').click(); await expect(page.locator('#livestock-panel > summary')).toContainText('2 animals');
  for (const slot of [2, 1]) {
    await page.locator('#sale-animal-selection').selectOption(String(slot));
    const s = game.getSnapshot(), quote = checkManualAssetSale(s.scenario, s.finances, 'animal', slot, s.weather.soilMoisture); expect(quote.ok).toBe(true);
    if (!quote.ok) throw new Error('Missing source animal quote');
    await expect(page.locator('#sale-animal-quote')).toHaveText(`Sale amount: ${money(quote.value)}`);
    await page.locator('#locate-sale-animal').click();
    await page.locator('#sell-animal').click(); game.dispatch({ type: 'sell-asset', kind: 'animal', slot });
    await expect(page.locator('#sale-animal-result')).toHaveText(`Animal ${slot} sold for ${money(quote.value)}.`);
    await expect(page.locator('#farm-cash')).toHaveText(money(game.getSnapshot().scenario.farm.cash));
    expect(await save(page, 'artifacts/browser-animal-sale.simfarm.json')).toEqual(JSON.parse(game.save(4)));
    if (slot === 2) {
      await page.reload(); await load(page, game.save(4)); await page.locator('#livestock-panel > summary').click();
      await expect(page.locator('#sale-animal-result')).toHaveCount(0);
    }
  }
  await expect(page.locator('#livestock-panel > summary')).toContainText('0 animals');
  await expect(page.locator('#livestock-panel')).toContainText('No animals available to sell.');
  for (let d = 0; d < 7; d++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, 'artifacts/browser-animal-sale.simfarm.json')).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('Machinery sale controls hide rentals, explain busy machines and sell ground/storage/aircraft with exact map and ledger cleanup', async ({ page }) => {
  const f = aircraftFixture(), game = f.load();
  game.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 10, y: 10 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 4, x: 40, y: 40 });
  game.dispatch({ type: 'buy-aircraft' });
  const state = readNativeSave(game.save(4)).state;
  state.scenario.equipment[1].flags |= 64; state.scenario.equipment[2].flags |= 1;
  await page.goto('/'); const busy = writeNativeSave(state, 4); await load(page, busy); await page.locator('#machinery-panel > summary').click();
  await expect(page.locator('#sale-equipment-selection option[value="1"]')).toHaveCount(0);
  await expect(page.locator('#sale-equipment-quote')).toContainText('This machine is in use.'); await expect(page.locator('#sell-equipment')).toBeDisabled();
  expect(await save(page, 'artifacts/browser-equipment-sale.simfarm.json')).toEqual(JSON.parse(busy));
  await load(page, game.save(4)); await page.locator('#machinery-panel > summary').click();
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#machinery-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-manual-sales.png', fullPage: true });
  for (const slot of [1, 2, 3]) {
    await page.locator('#sale-equipment-selection').selectOption(String(slot));
    const s = game.getSnapshot(), quote = checkManualAssetSale(s.scenario, s.finances, 'equipment', slot, s.weather.soilMoisture); expect(quote.ok).toBe(true);
    if (!quote.ok) throw new Error('Missing source machinery quote');
    await expect(page.locator('#sale-equipment-quote')).toHaveText(`Sale amount: ${money(quote.value)}`);
    await page.locator('#locate-sale-equipment').click(); await page.locator('#sell-equipment').click();
    game.dispatch({ type: 'sell-asset', kind: 'equipment', slot });
    await expect(page.locator('#sale-equipment-result')).toHaveText(`Machine ${slot} sold for ${money(quote.value)}.`);
    expect(await save(page, 'artifacts/browser-equipment-sale.simfarm.json')).toEqual(JSON.parse(game.save(4)));
  }
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => entries.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal'));
  for (const [x, y, tile] of [[10, 10, 15], [21, 22, 23], [22, 23, 23]]) {
    const expected = decodePlanar(asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128), 16, 16, palette).rgba;
    const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y });
    expect(actual).toEqual(Array.from(expected));
  }
  await expect(page.locator('#machinery-panel')).toContainText('No owned machines available to sell.');
  await page.locator('#aircraft-panel > summary').click(); await expect(page.locator('#buy-aircraft')).toBeEnabled();
});
