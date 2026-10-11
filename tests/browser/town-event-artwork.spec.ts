import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { worldIndex } from '../../src/formats/scenario';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(a => a.name === name)!.bytes;
async function save(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'town-event.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}

test('saved recreation banks render original pixels at terrain scale through all weather palettes and reloads', async ({ page }) => {
  await page.clock.install({ time: new Date('1993-01-01') }); await page.clock.pauseAt(new Date('1993-01-01'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const f = shopFixture(); f.state.paused = true;
  for (let tile = 0; tile < 35; tile++) Object.assign(f.state.scenario.cells[worldIndex(tile % 7, Math.floor(tile / 7))], { terrain: 483 + tile, overlay: 0 });
  Object.assign(f.state.scenario.cells[worldIndex(7, 0)], { terrain: 482, overlay: 0 });
  Object.assign(f.state.scenario.cells[worldIndex(7, 1)], { terrain: 518, overlay: 0 });
  for (const mode of [0, 1, 2] as const) for (const [current, temperature, paletteName] of [[0, 70, 'simfarm.pal'], [3, 70, 'rainpal.pal'], [3, 20, 'frostpal.pal']] as const) {
    // A source insufficient-funds rodeo can retain bank1 while mode0. The renderer
    // must follow uploaded bank ownership, not infer it from simulation mode.
    f.state.townEvent.mode = 0; f.state.townEvent.artworkMode = mode;
    Object.assign(f.state.weather, { current, temperature });
    const text = f.load().withAllCrops(browserCrops).save(4); await load(page, text);
    const pixels = await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext('2d')!.getImageData(0, 0, 128, 80).data));
    const palette = readPalette(asset(paletteName)), raw = asset('twnevent.til');
    for (let tile = 0; tile < 35; tile++) {
      const expected = decodePlanar(raw.subarray(mode * 4480 + tile * 128, mode * 4480 + (tile + 1) * 128), 16, 16, palette).rgba;
      const actual: number[] = [];
      for (let y = 0; y < 16; y++) {
        const start = ((Math.floor(tile / 7) * 16 + y) * 128 + tile % 7 * 16) * 4;
        actual.push(...pixels.slice(start, start + 64));
      }
      expect(actual, `bank${mode}, ${paletteName}, tile${tile}`).toEqual(Array.from(expected));
    }
    for (const [tile, row] of [[482, 0], [518, 1]]) {
      const expected = decodePlanar(asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128), 16, 16, palette).rgba;
      const actual: number[] = [];
      for (let y = 0; y < 16; y++) actual.push(...pixels.slice(((row * 16 + y) * 128 + 112) * 4, ((row * 16 + y) * 128 + 128) * 4));
      expect(actual).toEqual(Array.from(expected));
    }
    expect(await save(page)).toEqual(JSON.parse(text));
  }
  await page.locator('#viewport').evaluate(el => el.scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/browser-town-event-artwork.png' });
});
