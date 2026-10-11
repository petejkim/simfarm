import { readNativeSave } from '../../src/formats/native-save';
import { reveal } from '../support/workspace';
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


test('loaded fair and rodeo animate on simulation ticks, freeze on pause and restore their visible frame', async ({ page }) => {
  await page.clock.install({ time: new Date('1993-01-01') }); await page.clock.pauseAt(new Date('1993-01-01'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  for (const mode of [1, 2] as const) {
    const f = shopFixture(); f.state.scenario.farm.dayDelayTicks = 999;
    f.state.finances.town.recreationCount = 1; f.state.finances.town.recreationCoordinates.set([8, 16]);
    f.state.townEvent.mode = f.state.townEvent.artworkMode = mode;
    f.state.disasters.enabled = false; f.state.weather.current = 0; f.state.weather.temperature = 70;
    const text = f.load().withAllCrops(browserCrops).save(4); await load(page, text);
    const pixels = () => page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(8 * 16, 16 * 16, 8 * 16, 8 * 16).data));
    const initial = await pixels(); await page.clock.runFor(64); expect(await pixels()).toEqual(initial);
    await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await page.clock.runFor(64);
    await page.locator('#play-pause').click(); const stopped = await save(page), animated = await pixels();
    expect(animated).not.toEqual(initial);
    const state = readNativeSave(JSON.stringify(stopped)).state;
    expect(state.townEvent.lastTick).toBeGreaterThanOrEqual(8);
    expect(state.random).not.toEqual(JSON.parse(text).runtime.random);
    const locations = mode === 1 ? [[10, 19], [10, 20], [11, 19], [11, 20]] : [[11, 18], [10, 17], [9, 19], [9, 21], [11, 19], [13, 18]];
    const palette = readPalette(asset('simfarm.pal'));
    for (const [x, y] of locations) {
      const cell = state.scenario.cells[worldIndex(x, y)], tile = cell.terrain & 2047;
      const raw = tile >= 483 && tile < 518 ? asset('twnevent.til') : asset('ega16til.til');
      const offset = tile >= 483 && tile < 518 ? mode * 4480 + (tile - 483) * 128 : tile * 128;
      const expected = decodePlanar(raw.subarray(offset, offset + 128), 16, 16, palette).rgba;
      if (cell.terrain & 0x800) {
        const overlay = (cell.overlay & 2047) - 848;
        const masked = decodePlanar(asset('mskdtile.til').subarray(overlay * 128, (overlay + 1) * 128), 16, 16, palette, 7).rgba;
        for (let i = 0; i < masked.length; i += 4) if (masked[i + 3]) expected.set(masked.subarray(i, i + 4), i);
      }
      const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p[0] * 16, p[1] * 16, 16, 16).data), [x, y]);
      expect(actual).toEqual(Array.from(expected));
    }
    await page.clock.runFor(500); expect(await pixels()).toEqual(animated); expect(await save(page)).toEqual(stopped);
    await page.reload(); await load(page, JSON.stringify(stopped));
    expect(await pixels()).toEqual(animated); expect(await save(page)).toEqual(stopped);
  }
});
