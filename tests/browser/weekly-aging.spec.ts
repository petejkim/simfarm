import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { weeklyAgingFixture } from '../support/weekly-aging';
import { readArchive } from '../../src/formats/archive';
import { readPalette, decodePlanar } from '../../src/formats/graphics';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'weekly-aging.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('weekly worn machinery sale displays proceeds, original clearing pixels and audible PCM while chemical bytes and saves continue exactly', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(), start = source.start.bind(source);
          source.start = (...args) => {
            if (source.buffer?.length === 12736) { const analyser = this.createAnalyser(); source.connect(analyser); Object.assign(window, { __explosion: analyser }); }
            start(...args);
          };
          return source;
        };
      }
    };
  });
  const f = weeklyAgingFixture(), rented = f.state.scenario.equipment[2];
  rented.bytes.fill(0); rented.flags = 96; rented.bytes[5] = rented.bytes[6] = 15;
  const game = f.load(); await page.goto('/'); await load(page, game.save(4));
  await page.locator('#machinery-panel > summary').click();
  await expect(page.locator('#machinery-summary')).toContainText('Owned: 1 · Rented: 1');
  await expect(page.getByRole('table', { name: 'Machinery wear' }).getByRole('row', { name: 'Machine 1 99% Owned', exact: true })).toBeVisible();
  await page.locator('#sound-toggle').click(); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await expect(page.locator('#machinery-notices')).toContainText(`Worn-out machine 1 was sold for $${game.getSnapshot().scenario.equipmentDefinitions[0].price >>> 3}.`);
  await expect(page.locator('#machinery-summary')).toContainText('Owned: 0 · Rented: 1');
  await expect.poll(() => page.evaluate(() => {
    const analyser = (window as unknown as { __explosion?: AnalyserNode }).__explosion, data = new Float32Array(2048);
    analyser?.getFloatTimeDomainData(data); return Math.max(...data.map(Math.abs));
  })).toBeGreaterThan(0.01);
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const expected = decodePlanar(asset('ega16til.til').subarray(664 * 128, 665 * 128), 16, 16, readPalette(asset('simfarm.pal'))).rgba;
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(160, 160, 16, 16).data))).toEqual(Array.from(expected));
  const path = 'artifacts/browser-weekly-aging.simfarm.json'; expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, game.save(4)); await expect(page.locator('#machinery-notices')).toHaveCount(0);
  for (let d = 0; d < 7; d++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.locator('#machinery-panel > summary').click(); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#machinery-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-weekly-aging.png', fullPage: true }); expect(errors).toEqual([]);
});

test('busy worn machinery reports a deferred sale and remains owned through a browser checkpoint', async ({ page }) => {
  const f = weeklyAgingFixture(); f.equipment.flags |= 1; const game = f.load();
  await page.goto('/'); await load(page, game.save(4)); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await page.locator('#machinery-panel > summary').click();
  await expect(page.locator('#machinery-notices')).toContainText('Machine 1 is worn out and could not be sold while in use.');
  await expect(page.getByRole('table', { name: 'Machinery wear' })).toContainText('100%');
  await expect(page.locator('#machinery-summary')).toContainText('Owned: 1 · Rented: 0');
  expect(await save(page, 'artifacts/browser-weekly-aging-deferred.simfarm.json')).toEqual(JSON.parse(game.save(4)));
});
