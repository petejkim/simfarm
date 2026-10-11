import {toggleOption} from '../support/options-menu';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops, useOriginalCatalog } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { trafficFixture } from '../support/traffic';
import { GameSimulation } from '../support/game';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'traffic.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = `artifacts/browser-traffic-${name}.json`; await (await pending).saveAs(path);
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('traffic paints original vehicle pixels and continues through weekly spawning and browser save/load', async ({ page }) => {
  const f = trafficFixture(), game = f.load().withAllCrops(browserCrops), errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await load(page, game.save(4));
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const state = game.getSnapshot(), record = state.traffic.records[0]; expect(record[2]).toBe(21);
  const source = (n: string) => readFileSync(new URL('../../../simfarm-dos/' + n, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => archive.find(e => e.name === n)!.bytes;
  const palette = readPalette(asset('simfarm.pal')), image = 68 + record[7] * 4 + (record[6] >> 1);
  const ground = decodePlanar(asset('ega16til.til').subarray(150 * 128, 151 * 128), 16, 16, palette).rgba;
  const vehicle = decodePlanar(asset('mskdtile.til').subarray(image * 128, (image + 1) * 128), 16, 16, palette, 7).rgba;
  for (let p = 0; p < ground.length; p += 4) if (vehicle[p + 3]) ground.set(vehicle.subarray(p, p + 4), p);
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(21 * 16, 20 * 16, 16, 16).data))).toEqual(Array.from(ground));
  const checkpoint = await save(page, 'painted'); expect(checkpoint.version).toBe(25); expect(checkpoint).toEqual(JSON.parse(game.save(4)));
  await page.locator('#viewport').evaluate(e => e.scrollTo(160, 160));
  await page.screenshot({ path: 'artifacts/browser-traffic.png', fullPage: true });
  await load(page, JSON.stringify(checkpoint)); expect(await save(page, 'restored')).toEqual(checkpoint);
  for (let day = 0; day < 8; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, 'continued')).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 1280, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280); expect(errors).toEqual([]);
});

test('traffic collision plays source PCM only when enabled, never replays on load and rejects malformed continuation atomically', async ({ page }) => {
  const requests: string[] = []; page.on('request', r => { if (r.url().endsWith('/smack.voc')) requests.push(r.url()); });
  await page.addInitScript(() => {
    const Base = window.AudioContext, played: { length: number; peak: number }[] = [];
    Object.assign(window, { __trafficPlayed: played });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => { const s = create(), start = s.start.bind(s);
          s.start = (...args) => { const samples = s.buffer!.getChannelData(0);
            played.push({ length: samples.length, peak: Math.max(...samples.map(Math.abs)) }); start(...args); }; return s; };
      }
    };
  });
  const f = trafficFixture(true), game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(requests).toEqual([]); expect(await save(page, 'muted-hit')).toEqual(JSON.parse(game.save(4)));
  await load(page, f.load().withAllCrops(browserCrops).save(4)); await toggleOption(page,'Sound Effects'); await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __trafficPlayed: { length: number; peak: number }[] }).__trafficPlayed.some(p => p.length === 1467 && p.peak > 0.1))).toBe(true);
  const checkpoint = await save(page, 'audible-hit'); expect(checkpoint).toEqual(JSON.parse(game.save(4)));
  const count = requests.length; await load(page, JSON.stringify(checkpoint)); expect(await save(page, 'hit-restored')).toEqual(checkpoint); expect(requests).toHaveLength(count);
  const bad = structuredClone(checkpoint); bad.runtime.traffic.activeCount = 16;
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#save-status')).toContainText('Could not load farm'); expect(await save(page, 'rejected')).toEqual(checkpoint);
  const old = structuredClone(checkpoint); useOriginalCatalog(old); old.version = 16; delete old.runtime.traffic;
  const migrated = GameSimulation.load(JSON.stringify(old), browserCrops).simulation.withAllCrops(browserCrops); await load(page, JSON.stringify(old));
  expect(await save(page, 'legacy')).toEqual(JSON.parse(migrated.save(4))); expect(migrated.getSnapshot().traffic.activeCount).toBe(0);
  expect(requests).toHaveLength(count);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
