import { openWindow } from '../support/workspace';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Edit fills the desktop permanently; windows close without resizing or unmounting the map', async ({ page }) => {
  await page.goto('/'); const map = page.locator('#viewport'); await expect(map).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const selector of ['.original-control-bar > img', '.edit-palette > img', '#world']) {
    const sizes = await page.locator(selector).evaluate((el: HTMLImageElement | HTMLCanvasElement) => ({
      source: { width: el instanceof HTMLImageElement ? el.naturalWidth : el.width, height: el instanceof HTMLImageElement ? el.naturalHeight : el.height },
      display: { width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height },
    }));
    expect(sizes.display).toEqual(sizes.source);
  }
  const palette = await page.locator('.edit-palette').boundingBox();
  for (const [index, button] of (await page.locator('.edit-palette > button').all()).slice(0, 12).entries()) {
    expect(await button.boundingBox()).toEqual({ x: palette!.x + index % 2 * 24, y: palette!.y + Math.floor(index / 2) * 24, width: 24, height: 24 });
  }
  const before = await map.boundingBox(); expect(before!.y).toBe(64); expect(before!.width).toBeGreaterThan(1100); expect(before!.height).toBeGreaterThan(700);
  await expect(page.getByRole('button', { name: 'Close Edit', exact: true })).toHaveCount(0);
  const stamp = await page.locator('#world').evaluate(el => { el.setAttribute('data-retained', 'yes'); return el.getAttribute('data-retained'); });
  await page.locator('#window-bank').click(); await expect(page.getByRole('dialog', { name: 'Bank', exact: true })).toBeVisible();
  expect(await map.boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Close Bank', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('#world')).toHaveAttribute('data-retained', stamp!);
  await page.locator('#window-edit').click(); expect(await map.boundingBox()).toEqual(before);
  await page.screenshot({ path: 'artifacts/browser-edit-workspace-final.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await map.boundingBox()).toMatchObject({ x: before!.x, y: before!.y, width: before!.width - 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(640);
});

test('palette opens field planning and real tools; Speed retains slower pacing and Save/Load stays available through File', async ({ page }) => {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#world')).toBeVisible();
  await page.getByRole('button', { name: 'Plant', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Plant Field', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await openWindow(page,'schedule');await expect(page.locator('#field-planner')).toBeVisible();
  await page.locator('#window-edit').click();
  await page.getByRole('button', { name: 'Dirt road', exact: true }).click();
  await page.getByRole('button', { name: 'Edit tools and help', exact: true }).click();
  await page.getByRole('button', { name: 'Advanced controls', exact: true }).click();
  await expect(page.locator('#map-tool')).toHaveValue('network'); // Help cancels painting but retains the advanced category.
  await page.locator('#map-tool').selectOption('network'); await expect(page.locator('#network-tool')).toHaveValue('road-161');
  await page.locator('#speed-menu-button').click(); await expect(page.locator('#simulation-speed-value')).toHaveText('1×');
  await page.locator('#play-pause').click(); await page.clock.runFor(3000); await expect(page.locator('#time-status')).toContainText('0 days advanced');
  await page.clock.runFor(1100); await expect(page.locator('#time-status')).toContainText('1 days advanced'); await page.locator('#play-pause').click();
  await page.locator('#file-menu-button').click(); const download = page.waitForEvent('download'); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const saved = await download, buffer = readFileSync((await saved.path())!);
  await page.locator('#load-farm-file').setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer});
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await expect(page.locator('#world')).toBeVisible();
});
