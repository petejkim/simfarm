import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import { farmSnapshot } from '../support/field-checkpoint';
import { chooseDisaster, setDisastersEnabled, expectDisasterChecked } from '../support/disaster-menu';
import { reveal, acknowledgeFinanceMessages } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { disasterFixture } from '../support/disasters';
import { shopFixture } from '../support/livestock';
import { createMovingDisasters, beginMovingDisaster, type MovingDisasterState } from '../../src/simulation/moving-disasters';
import { FarmRandom } from '../../src/simulation/random';
import { purchaseBuilding } from '../../src/simulation/building-placement';
import { purchaseEquipment } from '../../src/simulation/equipment-purchase';
import { readArchive } from '../../src/formats/archive';
import { readPalette } from '../../src/formats/graphics';
import { readSprite } from '../../src/formats/sprite';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'disaster.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  await acknowledgeFinanceMessages(page);
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = `artifacts/browser-disaster-${name}.json`; await (await pending).saveAs(path); return JSON.parse(readSaveText(path));
}
async function sprites(page: Page, d: MovingDisasterState, kind: 'tornado' | 'swarm') {
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => archive.find(e => e.name === n)!.bytes;
  const e = d[kind], raster = readSprite(asset(`${kind}.spr`), readPalette(asset('simfarm.pal'))).frames[e.frame];
  const points: number[] = [], expected: number[][] = [];
  for (let i = 0; i < raster.width * raster.height; i++) if (raster.rgba[i * 4 + 3]) {
    points.push((e.y * 16 + Math.floor(i / raster.width)) * 1536 + e.x * 16 + i % raster.width);
    expected.push(Array.from(raster.rgba.subarray(i * 4, i * 4 + 4)));
  }
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, points) => {
    const rgba = c.getContext('2d')!.getImageData(0, 0, 1536, 1536).data;
    return points.map(p => Array.from(rgba.subarray(p * 4, p * 4 + 4)));
  }, points);
  expect(actual).toEqual(expected);
}
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    Object.assign(window, { disasterAudio: [] as { length: number; peak: number }[] });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const make = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = make(), start = source.start.bind(source);
          source.start = (...args) => {
            if ([7259, 11549].includes(source.buffer?.length ?? 0)) {
              const entry = { length: source.buffer!.length, peak: 0 }, analyser = this.createAnalyser(); source.connect(analyser);
              (window as unknown as { disasterAudio: typeof entry[] }).disasterAudio.push(entry);
              const timer = setInterval(() => {
                const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
                entry.peak = Math.max(entry.peak, ...Array.from(data, Math.abs));
              }, 10);
              source.addEventListener('ended', () => clearInterval(timer));
            }
            start(...args);
          };
          return source;
        };
      }
    };
  });
}

test('Disasters controls start real locust damage, render every source sprite pixel, play original PCM and preserve an active checkpoint', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await observeAudio(page);
  await page.goto('/'); const f = disasterFixture(), game = f.load().withAllCrops(browserCrops); await load(page, game.save(4));
   await setDisastersEnabled(page,false);
  game.dispatch({ type: 'set-disasters-enabled', enabled: false }); await expectDisasterChecked(page,'disable');
  await setDisastersEnabled(page,true); game.dispatch({ type: 'set-disasters-enabled', enabled: true });
  await toggleOption(page,'Sound Effects'); await chooseDisaster(page,'swarm'); game.dispatch({ type:'disaster-menu',action:'swarm' });
  const active=await farmSnapshot(page);expect(active.paused).toBe(true);expect([active.disasters.swarm.x,active.disasters.swarm.y]).toEqual([20,20]);
  await expectDisasterChecked(page,'swarm'); await sprites(page, game.getSnapshot().disasters, 'swarm');
  await expect.poll(() => page.evaluate(() => (window as unknown as { disasterAudio: { length: number; peak: number }[] }).disasterAudio.some(a => a.length === 7259 && a.peak > 0.01))).toBe(true);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const checkpoint = await save(page, 'swarm'); expect(checkpoint).toEqual(JSON.parse(game.save(4)));
  expect(game.getSnapshot().scenario.fields[1].bytes[19]).toBeGreaterThan(0);
  await load(page, JSON.stringify(checkpoint)); await sprites(page, game.getSnapshot().disasters, 'swarm');

  await reveal(page,'#viewport');
  for (let i = 0; i < 8; i++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  await expectDisasterChecked(page,'swarm',false);await expectDisasterChecked(page,'tornado',false);
  expect(await save(page, 'swarm')).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('manual tornado destroys a building and contents without sale credit; disable preserves the active effect and narrow controls remain usable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await observeAudio(page); await page.goto('/');
  const f = shopFixture(), d = createMovingDisasters();
  beginMovingDisaster(f.state.scenario, d, 'tornado', 0, new FarmRandom(f.state.random));
  const x = d.tornado.x + d.tornado.dx + 1, y = d.tornado.y + d.tornado.dy + 2;
  expect(purchaseBuilding(f.state.scenario, f.state.finances, 67, x, y, 0).ok).toBe(true);
  expect(purchaseEquipment(f.state.scenario, f.state.finances, 0, x, y, 0).ok).toBe(true);
  const game = f.load().withAllCrops(browserCrops), cash = game.getSnapshot().scenario.farm.cash; await load(page, game.save(4));
   await toggleOption(page,'Sound Effects');
  await chooseDisaster(page,'tornado'); game.dispatch({ type:'disaster-menu',action:'tornado' });
  await sprites(page, game.getSnapshot().disasters, 'tornado'); await reveal(page,'#viewport');
  await expect.poll(() => page.evaluate(() => (window as unknown as { disasterAudio: { length: number; peak: number }[] }).disasterAudio.some(a => a.length === 11549 && a.peak > 0.01))).toBe(true);
  await setDisastersEnabled(page,false); game.dispatch({ type: 'set-disasters-enabled', enabled: false });
  for (let i = 0; i < 2; i++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(game.getSnapshot().scenario.buildings[1].active).toBe(false); expect(game.getSnapshot().scenario.equipment[1].active).toBe(false);
  expect(game.getSnapshot().scenario.farm.cash).toBe(cash); expect(game.getSnapshot().disasters.flags & 1).toBe(1);
  expect(await save(page, 'tornado')).toEqual(JSON.parse(game.save(4))); await sprites(page, game.getSnapshot().disasters, 'tornado');
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page,'#viewport');
  await expectDisasterChecked(page,'tornado');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-disasters.png', fullPage: true }); expect(errors).toEqual([]);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
