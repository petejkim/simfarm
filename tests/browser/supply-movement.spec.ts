import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { supplyMovementFixture } from '../support/supply-movement';
import { checkSupplyPickup } from '../../src/simulation/manual-supply-move';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { readScenario, worldIndex } from '../../src/formats/scenario';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'supplies.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const file = 'artifacts/browser-supply-movement.simfarm.json'; await (await pending).saveAs(file); return JSON.parse(readFileSync(file, 'utf8'));
}
async function selectTile(page: Page, x: number, y: number) {
  await page.locator('#viewport').evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await page.locator('#viewport').scrollIntoViewIfNeeded(); const rect = await page.locator('#world').boundingBox();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function originalPixels(page: Page, x: number, y: number, tile: number, overlay?: number) {
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => archive.find(e => e.name === n)!.bytes;
  const palette = readPalette(asset('simfarm.pal'));
  // Crop uploads0x468c2..0x46a13 replace the base atlas's seed/harvest placeholders.
  const cropSlot = tile >= 832 && tile <= 847 ? tile - 832 : tile >= 816 && tile <= 831 ? tile - 816 : null;
  const raw = cropSlot === null ? asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128)
    : source('CROPS/' + readScenario(source('SCEN4.SSM')).cropFiles[cropSlot].toUpperCase()).subarray(tile >= 832 ? 0x1480 : 0x1400, tile >= 832 ? 0x1500 : 0x1480);
  const expected = decodePlanar(raw, 16, 16, palette).rgba;
  if (overlay !== undefined) {
    const index = overlay - 848, masked = decodePlanar(asset('mskdtile.til').subarray(index * 128, (index + 1) * 128), 16, 16, palette, 7).rgba;
    for (let p = 0; p < expected.length; p += 4) if (masked[p + 3]) expected.set(masked.subarray(p, p + 4), p);
  }
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y })).toEqual(Array.from(expected));
}

test('supplies shortcut moves all five categories with exact original pixels, safe cancellation and browser checkpoints', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = supplyMovementFixture(); f.state.scenario.cells[worldIndex(5, 5)].overlay = 0;
  const game = f.load(); await page.goto('/'); await load(page, game.save(4));
  await page.locator('#livestock-panel > summary').click(); await page.locator('#open-supply-move').click();
  await expect(page.locator('#map-tool')).toHaveValue('supply-move');
  await selectTile(page, 16, 10); await page.locator('#select-supply-move').click(); await selectTile(page, 5, 5);
  await expect(page.locator('#supply-move-quote')).toHaveText('Choose a destination on your land.'); await expect(page.locator('#move-supply')).toBeDisabled();
  await selectTile(page, 18, 10); await expect(page.locator('#supply-move-quote')).toHaveText('Choose clear grass for this supply.');
  await page.locator('#cancel-supply-move').click(); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  for (const [sx, x, tile, overlay, label] of [[10, 20, 832, undefined, 'Seed'], [12, 22, 816, undefined, 'Harvested crop'],
    [14, 24, 15, 915, 'Chemical'], [16, 26, 176, undefined, 'Water trough'], [18, 28, 15, 1020, 'Feed']] as const) {
    const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, sx, 10); if (!selected.ok) throw new Error('Missing supply');
    await selectTile(page, sx, 10); await page.locator('#select-supply-move').click(); await selectTile(page, x, 20);
    await expect(page.locator('#supply-move-quote')).toContainText('No fee.'); await page.locator('#move-supply').click();
    game.dispatch({ type: 'move-supply', selected, x, y: 20 });
    await expect(page.locator('#supply-move-result')).toHaveText(`${label} moved to ${x}, 20.`);
    await originalPixels(page, x, 20, tile, overlay); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await page.reload(); await load(page, game.save(4)); await page.locator('#map-tool').selectOption('supply-move');
  await expect(page.locator('#supply-move-result')).toHaveCount(0);
  for (let d = 0; d < 7; d++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('supplies transfer into original storage, reopen and leave it; empty feed is discarded and controls fit a narrow viewport', async ({ page }) => {
  const f = supplyMovementFixture(), game = f.load(); await page.goto('/'); await load(page, game.save(4));
  await page.locator('#map-tool').selectOption('supply-move');
  for (const [sx, x, y] of [[10, 30, 30], [12, 40, 40], [14, 40, 40]]) {
    const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, sx, 10); if (!selected.ok) throw new Error('Missing supply');
    await selectTile(page, sx, 10); await page.locator('#select-supply-move').click(); await selectTile(page, x, y);
    await expect(page.locator('#supply-move-quote')).toContainText('in building'); await page.locator('#move-supply').click();
    game.dispatch({ type: 'move-supply', selected, x, y }); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await selectTile(page, 40, 40); await expect(page.locator('#select-supply-move')).toBeDisabled();
  await page.locator('#toggle-building-interior').click(); game.dispatch({ type: 'toggle-building-interior', x: 40, y: 40, slot: 2 });
  await expect(page.locator('#supply-move-quote')).toHaveText('Harvested crop at 40, 40.');
  const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, 40, 40); if (!selected.ok) throw new Error('Missing stored harvest');
  await page.locator('#select-supply-move').click(); await selectTile(page, 25, 25); await page.locator('#move-supply').click();
  game.dispatch({ type: 'move-supply', selected, x: 25, y: 25 }); await originalPixels(page, 40, 40, 217); await originalPixels(page, 25, 25, 816);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  const empty = supplyMovementFixture(); empty.state.scenario.inventory[4].bytes[2] = empty.state.scenario.inventory[4].bytes[3] = 0;
  const emptyGame = empty.load(); await load(page, emptyGame.save(4)); await page.locator('#map-tool').selectOption('supply-move');
  await selectTile(page, 18, 10); await page.locator('#select-supply-move').click(); await selectTile(page, 20, 20);
  await expect(page.locator('#supply-move-quote')).toContainText('Discard empty feed');
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#supply-move-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-supply-movement.png', fullPage: true });
  const es = emptyGame.getSnapshot(), feed = checkSupplyPickup(es.scenario, es.finances, 18, 10); if (!feed.ok) throw new Error('Missing feed');
  await page.locator('#move-supply').click(); emptyGame.dispatch({ type: 'move-supply', selected: feed, x: 20, y: 20 });
  await expect(page.locator('#supply-move-result')).toHaveText('Empty feed discarded.'); expect(await save(page)).toEqual(JSON.parse(emptyGame.save(4)));
});
