import { openWindow, focusEdit, expectPaletteAction } from '../support/workspace';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('Edit fills the desktop permanently; windows close without resizing or unmounting the map', async ({ page }) => {
  await page.goto('/'); const map = page.locator('#viewport'); await expect(map).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.locator('.original-control-bar').boundingBox()).toMatchObject({ width: page.viewportSize()!.width, height: 32 });
  expect(await page.locator('.window-launcher-face').first().evaluate(el => [el.clientWidth, el.clientHeight])).toEqual([26, 26]);
  expect(await page.locator('.edit-tool .edit-palette-face').first().evaluate(el => [el.clientWidth, el.clientHeight])).toEqual([19, 19]);
  for (const selector of ['#world']) {
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
  await expect(page.locator('.edit-title,[data-window=edit]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close Edit', exact: true })).toHaveCount(0);
  const stamp = await page.locator('#world').evaluate(el => { el.setAttribute('data-retained', 'yes'); return el.getAttribute('data-retained'); });
  await page.locator('#window-bank').click(); await expect(page.getByRole('dialog', { name: 'Bank', exact: true })).toBeVisible();
  expect(await map.boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Close Bank', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('#world')).toHaveAttribute('data-retained', stamp!);
  await focusEdit(page); expect(await map.boundingBox()).toEqual(before);
  await page.screenshot({ path: 'artifacts/browser-edit-workspace-final.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  // No minimum width: the terrain fills whatever remains right of the palette, below the toolbar's wrapped second row.
  expect(await map.boundingBox()).toMatchObject({ x: before!.x, y: before!.y + 32, width: 390 - before!.x });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('palette opens field planning and real tools; Speed retains slower pacing and Save/Load stays available through File', async ({ page }) => {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#world')).toBeVisible();
  await page.getByRole('button', { name: 'Plant', exact: true }).click();
  await expect(page.getByRole('menu', { name: 'Plant Field', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await openWindow(page,'schedule');await expect(page.locator('#field-planner')).toBeVisible();
  await focusEdit(page);
  await page.getByRole('button', { name: 'Dirt road', exact: true }).click();
  await expectPaletteAction(page,'Dirt road');
  await expect(page.getByRole('button', { name: 'Edit tools and help', exact: true })).toHaveCount(0);await page.keyboard.press('Escape');
  await expect(page.locator('#map-tool')).toHaveCount(0);
  await expectPaletteAction(page,'View object');
  await expect(page.locator('#map-tool option[value=network],#network-panel')).toHaveCount(0);
  await page.locator('#speed-menu-button').click(); await expect(page.locator('#simulation-speed-value')).toHaveText('1×');
  await page.locator('#play-pause').click(); await page.clock.runFor(3000); await expect(page.locator('#time-status')).toContainText('0 days advanced');
  await page.clock.runFor(1100); await expect(page.locator('#time-status')).toContainText('1 days advanced'); await page.locator('#play-pause').click();
  await page.locator('#file-menu-button').click(); const download = page.waitForEvent('download'); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  const saved = await download, buffer = readFileSync((await saved.path())!);
  await page.locator('#load-farm-file').setInputFiles({name:'checkpoint.json',mimeType:'application/json',buffer});
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await expect(page.locator('#world')).toBeVisible();
});

test('Edit palette rebuilds source cells with black backgrounds, CSS bevels, sprite faces and HTML captions', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#viewport')).toBeVisible();
  const palette = page.getByRole('toolbar', { name: 'Edit tools' });
  await expect(palette.locator('img')).toHaveCount(0);
  expect(await palette.locator('*').evaluateAll(els => els.filter(el => getComputedStyle(el).position === 'absolute').length)).toBe(0);
  const box = (await palette.boundingBox())!; expect([box.width, box.height]).toEqual([48, 188]); // source ? cell and foot omitted
  const cells: [number, number, number, number][] = [...Array.from({ length: 12 }, (_, i) => [i % 2 * 24, Math.floor(i / 2) * 24, 24, 24] as [number, number, number, number]), [0, 144, 48, 22], [0, 166, 48, 22]];
  for (const [index, button] of (await palette.getByRole('button').all()).entries()) {
    const [x, y, w, h] = cells[index];
    expect(await button.boundingBox()).toEqual({ x: box.x + x, y: box.y + y, width: w, height: h });
    expect(await button.evaluate(el => { const s = getComputedStyle(el); return [s.borderTopWidth, s.backgroundColor, s.paddingTop, s.paddingLeft, s.paddingRight]; })).toEqual(['0px', 'rgb(0, 0, 0)', '1px', '1px', '0px']);
    if (index < 12) expect(await button.locator('.edit-palette-face').evaluate(el => { const s = getComputedStyle(el); return [s.backgroundPosition, s.imageRendering]; })).toEqual([`${-(x + 3)}px ${-(y + 3)}px`, 'pixelated']);
  }
  expect(await palette.getByRole('button').evaluateAll(els => els.slice(12).map(el => el.textContent))).toEqual(['Plant', 'Spray']);
  await palette.getByRole('button', { name: 'Fence', exact: true }).hover(); await page.mouse.down();
  expect(await palette.getByRole('button', { name: 'Fence', exact: true }).locator('.edit-palette-face').evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(130, 130, 130)');
  await page.mouse.up(); await page.keyboard.press('Escape');
});

test('palette keeps the running action depressed and returns to View object when it ends', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#viewport')).toBeVisible();
  const palette = page.getByRole('toolbar', { name: 'Edit tools' });
  const pressed = async () => palette.getByRole('button').evaluateAll(els => els.filter(el => el.getAttribute('aria-pressed') === 'true').map(el => el.getAttribute('aria-label') ?? el.textContent));
  const bevel = (name: string) => palette.getByRole('button', { name, exact: true }).locator('.edit-palette-face').evaluate(el => getComputedStyle(el).borderTopColor);
  expect(await pressed()).toEqual(['View object']);
  await palette.getByRole('button', { name: 'Fence', exact: true }).click(); await page.mouse.move(900, 600);
  expect(await pressed()).toEqual(['Fence']); expect(await bevel('Fence')).toBe('rgb(130, 130, 130)'); expect(await bevel('View object')).toBe('rgb(255, 255, 255)');
  await page.keyboard.press('Escape'); await expect.poll(pressed).toEqual(['View object']);
  await palette.getByRole('button', { name: 'Bulldoze', exact: true }).click(); expect(await pressed()).toEqual(['Bulldoze']);
  await page.keyboard.press('Escape'); await expect.poll(pressed).toEqual(['View object']);
  await palette.getByRole('button', { name: 'Plant', exact: true }).click(); await expect.poll(pressed).toEqual(['Plant']);
  await page.keyboard.press('Escape'); await expect.poll(pressed).toEqual(['View object']);
  await palette.getByRole('button', { name: 'Spray', exact: true }).click(); await expect.poll(pressed).toEqual(['Spray']);
  await page.keyboard.press('Escape'); await expect.poll(pressed).toEqual(['View object']);
});
