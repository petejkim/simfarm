import {PNG} from 'pngjs';
import { reveal, openWindow } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readPalette } from '../../src/formats/graphics';
import { readRegionArtwork } from '../../src/formats/region-artwork';
import { readScenarioChooser, readSetupMap } from '../../src/formats/new-farm';
import { renderRegionChooser } from '../../src/render/region-chooser';
const raw = (name: string) => readFileSync(new URL('../../public/assets/raw/' + name, import.meta.url));
const exe = readFileSync(new URL('../../../simfarm-dos/SIMFARM.EXE', import.meta.url));
const { farms } = readScenarioChooser(exe), locations = readSetupMap(raw('scenario.odt')).locations;
const artwork = readRegionArtwork(raw('scenario.int'), readPalette(raw('scenario.pal')));
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function chooser(page: Page) {
  await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await page.locator('#new-farm-seed').fill('9029');  await reveal(page, '#geographic-chooser'); await expect(page.locator('#geographic-chooser')).toBeVisible();
}
async function pixels(page: Page, x: number, y: number) {
  // The source raster remains an exact reference under opaque HTML text surfaces.
  await expect(page.locator('#geographic-chooser .setup-title')).toHaveText('SELECTA REGION');
  await expect(page.locator('#geographic-chooser .setup-button')).toHaveText(['Use This Region', 'Design Your Own', 'Load a Saved Game', 'Quit']);
  expect(await page.locator('#geographic-chooser .setup-title').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el); return range.toString();
  })).toBe('SELECTA REGION');
  expect(await page.locator('#geographic-chooser .setup-button, #geographic-chooser .setup-text').evaluateAll(els =>
    els.every(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight))).toBe(true);
  const actual = await page.locator('#region-artwork').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data));
  expect(actual).toEqual(Array.from(renderRegionChooser(artwork, farms, locations[y * 18 + x]).rgba));
}

test('original geographic panel paints exact markers and bars, preserves selection-only state, and opens custom design directly', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); const before = await save(page); await chooser(page); await pixels(page, 2, 8);
  await page.locator('[data-region="1,3"]').click(); await pixels(page, 1, 3);
  await expect(page.locator('#region-selection')).toContainText('Scenario 3');
  expect(await page.locator('#geographic-chooser').boundingBox()).toMatchObject({ width: 472, height: 328 });
  await page.mouse.move(0, 0);await page.locator('[data-region="1,3"]').evaluate((e:HTMLButtonElement)=>e.blur());
  const mapBounds=(await page.locator('#region-map').boundingBox())!;
  const composite=PNG.sync.read(await page.screenshot({clip:{x:Math.round(mapBounds.x),y:Math.round(mapBounds.y),width:288,height:288}}));
  expect([composite.width,composite.height]).toEqual([288,288]);
  const sourceMap=await page.locator('#region-artwork').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(168,24,288,288).data));
  expect(Array.from(composite.data)).toEqual(sourceMap);
  // Check enabled and disabled hit areas, not just the hidden underlying canvas.
  expect(await page.locator('.region-grid button').evaluateAll(els=>els.every(e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.borderTopWidth==='0px'&&s.paddingTop==='0px';}))).toBe(true);
  await page.locator('#geographic-chooser').screenshot({ path: 'artifacts/browser-region-artwork-desktop.png' });
  await page.locator('[data-region="1,3"]').focus(); await page.keyboard.press('ArrowRight');
  await pixels(page, 2, 3); expect(await save(page)).toEqual(before);
  const selected = locations[3 * 18 + 2];
  await page.setViewportSize({ width: 1280, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await pixels(page, 2, 3);
  await page.locator('#geographic-chooser').screenshot({ path: 'artifacts/browser-region-artwork-mobile.png' });
  await reveal(page, '#region-design'); await page.locator('#region-design').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Design your terrain' })).toBeFocused();
  expect(await page.locator('#terrain-design').boundingBox()).toMatchObject({ width: 352, height: 304 });
  for (const key of ['precipitation', 'temperature', 'wind'] as const)
    await expect(page.locator(`#terrain-${key}`)).toHaveValue(String(selected[key]));
  // The source fill helper truncates both X edges to bytes:27/54 become24/48.
  await reveal(page, '#terrain-precipitation'); await page.locator('#terrain-precipitation').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  const ratio = await page.locator('.terrain-level-precipitation').evaluate(el => el.getBoundingClientRect().width / el.closest('.terrain-design')!.getBoundingClientRect().width);
  expect(ratio).toBeCloseTo(24 / 352, 3);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await save(page)).toEqual(before); expect(errors).toEqual([]);
});

test('chooser Load opens its file picker for exact checkpoint restoration and Quit pauses without losing the farm', async ({ page }) => {
  await start(page); const before = await save(page); await chooser(page);
  const picker = page.waitForEvent('filechooser'); await reveal(page, '#region-load'); await page.locator('#region-load').click();
  await (await picker).setFiles({ name: 'chooser-checkpoint.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); expect(await save(page)).toEqual(before);
  await expect(page.locator('#geographic-chooser')).toHaveCount(0);
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await expect(page.locator('#time-status')).toContainText('Running');
  await chooser(page); await reveal(page, '#region-quit'); await page.locator('#region-quit').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#time-status')).toContainText('Paused'); await reveal(page, '#new-farm'); await expect(page.locator('#new-farm')).toBeVisible();
  expect(await save(page)).toEqual(before);
  await chooser(page); const bad = page.waitForEvent('filechooser'); await reveal(page, '#region-load'); await page.locator('#region-load').click();
  await (await bad).setFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('#new-farm-error')).toContainText('Could not open farm'); expect(await save(page)).toEqual(before);
});

test('truncated original artwork and palette fail atomically and original Quit cancels a pending region load', async ({ page }) => {
  await start(page); const before = await save(page);
  for (const [file, length] of [['scenario.int', 153599], ['scenario.pal', 47]] as const) {
    await page.route(`**/assets/raw/${file}`, route => route.fulfill({ body: raw(file).subarray(0, length), contentType: 'application/octet-stream' }));
    await reveal(page, '#new-farm'); await page.locator('#new-farm').click(); await page.locator('#new-farm-seed').fill('9029');
    await reveal(page, '#region-error'); await expect(page.locator('#region-error')).toBeVisible(); await expect(page.locator('#region-use')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await save(page)).toEqual(before);
    await page.unroute(`**/assets/raw/${file}`);
  }
  await chooser(page); await page.locator('[data-region="15,8"]').click();
  let requested!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { requested = resolve; }), release = new Promise<void>(resolve => { finish = resolve; });
  await page.route('**/assets/raw/SCEN7.SSM', async route => { requested(); await release; await route.continue().catch(() => {}); });
  await reveal(page, '#region-use'); await page.locator('#region-use').click(); await started;
  await expect(page.locator('#region-design')).toBeDisabled(); await expect(page.locator('#region-load')).toBeDisabled();
  await reveal(page, '#region-quit'); await page.locator('#region-quit').click(); finish();
  await page.unroute('**/assets/raw/SCEN7.SSM'); expect(await save(page)).toEqual(before);
  await chooser(page); await pixels(page, 2, 8);
});
