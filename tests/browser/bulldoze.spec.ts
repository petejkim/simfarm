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
  const file = 'artifacts/browser-bulldoze.simfarm.json'; await (await pending).saveAs(file); return JSON.parse(readFileSync(file, 'utf8'));
}
async function select(page: Page, x: number, y: number) {
  await reveal(page, '#viewport'); const viewport = page.locator('#viewport'); await viewport.evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await viewport.scrollIntoViewIfNeeded(); const rect = await page.locator('#world').boundingBox(); expect(rect).not.toBeNull();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8); await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
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
  await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption({ label: 'Bulldoze' }); await reveal(page, '#sound-toggle'); await page.locator('#sound-toggle').click();
  for (const [i, [x, y]] of bulldozeTargets.entries()) {
    await select(page, x, y); const quote = checkManualRemoval(game.getSnapshot().scenario, x, y); expect(quote.ok).toBe(true);
    if (!quote.ok) throw new Error('Missing target');
    if (i < 3) await expect(page.locator('#removal-consequences')).toContainText('all its remaining contents');
    if (i === 3) {
      await expect(page.locator('#removal-consequences')).toContainText('connected roads, fences, ditches or shoreline');
      await page.setViewportSize({ width: 1280, height: 844 }); await reveal(page, '#removal-panel'); await page.locator('#removal-panel').scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
      await page.screenshot({ path: 'artifacts/browser-bulldoze.png', fullPage: true });
    }
    await reveal(page, '#confirm-removal'); await page.locator('#confirm-removal').click(); game.dispatch({ type: 'remove-object', x, y, kind: quote.kind, slot: quote.slot, tile: quote.tile });
    await expect(page.locator('#removal-result')).toContainText('removed for $25.');
    if (i === 3) await expect.poll(() => page.evaluate(() => (window as unknown as { __bulldozePeak?: number }).__bulldozePeak ?? 0)).toBeGreaterThan(0.01);
    await reveal(page, '#cancel-removal'); await page.locator('#cancel-removal').click();
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await pixels(page, game.getSnapshot().scenario);
  await page.reload(); await load(page, game.save(4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('remove');
  await expect(page.locator('#removal-result')).toHaveCount(0);
  for (let d = 0; d < 14; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('Bulldoze explains town and cash gates, permits exact25 payment, and cancellation never removes a terrain tile', async ({ page }) => {
  const f = bulldozeFixture(); f.state.scenario.farm.cash = 24; let game = f.load().withAllCrops(browserCrops);
  await page.goto('/'); await load(page, game.save(4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('remove');
  await select(page, 50, 50); await expect(page.locator('#removal-selection')).toContainText('Town-owned land'); await expect(page.locator('#confirm-removal')).toBeDisabled();
  await select(page, 95, 95); await expect(page.locator('#removal-selection')).toContainText('You need $25'); await expect(page.locator('#confirm-removal')).toBeDisabled();
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  f.state.scenario.farm.cash = 25; game = f.load().withAllCrops(browserCrops); await load(page, game.save(4)); await reveal(page, '#map-tool'); await page.locator('#map-tool').selectOption('remove');
  await select(page, 95, 95); await expect(page.locator('#confirm-removal')).toBeEnabled(); await reveal(page, '#cancel-removal'); await page.locator('#cancel-removal').click();
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await select(page, 95, 95); const quote = checkManualRemoval(game.getSnapshot().scenario, 95, 95); if (!quote.ok) throw new Error('Missing tree');
  await reveal(page, '#confirm-removal'); await page.locator('#confirm-removal').click(); game.dispatch({ type: 'remove-object', x: 95, y: 95, kind: quote.kind, slot: quote.slot, tile: quote.tile });
  await expect(page.locator('#farm-cash')).toHaveText('$0'); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
