import { reveal, openWindow } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}
async function windowMenu(page: Page, name: string) {
  await reveal(page, '#windows-menu-button'); await page.locator('#windows-menu-button').click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

test('source control strip keeps desktop geometry, replaces bitmap words with selectable text and updates live funds/date', async ({ page }) => {
  await start(page);
  const bar = page.getByRole('toolbar', { name: 'Game toolbar' });
  const box = await bar.boundingBox();
  expect(box).toEqual({ x: 0, y: 32, width: 1280, height: 64 });
  expect(await bar.getByRole('button').evaluateAll(els => els.map(el => el.getAttribute('aria-label')))).toEqual(
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Edit', 'Market Value']);
  for (const [index, button] of (await bar.getByRole('button').all()).entries()) {
    expect(await button.boundingBox()).toEqual({ x: index * 64, y: 32, width: 64, height: 64 });
  }
  expect(await page.locator('#windows-menu-button').boundingBox()).toMatchObject({ x: 416, y: 0, width: 112, height: 32 });
  await expect(page.locator('#window-market')).toBeDisabled();
  const caption = await page.locator('#window-buy .toolbar-caption').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range); return selection.toString();
  });
  expect(caption).toBe('BUY');
  const date = await page.locator('#farm-date').textContent();
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); await expect(page.locator('#farm-date')).not.toHaveText(date!);
  await reveal(page, '#window-bank'); await page.locator('#window-bank').click(); await reveal(page, '#loan-amount'); await page.locator('#loan-amount').fill('1000');
  const cash = Number((await page.locator('#farm-cash').textContent())!.replace(/[^\d-]/g, '')); await reveal(page, '#borrow-loan'); await page.locator('#borrow-loan').click();
  await expect(page.locator('#loan-result')).toContainText('Borrowed');
  await expect(page.locator('#farm-cash')).toHaveText(`$${(cash + 1000).toLocaleString('en-US')}`);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/browser-control-bar-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0));
  expect(await bar.boundingBox()).toEqual(box);
  expect(await page.locator('#windows-menu-button').boundingBox()).toMatchObject({ x: 416, width: 112 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});

test('Windows menu and toolbar route to the same controls; Edit focuses the map without changing the farm', async ({ page }) => {
  await start(page); const before = await save(page);
  await reveal(page, '#windows-menu-button'); await page.locator('#windows-menu-button').focus(); await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Windows' });
  expect(await menu.getByRole('menuitem').allTextContents()).toEqual(
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Edit', 'Market Value', 'Farm Expert']);
  await expect(menu.getByRole('menuitem', { name: 'Buy', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitem', { name: 'Farm Expert' })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(menu.getByRole('menuitem', { name: 'Edit', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#windows-menu-button')).toBeFocused();
  for (const viaMenu of [false, true]) {
    const open = (key: string, label: string) => viaMenu ? windowMenu(page, label) : page.locator(`#window-${key}`).click();
    await open('bank', 'Bank'); await expect(page.locator('#loan-panel')).toHaveAttribute('open', '');
    await expect(page.locator('#loan-panel > summary')).toBeFocused();
    await open('buy', 'Buy'); await expect(page.locator('#map-tool')).toHaveValue('crop-supplies');
    await reveal(page, '#crop-supply-shop'); await expect(page.locator('#crop-supply-shop')).toBeVisible();
    await open('map', 'Map'); await expect(page.locator('#map-tool')).toHaveValue('land');
    await open('sell', 'Sell'); await expect(page.getByRole('region', { name: 'Sell harvest' })).toBeFocused();
    await open('weather', 'Weather'); await expect(page.locator('#farm-weather')).toBeFocused();
    await open('evaluation', 'Evaluation'); await expect(page.locator('#farm-report')).toHaveAttribute('open', '');
    await open('balance', 'Balance Sheet'); await expect(page.locator('#tax-panel')).toHaveAttribute('open', '');
    await open('edit', 'Edit'); await expect(page.locator('#viewport')).toBeFocused();
    await reveal(page, '#world'); await expect(page.locator('#world')).toBeVisible();
  }
  await windowMenu(page, 'Farm Expert'); await expect(page.getByRole('region', { name: 'Farm Expert' })).toBeFocused();
  expect(await save(page)).toEqual(before);
});

test('missing control-bar artwork reports an asset error before starting the farm', async ({ page }) => {
  await page.route('**/assets/control-bar.png', route => route.abort()); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SimFarm assets unavailable' })).toBeVisible();
  await expect(page.locator('.loading')).toContainText('control-bar.png');
  await expect(page.locator('#world')).toHaveCount(0);
});
