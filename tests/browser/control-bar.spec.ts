import {readSaveText} from '../support/save-file';
import { reveal, openWindow, focusEdit } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}
async function windowMenu(page: Page, name: string) {
  await reveal(page, '#windows-menu-button'); await page.locator('#windows-menu-button').click();
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
}

test('source control strip keeps desktop geometry, replaces bitmap words with selectable text and updates live funds/date', async ({ page }) => {
  await start(page);
  const bar = page.getByRole('toolbar', { name: 'Game toolbar' });
  const box = await bar.boundingBox();
  expect(box).toEqual({ x: 0, y: 16, width: 640, height: 32 });
  expect(await bar.getByRole('button').evaluateAll(els => els.map(el => el.getAttribute('aria-label')))).toEqual(
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Market Value']);
  await expect(page.locator('#window-edit')).toHaveCount(0);
  for (const [index, button] of (await bar.getByRole('button').all()).entries()) {
    expect(await button.boundingBox()).toEqual({ x: index * 32, y: 16, width: 32, height: 32 });
  }
  expect(await page.locator('#windows-menu-button').boundingBox()).toMatchObject({ x: 208, y: 0, width: 56, height: 16 });
  await expect(page.locator('#window-market')).toBeEnabled();
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
  expect(await page.locator('#windows-menu-button').boundingBox()).toMatchObject({ x: 208, width: 56 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(640);
});

test('Windows menu and toolbar route to the same controls; Edit focuses the map without changing the farm', async ({ page }) => {
  await start(page); const before = await save(page);
  await reveal(page, '#windows-menu-button'); await page.locator('#windows-menu-button').focus(); await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Windows' });
  expect(await menu.getByRole('menuitemcheckbox').evaluateAll(els=>els.map(el=>[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')))).toEqual(
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Edit', 'Market Value', 'Farm Expert']);
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Buy', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitemcheckbox', { name: 'Farm Expert' })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(menu.getByRole('menuitemcheckbox', { name: 'Market Value', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#windows-menu-button')).toBeFocused();
  for (const viaMenu of [false, true]) {
    const open = async (key: string, label: string) => {
      if(!viaMenu){if(key==='edit')await focusEdit(page);else await page.locator(`#window-${key}`).click();return;}
      await page.locator('#windows-menu-button').click();
      const item=page.getByRole('menuitemcheckbox',{name:label,exact:true});
      const alreadyOpen=key!=='edit'&&await item.getAttribute('aria-checked')==='true';
      await item.click();
      if(alreadyOpen)await windowMenu(page,label); // Menu closes covered windows before reopening.
    };
    await open('bank', 'Bank'); await expect(page.locator('#loan-panel')).toBeVisible();
    await expect(page.locator('#loan-panel')).toBeFocused();
    await open('buy', 'Buy'); await expect(page.getByRole('region', { name: 'Buy catalog' })).toBeVisible();
    await open('map', 'Map'); await expect(page.getByRole('region', { name: 'Farm overview' })).toBeVisible();
    await open('sell', 'Sell'); await expect(page.getByRole('region', { name: 'Sell catalog' })).toBeFocused();
    await open('weather', 'Weather'); await expect(page.getByRole('region',{name:'Weather conditions',exact:true})).toBeFocused();
    await open('evaluation', 'Evaluation'); await expect(page.getByRole('region',{name:'Farm evaluation',exact:true})).toBeFocused();
    await open('balance', 'Balance Sheet'); await expect(page.getByRole('region',{name:'Farm balance sheet',exact:true})).toBeFocused();
    await open('market', 'Market Value'); await expect(page.getByRole('region', { name: 'Crop market' })).toBeVisible();
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

test('flex-laid launchers and insets rebuild the source bevels with CSS around sprite faces, with captions as text', async ({ page }) => {
  const { PNG } = await import('pngjs');
  const { readArchive } = await import('../../src/formats/archive');
  const { readBitmap, readPalette } = await import('../../src/formats/graphics');
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
  const original = readBitmap(archive.find(e => e.name === 'cntlbtnh.bmp')!.bytes, readPalette(archive.find(e => e.name === 'simfarm.pal')!.bytes));
  await start(page); await page.evaluate(() => scrollTo(0, 0));
  const bar = page.getByRole('toolbar', { name: 'Game toolbar' });
  await expect(bar.locator('img')).toHaveCount(0);
  expect(await bar.locator('*').evaluateAll(els => els.filter(el => getComputedStyle(el).position === 'absolute').length)).toBe(0);
  const faces = [0, 1, 2, 3, 4, 5, 6, 8]; // source face7 (Edit) has no launcher
  for (const [index, launcher] of (await bar.locator('.window-launcher').all()).entries()) {
    // The frame is the button's black background behind 1px padding, so fractional zoom cannot open a gap.
    expect(await launcher.evaluate(el => { const s = getComputedStyle(el); return [s.borderTopWidth, s.backgroundColor, s.paddingTop]; })).toEqual(['0px', 'rgb(0, 0, 0)', '1px']);
    expect(await launcher.locator('.window-launcher-face').evaluate(el => { const s = getComputedStyle(el); return [s.borderTopWidth, s.borderTopColor, s.borderRightColor, s.backgroundPositionX, s.backgroundPositionY]; }))
      .toEqual(['2px', 'rgb(255, 255, 255)', 'rgb(130, 130, 130)', `${-(faces[index] * 32 + 3)}px`, '-3px']);
  }
  // The forecast stays centred between the launchers (now ending x256) and the readout column (x416).
  expect(await page.locator('.toolbar-forecast').boundingBox()).toEqual({ x: 310, y: 22, width: 52, height: 20 });
  expect(await page.locator('#farm-date').locator('..').boundingBox()).toEqual({ x: 461, y: 18, width: 176, height: 13 });
  expect(await page.locator('#farm-cash').locator('..').boundingBox()).toEqual({ x: 461, y: 33, width: 176, height: 13 });
  for (const id of ['#farm-date', '#farm-cash', '#farm-date-label', '#farm-cash-label']) expect(await page.locator(id).evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
  await expect(page.locator('#farm-date-label')).toHaveText('Date'); await expect(page.locator('#farm-cash-label')).toHaveText('Funds');
  expect(await bar.locator('.toolbar-caption').allTextContents()).toEqual(['BUY', 'SELL']);
  const shot = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 16, width: 640, height: 32 } }));
  // Rendered x → source x: launchers 0..6 in place, Market from face8, forecast shifted 16px left; x300 is plain strip.
  const sourceX = (x: number) => x < 224 ? x : x < 256 ? x + 32 : x < 416 ? (x + 16 >= 288 ? x + 16 : 300) : x;
  // Live text replaces source lettering; the forecast interior is checked in weather-window.spec.
  const live = [[3, 20, 26, 9], [35, 20, 26, 9], [400, 2, 58, 13], [400, 17, 58, 13], [463, 4, 172, 9], [463, 19, 172, 9], [312, 8, 48, 16]];
  // Corner pixels where light and shadow bevels meet; the source paints face grey, CSS miters blend.
  const miter = (x: number, y: number) => { const bx = x < 256 ? x % 32 : -1;
    return (bx >= 0 && ((bx === 30 && y === 1) || (bx === 29 && y === 2) || (bx === 1 && y === 30) || (bx === 2 && y === 29)))
      || [[361, 6], [360, 7], [311, 24], [310, 25], [636, 2], [635, 3], [462, 13], [461, 14], [636, 17], [635, 18], [462, 28], [461, 29]].some(([px, py]) => px === x && py === y); };
  const wrong: string[] = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 640; x++) {
    if (miter(x, y) || live.some(([lx, ly, w, h]) => x >= lx && x < lx + w && y >= ly && y < ly + h)) continue;
    const a = [...shot.data.subarray((y * 640 + x) * 4, (y * 640 + x) * 4 + 3)], o = (y * 640 + sourceX(x)) * 4, b = [...original.rgba.subarray(o, o + 3)];
    if (a.some((v, i) => v !== b[i])) wrong.push(`${x},${y}:${a}≠${b}`);
  }
  expect(wrong.slice(0, 20)).toEqual([]);
  await page.locator('#window-buy').hover(); await page.mouse.down();
  expect(await page.locator('#window-buy .window-launcher-face').evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(130, 130, 130)');
  await page.mouse.up();
});
