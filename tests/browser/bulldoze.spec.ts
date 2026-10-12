import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import {clickFarmTile} from '../support/field-actions';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bulldozeFixture, bulldozeTargets } from '../support/bulldoze';
import { checkManualRemoval } from '../../src/simulation/manual-removal';
import { readArchive } from '../../src/formats/archive';
import { readPalette, decodePlanar } from '../../src/formats/graphics';
import { worldIndex, type Scenario } from '../../src/formats/scenario';
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'bulldoze.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const file = 'artifacts/browser-bulldoze.simfarm.json'; await (await pending).saveAs(file); return JSON.parse(readSaveText(file));
}
async function select(page:Page,x:number,y:number){
  await reveal(page,'#viewport');await page.getByRole('button',{name:'Bulldoze',exact:true}).click();await clickFarmTile(page,x,y);
}

async function pixels(page: Page, world: Scenario) {
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal')), tiles = asset('ega16til.til');
  const points = [...bulldozeTargets, [21, 20], [25, 20], [29, 20], [33, 20], [32, 21], [39, 40], [41, 41]];
  for (const [x, y] of points) {
    const tile = world.cells[worldIndex(x, y)].terrain & 0x7ff, expected = decodePlanar(tiles.subarray(tile * 128, (tile + 1) * 128), 16, 16, palette).rgba;
    const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y });
    expect(actual, `Tile ${x}, ${y} graphic${tile}`).toEqual(Array.from(expected));
  }
}

test('Bulldoze removes loose supplies/chemicals and terrain, renders source connectivity/shore pixels and plays original bulldozer PCM', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(), start = source.start.bind(source);
          source.start = (...args) => {
            if (source.buffer?.length === 2755) {
              const analyser = this.createAnalyser(); source.connect(analyser); let ended = false;
              source.addEventListener('ended', () => { ended = true; });
              const poll = () => { const data = new Float32Array(2048); analyser.getFloatTimeDomainData(data);
                Object.assign(window, { __bulldozePeak: Math.max(...data.map(Math.abs)) }); if (!ended) requestAnimationFrame(poll); };
              requestAnimationFrame(poll);
            }
            start(...args);
          }; return source;
        };
      }
    };
  });
  const f = bulldozeFixture(), game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await toggleOption(page,'Sound Effects');
  for (const [i, [x, y]] of bulldozeTargets.entries()) {
    await select(page, x, y); const quote = checkManualRemoval(game.getSnapshot().scenario, x, y); expect(quote.ok).toBe(true);
    if (!quote.ok) throw new Error('Missing target');
    await expect(page.getByRole('dialog',{name:'Message',exact:true})).toHaveCount(0);
    if (i === 3) {
      await page.setViewportSize({ width: 1280, height: 844 }); await expect(page.locator('#viewport')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
      await page.screenshot({ path: 'artifacts/browser-bulldoze.png', fullPage: true });
    }
    game.dispatch({ type: 'remove-object', x, y, kind: quote.kind, slot: quote.slot, tile: quote.tile });
    await expect(page.locator('#bulldoze-result')).toContainText('removed for $25.');
    if (i === 3) await expect.poll(() => page.evaluate(() => (window as unknown as { __bulldozePeak?: number }).__bulldozePeak ?? 0)).toBeGreaterThan(0.01);
    await page.getByRole('button',{name:'View object',exact:true}).click();
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await pixels(page, game.getSnapshot().scenario);
  await page.reload(); await load(page, game.save(4)); await expect(page.locator('#removal-panel')).toHaveCount(0);
  await expect(page.locator('#bulldoze-result')).toHaveCount(0);
  for (let d = 0; d < 14; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('Bulldoze explains town and cash gates, permits exact25 payment, and cancellation never removes a terrain tile', async ({ page }) => {
  const f = bulldozeFixture(); f.state.scenario.farm.cash = 24; let game = f.load().withAllCrops(browserCrops);
  await page.goto('/'); await load(page, game.save(4)); await expect(page.locator('#removal-panel')).toHaveCount(0);
  await select(page, 50, 50); await expect(page.locator('#bulldoze-result')).toContainText('Town-owned land');
  await select(page, 95, 95); await expect(page.locator('#bulldoze-result')).toContainText('You need $25');
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  f.state.scenario.farm.cash = 25; game = f.load().withAllCrops(browserCrops); await load(page, game.save(4)); await expect(page.locator('#removal-panel')).toHaveCount(0);
  await reveal(page,'#viewport');await page.getByRole('button',{name:'Bulldoze',exact:true}).click();await page.keyboard.press('Escape');await expect(page.locator('#cancel-bulldoze')).toHaveCount(0);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await select(page, 95, 95); const quote = checkManualRemoval(game.getSnapshot().scenario, 95, 95); if (!quote.ok) throw new Error('Missing tree');
  game.dispatch({ type: 'remove-object', x: 95, y: 95, kind: quote.kind, slot: quote.slot, tile: quote.tile });
  await expect(page.locator('#farm-cash')).toHaveText('$0'); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
