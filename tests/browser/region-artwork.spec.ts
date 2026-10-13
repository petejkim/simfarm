import {readSaveText} from '../support/save-file';
import { newGame , speedItem, expectNoHorizontalOverflow } from '../support/workspace';
import { reveal, openWindow } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readPalette } from '../../src/formats/graphics';
import { readRegionArtwork } from '../../src/formats/region-artwork';
import { readSetupMap } from '../../src/formats/new-farm';
const raw = (name: string) => readFileSync(new URL('../../public/assets/raw/' + name, import.meta.url));
const locations = readSetupMap(raw('scenario.odt')).locations;
const artwork = readRegionArtwork(raw('scenario.int'), readPalette(raw('scenario.pal')));
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function chooser(page: Page) {
  await newGame(page); await page.locator('#new-farm-seed').fill('9029');  await reveal(page, '#geographic-chooser'); await expect(page.locator('#geographic-chooser')).toBeVisible();
}
/** Structural check of the rebuilt chooser for selected region x,y: real text, meters, and the XOR outline strips. */
async function pixels(page: Page, x: number, y: number) {
  const chooser = page.locator('#geographic-chooser'), p = locations[y * 18 + x];
  await expect(chooser.locator('.region-title')).toHaveText('SELECTA REGION');
  await expect(chooser.locator('.region-action')).toHaveText(['Use This Region', 'Design Your Own', 'Load a Saved Game']); // Quit removed: Cancel closes setup
  expect(await chooser.locator('.region-label, .region-range, .region-action').evaluateAll(els =>
    els.every(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight))).toBe(true);
  await expect(chooser.locator('canvas, img')).toHaveCount(0);
  // 31f53: 96×10 bars, 32 pixels per climate level, palette 6.
  const meters = chooser.getByRole('meter');
  for (const [i, level] of [p.precipitation, p.temperature, p.wind].entries()) {
    await expect(meters.nth(i)).toHaveAttribute('aria-valuenow', String(level));
    expect(await meters.nth(i).locator('span').evaluate(el => [el.getBoundingClientRect().width, el.getBoundingClientRect().height, getComputedStyle(el).backgroundColor]))
      .toEqual([level * 32, 10, `rgb(${artwork.palette[6].join(', ')})`]);
  }
  await expect(page.locator(`[data-region="${x},${y}"]`)).toHaveAttribute('aria-pressed', 'true');
  const grid = (await page.locator('#region-map').boundingBox())!, outline = page.locator('.region-selection');
  expect(await outline.locator('.sprite').evaluateAll(els => els.map(e => (e as HTMLElement).style.backgroundPosition)))
    .toEqual([[1, 0], [1, 16], [0, 1], [16, 0]].map(([dx, dy]) => `${-(x * 16 + dx)}px ${-(y * 16 + dy)}px`));
}

test('original geographic panel paints exact markers and bars, preserves selection-only state, and opens custom design directly', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await start(page); const before = await save(page); await chooser(page); await pixels(page, 8, 13); // native default: Region 9, 14
  await page.locator('[data-region="1,3"]').click(); await pixels(page, 1, 3);
  await expect(page.locator('#region-selection')).toContainText('Scenario 3');
  await page.mouse.move(0, 0); await page.locator('[data-region="1,3"]').evaluate((e: HTMLButtonElement) => e.blur());
  // Framed client: the source panel less its frame (456×311); the map grid sits at source 248,40.
  const chooserBox = (await page.locator('#geographic-chooser').boundingBox())!;
  // Check enabled and disabled hit areas, not just the hidden underlying canvas.
  expect(await page.locator('.region-grid button').evaluateAll(els=>els.every(e=>{const s=getComputedStyle(e);return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.borderTopWidth==='0px'&&s.paddingTop==='0px';}))).toBe(true);
  await page.locator('#geographic-chooser').screenshot({ path: 'artifacts/browser-region-artwork-desktop.png' });
  await page.locator('[data-region="1,3"]').focus(); await page.keyboard.press('ArrowRight');
  await pixels(page, 2, 3); expect(await save(page)).toEqual(before);
  const selected = locations[3 * 18 + 2];
  await page.setViewportSize({ width: 1280, height: 844 });
  await expectNoHorizontalOverflow(page);
  await pixels(page, 2, 3);
  await page.locator('#geographic-chooser').screenshot({ path: 'artifacts/browser-region-artwork-mobile.png' });
  await reveal(page, '#region-design'); await page.locator('#region-design').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Design your terrain' })).toBeFocused();
  for (const key of ['precipitation', 'temperature', 'wind'] as const)
    await expect(page.locator(`#terrain-${key}`)).toHaveValue(String(selected[key]));
  // The source fill helper truncates both X edges to bytes:27/54 become24/48.
  await reveal(page, '#terrain-precipitation'); await page.locator('#terrain-precipitation').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  expect(await page.locator('.terrain-level-precipitation').evaluate(el => el.getBoundingClientRect().width)).toBe(24);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); expect(await save(page)).toEqual(before); expect(errors).toEqual([]);
});

test('chooser Load opens its file picker for exact checkpoint restoration and Cancel closes it without losing the farm', async ({ page }) => {
  await start(page); const before = await save(page); await chooser(page);
  const picker = page.waitForEvent('filechooser'); await reveal(page, '#region-load'); await page.locator('#region-load').click();
  await (await picker).setFiles({ name: 'chooser-checkpoint.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(before)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); expect(await save(page)).toEqual(before);
  await expect(page.locator('#geographic-chooser')).toHaveCount(0);
  await chooser(page); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#geographic-chooser')).toHaveCount(0); expect(await save(page)).toEqual(before);
  await chooser(page); const bad = page.waitForEvent('filechooser'); await reveal(page, '#region-load'); await page.locator('#region-load').click();
  await (await bad).setFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('#new-farm-error')).toContainText('Could not open farm'); expect(await save(page)).toEqual(before);
});

test('truncated original artwork and palette fail atomically and Cancel cancels a pending region load', async ({ page }) => {
  await start(page); const before = await save(page);
  for (const [file, length] of [['scenario.int', 153599], ['scenario.pal', 47]] as const) {
    await page.route(`**/assets/raw/${file}`, route => route.fulfill({ body: raw(file).subarray(0, length), contentType: 'application/octet-stream' }));
    await newGame(page); await page.locator('#new-farm-seed').fill('9029');
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
  await page.getByRole('button', { name: 'Cancel', exact: true }).click(); finish();
  await page.unroute('**/assets/raw/SCEN7.SSM'); expect(await save(page)).toEqual(before);
  await chooser(page); await pixels(page, 8, 13); // native default: Region 9, 14
});
