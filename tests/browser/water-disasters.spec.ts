import {toggleOption} from '../support/options-menu';
import { chooseDisaster, setDisastersEnabled, expectDisasterChecked } from '../support/disaster-menu';
import { farmSnapshot, fieldDescription } from '../support/field-checkpoint';
import { reveal, acknowledgeFinanceMessages } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { waterDisasterFixture } from '../support/water-disasters';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'water.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  await acknowledgeFinanceMessages(page);
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = `artifacts/browser-water-${name}.json`; await (await pending).saveAs(path);
  return JSON.parse(readFileSync(path, 'utf8'));
}
async function originalTile(page: Page, x: number, y: number, tile: number) {
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => archive.find(e => e.name === n)!.bytes;
  const expected = decodePlanar(asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128), 16, 16, readPalette(asset('simfarm.pal'))).rgba;
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y });
  expect(actual).toEqual(Array.from(expected));
}
async function audio(page: Page) {
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    Object.assign(window, { waterAudio: [] as { length: number; peak: number }[] });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const make = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = make(), start = source.start.bind(source);
          source.start = (...args) => {
            const entry = { length: source.buffer?.length ?? 0, peak: 0 }, analyser = this.createAnalyser(); source.connect(analyser);
            (window as unknown as { waterAudio: typeof entry[] }).waterAudio.push(entry);
            const timer = setInterval(() => {
              const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
              entry.peak = Math.max(entry.peak, ...Array.from(data, Math.abs));
            }, 10);
            source.addEventListener('ended', () => clearInterval(timer)); start(...args);
          };
          return source;
        };
      }
    };
  });
}
const played = (page: Page) => page.evaluate(() => (window as unknown as { waterAudio: { length: number; peak: number }[] }).waterAudio);

test('Flood controls destroy a shoreline field and occupied building, render source water, play PCM and resume saved scanning through drainage', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await audio(page); await page.goto('/');
  const f = waterDisasterFixture(), game = f.load().withAllCrops(browserCrops); await load(page, game.save(4));
   await toggleOption(page,'Sound Effects');
  await chooseDisaster(page,'flood'); game.dispatch({ type:'disaster-menu',action:'flood' });
  const active=await farmSnapshot(page);expect(active.paused).toBe(true);expect(active.waterDisasters.scanning).toBe(true);
  await expectDisasterChecked(page,'flood');
  await expect.poll(async () => (await played(page)).some(s => s.length === 9729 && s.peak > 0.01)).toBe(true);
  await setDisastersEnabled(page,false); game.dispatch({ type: 'set-disasters-enabled', enabled: false });
  await expectDisasterChecked(page,'disable');
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(await fieldDescription(page)).toContain('0 fields');
  const destroyed=(await farmSnapshot(page)).scenario;expect(destroyed.fields[1].active).toBe(false);expect(destroyed.buildings.some(b=>b.active&&b.x===40&&b.y===40)).toBe(false);expect(destroyed.equipment.filter(e=>e.active)).toHaveLength(0);
  await expect.poll(async () => (await played(page)).some(s => s.length === 12736 && s.peak > 0.01)).toBe(true);
  const checkpoint = await save(page, 'scanning'); expect(checkpoint).toEqual(JSON.parse(game.save(4)));
  expect(checkpoint.version).toBe(26); expect(checkpoint.runtime.waterDisasters.scanning).toBe(true);
  await originalTile(page, 19, 18, game.getSnapshot().scenario.cells[19 * 96 + 18].terrain & 2047);
  await load(page, JSON.stringify(checkpoint));
  await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page,'#viewport');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await reveal(page, '#viewport'); await page.locator('#viewport').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/browser-flood.png', fullPage: true });
  for (let day = 1; day < 3; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect((await farmSnapshot(page)).waterDisasters.scanning).toBe(false);await expectDisasterChecked(page,'flood');
  expect(await save(page, 'scanned')).toEqual(JSON.parse(game.save(4)));
  for (let day = 3; day < 28; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  await expectDisasterChecked(page,'flood',false);
  expect(await save(page, 'drained')).toEqual(JSON.parse(game.save(4)));
  expect((await played(page)).filter(s => s.length === 9729)).toHaveLength(1); expect(errors).toEqual([]);
});

test('Drought controls dry and restore source shoreline pixels without start audio; invalid v14 flood state leaves the farm intact', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await audio(page); await page.goto('/');
  const f = waterDisasterFixture(), game = f.load().withAllCrops(browserCrops); await load(page, game.save(4));
   await toggleOption(page,'Sound Effects');
  await chooseDisaster(page,'drought'); game.dispatch({ type:'disaster-menu',action:'drought' });
  await expectDisasterChecked(page,'drought');
  await originalTile(page, 20, 19, 28);
  const checkpoint = await save(page, 'drought'); expect(checkpoint).toEqual(JSON.parse(game.save(4))); const sounds=(await played(page)).map(s=>s.length);expect(sounds.length).toBeGreaterThan(0);expect(sounds.every(length=>length===2667)).toBe(true); // Only UI click PCM; drought itself is silent.
  const bad = structuredClone(checkpoint); bad.runtime.waterDisasters.scanY = 94;
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await expect(page.locator('#save-status')).toContainText('flood scan Y'); expect(await save(page, 'after-invalid')).toEqual(checkpoint);
  await load(page, JSON.stringify(checkpoint));
  for (let day = 0; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  await expectDisasterChecked(page,'drought',false);
  await originalTile(page, 20, 19, game.getSnapshot().scenario.cells[20 * 96 + 19].terrain & 2047);
  expect(await save(page, 'recovered')).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
