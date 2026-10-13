import {readSaveText} from '../support/save-file';
import { expectFarmCash } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';

async function save(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  const game = shopFixture().load().withAllCrops(browserCrops);
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#load-farm-file').setInputFiles({ name: 'shop.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  return game;
}
test('original Buy catalog keeps source geometry and ordering, exposes all crops and leaves browsing out of saves', async ({ page }) => {
  await start(page); const before = await save(page);
  await page.locator('#window-buy').click(); const catalog = page.getByRole('region', { name: 'Buy catalog' });
  // Shared frame around a 240×216 client built from components: no background bitmap or canvas.
  await expect(catalog.locator('img,canvas')).toHaveCount(0);
  expect(await catalog.locator('.bevel-button').count()).toBe(9); // 5 categories, 2 arrows, BUY, CLOSE
  expect(await catalog.locator('.sunken-inset').count()).toBe(5); // photo, description, preview, price, own
  expect(await catalog.getByRole('button', { name: 'Machinery', exact: true }).evaluate(el => [getComputedStyle(el).backgroundColor, getComputedStyle(el).boxShadow])).toEqual(['rgb(0, 0, 0)', 'rgb(130, 130, 130) 1px 1px 0px 0px']);
  await expect(catalog.getByRole('button', { name: 'BUY', exact: true })).toHaveText('BUY');
  await expect(catalog.getByRole('button', { name: 'Livestock', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await catalog.getByRole('button', { name: 'Machinery', exact: true }).click();
  await expect(page.locator('#buy-description')).toContainText('Tractor');
  await catalog.getByRole('button', { name: 'Previous item' }).click();
  await expect(page.locator('#buy-description')).toContainText('Crop Duster');
  await catalog.getByRole('button', { name: 'Next item' }).click();
  await expect(page.locator('#buy-description')).toContainText('Tractor');
  await catalog.getByRole('button', { name: 'Seeds', exact: true }).click();
  const names = new Set<string>(); const first = await page.locator('#buy-description').textContent();
  for (let i = 0; i < 24; i++) {
    names.add((await page.locator('#buy-description').textContent())!);
    await expect(catalog.getByRole('img', { name: /illustration$/ })).toHaveCount(1);
    await catalog.getByRole('button', { name: 'Next item' }).click();
  }
  expect(names.size).toBe(24); await expect(page.locator('#buy-description')).toHaveText(first!);
  await page.screenshot({ path: 'artifacts/browser-buy-catalog.png' });
  await catalog.getByRole('button', { name: 'CLOSE', exact: true }).click();
  expect(await save(page)).toEqual(before);
});
test('Buy arms direct map placement, purchases repeatedly, reports blocked cells and cancels with Escape', async ({ page }) => {
  const game = await start(page);
  await page.locator('#window-buy').click(); await page.getByRole('button', { name: 'Machinery', exact: true }).click();
  await page.locator('#catalog-buy').click();
  await expect(page.getByRole('region', { name: 'Buy catalog' })).toBeVisible();
  await page.getByRole('button', { name: 'Close Buy', exact: true }).click();
  await expect(page.locator('#world')).toHaveCSS('cursor',/edit-buy\.png.*0 0, crosshair/);
  await page.locator('#viewport').evaluate(el => el.scrollTo(0, 0));
  const box = (await page.locator('#world').boundingBox())!;
  for (const x of [10, 12]) {
    await page.mouse.click(box.x + x * 16 + 8, box.y + 10 * 16 + 8);
    game.dispatch({ type: 'buy-equipment', equipmentType: 0, x, y: 10 });
    await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  }
  await page.mouse.click(box.x + 10 * 16 + 8, box.y + 10 * 16 + 8);
  await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  await expect(page.locator('#world')).toHaveCSS('cursor',/edit-buy\.png.*0 0, crosshair/);
  // Escape disarms placement: another click on clear ground buys nothing.
  await page.keyboard.press('Escape'); await page.mouse.click(box.x + 14 * 16 + 8, box.y + 10 * 16 + 8); await expectFarmCash(page,game.getSnapshot().scenario.farm.cash);
  await expect(page.locator('#world')).toHaveCSS('cursor',/edit-view\.png.*0 0, crosshair/);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
