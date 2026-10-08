import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
function checkpoint(cash = 800000, rank = 0, weekly = false) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.schedule.bytes.fill(0); Object.assign(scenario.farm.calendar, { day: 6, week: weekly ? 0 : 3, month: weekly ? 0 : 11 });
  Object.assign(scenario.farm, { cash, salesAccumulator: 1000 });
  if (weekly) for (const field of scenario.fields) { field.bytes[2] = 0; field.bytes[54] = 0; field.bytes[55] = 0; }
  const save = JSON.parse(new GameSimulation(scenario, crops).save(4));
  save.runtime.finances.homestead.rank = rank; save.runtime.finances.town.townRevenue = 50000;
  return { name: 'home.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) };
}

test('annual homestead updates repaint original tiles, persist once, and play original PCM effects with MIDI when enabled', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const music: string[] = [], sounds: string[] = [];
  page.on('request', r => { if (r.url().endsWith('.music.json')) music.push(r.url()); if (r.url().endsWith('.voc')) sounds.push(r.url()); });
  await page.addInitScript(() => {
    const Base = window.AudioContext, pcm: { length: number; analyser: AnalyserNode }[] = [];
    Object.assign(window, { __homePcm: pcm });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(), start = source.start.bind(source);
          source.start = (...args) => {
            if (source.buffer && [11663, 12343].includes(source.buffer.length)) {
              const analyser = this.createAnalyser(); source.connect(analyser); pcm.push({ length: source.buffer.length, analyser });
            }
            start(...args);
          };
          return source;
        };
      }
    };
  });
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles(checkpoint());
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#next-day').click(); await expect(page.locator('#town-choice')).toBeVisible();
  await expect(page.locator('#homestead-notice')).toHaveCount(0);
  await page.locator('#town-airport').click(); await expect(page.locator('#homestead-notice')).toContainText('improved');
  expect(music).toEqual([]); expect(sounds).toEqual([]); // No automatic opt-in, even on a genuine game event.
  await page.locator('#load-farm-file').setInputFiles(checkpoint());
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#play').click(); await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await page.locator('#sound-toggle').click(); await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#next-day').click(); await page.locator('#town-airport').click();
  await expect(page.locator('#audio-status')).toContainText('Playing cowman'); await expect(page.locator('#music')).toHaveValue('cowman');
  await expect.poll(() => page.evaluate(() => {
    const pcm = (window as unknown as { __homePcm: { length: number; analyser: AnalyserNode }[] }).__homePcm;
    const voice = pcm.find(p => p.length === 12343), samples = new Float32Array(2048);
    voice?.analyser.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs));
  })).toBeGreaterThan(0.01);
  expect(sounds.filter(s => s.endsWith('/cheers.voc'))).toHaveLength(1);
  await page.locator('#view-home').click(); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#view-home').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-homestead.png', fullPage: true });
  const download = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const path = 'artifacts/browser-homestead.simfarm.json'; await (await download).saveAs(path);
  const saved = JSON.parse(readFileSync(path, 'utf8')); expect(saved.version).toBe(17);
  expect(saved.runtime.finances.homestead).toEqual({ x: 56, y: 48, rank: 5 });
  const world = Buffer.from(saved.scenario.world, 'hex');
  expect(world.readUInt16LE(((59 * 96) + 51) * 5)).toBe(524);
  const bad = structuredClone(saved); bad.runtime.finances.homestead.rank = 6;
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad-home.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#save-status')).toContainText('financial state'); await expect(page.locator('#homestead-notice')).toContainText('improved');
  const count = sounds.length; await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await expect(page.locator('#homestead-notice')).toHaveCount(0);
  await page.locator('#next-day').click(); expect(sounds).toHaveLength(count);
  await page.locator('#load-farm-file').setInputFiles(checkpoint(40000, 5));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#next-day').click(); await page.locator('#town-airport').click();
  await expect(page.locator('#homestead-notice')).toContainText('downgraded');
  await expect.poll(() => page.evaluate(() => {
    const pcm = (window as unknown as { __homePcm: { length: number; analyser: AnalyserNode }[] }).__homePcm;
    const voice = pcm.find(p => p.length === 11663), samples = new Float32Array(2048);
    voice?.analyser.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs));
  })).toBeGreaterThan(0.01);
  await page.locator('#sound-toggle').click(); await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('muting cancels a pending homestead sample and missing sound assets leave the completed game action intact', async ({ page }) => {
  await page.addInitScript(() => {
    const Base = window.AudioContext; Object.assign(window, { __pcmStarts: 0 });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(), start = source.start.bind(source);
          source.start = (...args) => { (window as unknown as { __pcmStarts: number }).__pcmStarts++; start(...args); };
          return source;
        };
      }
    };
  });
  let release!: () => void, requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/raw/cheers.voc', async route => { requested = true; await gate; await route.continue().catch(() => {}); });
  try {
    await page.goto('/'); await page.locator('#load-farm-file').setInputFiles(checkpoint());
    await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#sound-toggle').click();
    await page.locator('#next-day').click(); await page.locator('#town-airport').click();
    await expect.poll(() => requested).toBe(true); await page.locator('#sound-toggle').click(); release();
    await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#homestead-notice')).toContainText('improved');
    await page.unroute('**/raw/cheers.voc');
    await page.route('**/raw/cheers.voc', route => route.fulfill({ status: 404, body: 'Missing sound' }));
    await page.locator('#load-farm-file').setInputFiles(checkpoint());
    await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#sound-toggle').click();
    await page.locator('#next-day').click(); await page.locator('#town-airport').click();
    await expect(page.locator('#homestead-notice')).toContainText('improved'); await expect(page.locator('#sound-error')).toContainText('cheers.voc');
    await expect(page.locator('#time-status')).toContainText('1 days advanced'); await expect(page.locator('#next-day')).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as { __pcmStarts: number }).__pcmStarts)).toBe(0);
  } finally { release(); }
});

test('weekly MIDI requests deduplicate the active track, respect Stop and cancel pending loads', async ({ page }) => {
  let happyRequests = 0;
  page.on('request', r => { if (r.url().endsWith('/ffarm.music.json')) happyRequests++; });
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles(checkpoint(600000, 0, true));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#play').click(); await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await page.locator('#next-day').click(); await expect(page.locator('#audio-status')).toContainText('Playing ffarm');
  expect(happyRequests).toBe(1);
  for (let day = 0; day < 7; day++) await page.locator('#next-day').click();
  await expect(page.locator('#audio-status')).toContainText('Playing ffarm'); expect(happyRequests).toBe(1);
  await page.locator('#play').click(); await expect(page.locator('#audio-status')).toHaveText('Music off');
  await page.locator('#music').selectOption('amain');
  await page.locator('#load-farm-file').setInputFiles(checkpoint(600000, 0, true));
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#next-day').click();
  await expect(page.locator('#music')).toHaveValue('amain'); expect(happyRequests).toBe(1);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/ffarm.music.json', async route => { await gate; await route.continue().catch(() => {}); });
  await page.locator('#play').click(); await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await page.locator('#music').selectOption('ffarm'); await expect(page.locator('#audio-status')).toContainText('Loading ffarm');
  await page.locator('#play').click(); await expect(page.locator('#audio-status')).toHaveText('Music off'); release();
  await page.locator('#music').selectOption('amain'); await page.locator('#play').click();
  await expect(page.locator('#audio-status')).toContainText('Playing amain');
});
