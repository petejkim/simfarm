import {toggleOption} from '../support/options-menu';
import { farmSnapshot } from '../support/field-checkpoint';
import { selectAssetSale } from '../support/sell-window';
import { clickFarmTile } from '../support/field-actions';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
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
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
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
  const game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  const before=await farmSnapshot(page);expect(before.scenario.equipment.filter(e=>e.active)).toHaveLength(2);
  expect(before.scenario.equipment[1].condition).toBe(253);expect(before.scenario.equipment[2].flags&64).toBe(64);
  await expect(page.getByRole('dialog',{name:'Machinery',exact:true})).toHaveCount(0);
  await toggleOption(page,'Sound Effects'); await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await expect(page.locator('#farm-cash')).toHaveText(`$${game.getSnapshot().scenario.farm.cash.toLocaleString('en-US')}`);
  const status=page.getByRole('button',{name:'Edit message history'});
  await expect(status).toHaveText('A piece of machinery was lost.');
  await expect.poll(() => page.evaluate(() => {
    const analyser = (window as unknown as { __explosion?: AnalyserNode }).__explosion, data = new Float32Array(2048);
    analyser?.getFloatTimeDomainData(data); return Math.max(...data.map(Math.abs));
  })).toBeGreaterThan(0.01);
  await status.click();await expect(page.getByRole('list',{name:'Recent Edit messages'}).locator('li')).toHaveText(['A piece of machinery was lost.']);
  await page.keyboard.press('Escape');
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const expected = decodePlanar(asset('ega16til.til').subarray(664 * 128, 665 * 128), 16, 16, readPalette(asset('simfarm.pal'))).rgba;
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(160, 160, 16, 16).data))).toEqual(Array.from(expected));
  const path = 'artifacts/browser-weekly-aging.simfarm.json'; expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, game.save(4));
  await expect(status).toBeVisible();await expect(status).toHaveText('');
  for (let d = 0; d < 7; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({width:1280,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-weekly-aging.png', fullPage: true }); expect(errors).toEqual([]);
});

test('busy worn machinery reports a deferred sale and remains owned through a browser checkpoint', async ({ page }) => {
  const f = weeklyAgingFixture(); f.equipment.flags |= 1; const game = f.load().withAllCrops(browserCrops);
  await page.goto('/'); await load(page, game.save(4)); await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await selectAssetSale(page,'Machinery',1);await expect(page.locator('.sell-feedback')).toContainText('This machine is in use.');await expect(page.locator('#catalog-sell')).toBeDisabled();
  const snapshot=await farmSnapshot(page);expect(snapshot.scenario.equipment[1].active).toBe(true);expect(snapshot.scenario.equipment[1].condition).toBe(255);
  await reveal(page,'#viewport');await page.getByRole('button',{name:'View object',exact:true}).click();await clickFarmTile(page,10,10);
  await expect(page.locator('.examine-condition')).toHaveAttribute('aria-label','Condition BAD');
  await expect(page.getByRole('button',{name:'Edit message history'})).not.toHaveText('A piece of machinery was lost.');
  expect(await save(page, 'artifacts/browser-weekly-aging-deferred.simfarm.json')).toEqual(JSON.parse(game.save(4)));
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
