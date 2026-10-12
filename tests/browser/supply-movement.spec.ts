import {readSaveText} from '../support/save-file';
import { clickFarmTile } from '../support/field-actions';
import { reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
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
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const file = 'artifacts/browser-supply-movement.simfarm.json'; await (await pending).saveAs(file); return JSON.parse(readSaveText(file));
}
async function startMove(page:Page){
  await reveal(page,'#viewport');await page.getByRole('button',{name:'Move object',exact:true}).click();
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

test('original Move tool moves all five supply categories with exact original pixels, safe cancellation and browser checkpoints', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const f = supplyMovementFixture(); f.state.scenario.cells[worldIndex(5, 5)].overlay = 0;
  const game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await startMove(page);
  await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');
  await clickFarmTile(page, 16, 10); await clickFarmTile(page, 5, 5);
  
  await clickFarmTile(page, 18, 10); 
  await page.keyboard.press('Escape');expect(await save(page)).toEqual(JSON.parse(game.save(4)));await startMove(page);
  for (const [sx, x, tile, overlay] of [[10, 20, 832, undefined], [12, 22, 816, undefined],
    [14, 24, 15, 915], [16, 26, 176, undefined], [18, 28, 15, 1020]] as const) {
    const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, sx, 10); if (!selected.ok) throw new Error('Missing supply');
    await clickFarmTile(page, sx, 10); await clickFarmTile(page, x, 20);
    game.dispatch({ type: 'move-supply', selected, x, y: 20 });
    await page.getByRole('button',{name:'Move object',exact:true}).click();
    await originalPixels(page, x, 20, tile, overlay); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await page.reload(); await load(page, game.save(4)); await startMove(page);
  await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');
  for (let d = 0; d < 7; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('supplies transfer into original storage, reopen and leave it; empty feed is discarded and controls fit a narrow viewport', async ({ page }) => {
  const f = supplyMovementFixture(), game = f.load().withAllCrops(browserCrops); await page.goto('/'); await load(page, game.save(4));
  await startMove(page);
  for (const [sx, x, y] of [[10, 30, 30], [12, 40, 40], [14, 40, 40]]) {
    const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, sx, 10); if (!selected.ok) throw new Error('Missing supply');
    await clickFarmTile(page, sx, 10); await clickFarmTile(page, x, y);
    
    game.dispatch({ type: 'move-supply', selected, x, y }); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await clickFarmTile(page,40,40);await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');
  // Original secondary-button building entry keeps Move armed.
  const box=(await page.locator('#world').boundingBox())!;await page.mouse.click(box.x+40*16+8,box.y+40*16+8,{button:'right'});
  game.dispatch({type:'toggle-building-interior',x:40,y:40,slot:2});
  const s = game.getSnapshot(), selected = checkSupplyPickup(s.scenario, s.finances, 40, 40); if (!selected.ok) throw new Error('Missing stored harvest');
  await clickFarmTile(page,40,40);await clickFarmTile(page,25,25);await page.getByRole('button',{name:'Move object',exact:true}).click();
  game.dispatch({ type: 'move-supply', selected, x: 25, y: 25 }); await originalPixels(page, 40, 40, 217); await originalPixels(page, 25, 25, 816);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  const empty = supplyMovementFixture(); empty.state.scenario.inventory[4].bytes[2] = empty.state.scenario.inventory[4].bytes[3] = 0;
  const emptyGame = empty.load().withAllCrops(browserCrops); await load(page, emptyGame.save(4)); await startMove(page);
  await clickFarmTile(page, 18, 10); await clickFarmTile(page, 20, 20);
  await page.setViewportSize({ width: 1280, height: 844 }); 
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-supply-movement.png', fullPage: true });
  const es = emptyGame.getSnapshot(), feed = checkSupplyPickup(es.scenario, es.finances, 18, 10); if (!feed.ok) throw new Error('Missing feed');
  emptyGame.dispatch({ type: 'move-supply', selected: feed, x: 20, y: 20 });
   expect(await save(page)).toEqual(JSON.parse(emptyGame.save(4)));
});
