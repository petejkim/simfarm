import { test, expect, type Page } from '@playwright/test';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { openWindow } from '../support/workspace';
import { readSaveText } from '../support/save-file';

async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return readSaveText((await (await pending).path())!);
}

test('closed windows retain their DOM and controls, skip snapshot reports, and refresh with canonical data on reopening', async ({ page }) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => localStorage.setItem('simfarm.options.v1', JSON.stringify({ music: false, sound: false })));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const f = shopFixture(); f.state.paused = true;
  const game = f.load().withAllCrops(browserCrops), text = game.save(4), cash = game.getSnapshot().scenario.farm.cash;
  await page.locator('#load-farm-file').setInputFiles({ name: 'windows.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await openWindow(page, 'buy'); await page.getByRole('button', { name: 'Machinery', exact: true }).click();
  await page.getByRole('button', { name: 'Next item', exact: true }).click();
  const selection = await page.locator('#buy-description').textContent();
  await page.getByRole('button', { name: 'Close Buy', exact: true }).click();
  await openWindow(page, 'bank'); await page.locator('#loan-amount').fill('1234');
  await page.getByRole('button', { name: 'Close Bank', exact: true }).click();
  await openWindow(page, 'balance'); await expect(page.locator('#balance-asset-0')).toHaveText(String(cash));
  await page.evaluate(() => Object.assign(window, { retainedBalance: document.querySelector('#balance-asset-0') }));
  await page.getByRole('button', { name: 'Close Balance Sheet', exact: true }).click();
  for (let i = 0; i < 3; i++) {
    await page.locator('#debug-menu-button').click();
    await page.getByRole('menuitem', { name: /CORN/ }).click();
    game.dispatch({ type: 'debug-cheat', code: 'CORN' });
  }
  await expect(page.locator('#farm-cash')).toHaveText(`$${(cash + 30000).toLocaleString('en-US')}`);
  await expect(page.locator('#balance-asset-0')).toHaveText(String(cash));
  expect(await page.evaluate(() => (window as unknown as { retainedBalance: Element }).retainedBalance === document.querySelector('#balance-asset-0'))).toBe(true);
  expect(JSON.parse(await save(page))).toEqual(JSON.parse(game.save(4)));
  await openWindow(page, 'balance'); await expect(page.locator('#balance-asset-0')).toHaveText(String(cash + 30000));
  await openWindow(page, 'bank'); await expect(page.locator('#loan-amount')).toHaveValue('1234');
  await openWindow(page, 'buy'); await expect(page.locator('#buy-description')).toHaveText(selection!);
  expect(JSON.parse(await save(page))).toEqual(JSON.parse(game.save(4)));
});
