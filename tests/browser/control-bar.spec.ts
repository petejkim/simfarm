import {readSaveText} from '../support/save-file';
import { reveal, openWindow, focusEdit , speedItem } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';

async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
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
  expect(box).toEqual({ x: 0, y: 16, width: 1280, height: 32 }); // spans the page
  expect(await bar.getByRole('button').evaluateAll(els => els.map(el => el.getAttribute('aria-label')))).toEqual(
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Market Value', 'Farm Expert', 'Resume']);
  await expect(page.locator('#window-edit')).toHaveCount(0);
  for (const [index, button] of (await bar.locator('.toolbar-launchers').getByRole('button').all()).entries()) {
    expect(await button.boundingBox()).toEqual({ x: index * 32, y: 16, width: 32, height: 32 });
  }
  expect(await page.locator('#windows-menu-button').boundingBox()).toMatchObject({ y: 0, height: 16 }); // content-sized heading in the 16px bar
  expect(await page.locator('.original-menu-bar').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(85, 85, 85)');
  await expect(page.locator('#window-market')).toBeEnabled();
  const caption = await page.locator('#window-buy .toolbar-caption').evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range); return selection.toString();
  });
  expect(caption).toBe('BUY');
  const date = await page.locator('#farm-date').textContent();
  await (await speedItem(page,'#next-day')).click(); await expect(page.locator('#farm-date')).not.toHaveText(date!);
  await reveal(page, '#window-bank'); await page.locator('#window-bank').click(); await reveal(page, '#loan-amount'); await page.locator('#loan-amount').fill('1000');
  const cash = Number((await page.locator('#farm-cash').textContent())!.replace(/[^\d-]/g, '')); await reveal(page, '#borrow-loan'); await page.locator('#borrow-loan').click();
  await expect(page.locator('#loan-balance')).toHaveText('$1,000');
  await expect(page.locator('#farm-cash')).toHaveText(`$${(cash + 1000).toLocaleString('en-US')}`);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'artifacts/browser-control-bar-desktop.png' });
  // No minimum width: narrow pages wrap the strip onto a second 32px row (user request) without page scrolling.
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => scrollTo(0, 0));
  expect(await bar.boundingBox()).toEqual({ ...box, width: 390, height: 64 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});

test('Windows menu and toolbar route to the same controls; Edit focuses the map without changing the farm', async ({ page }) => {
  await start(page); const before = await save(page);
  await reveal(page, '#windows-menu-button'); await page.locator('#windows-menu-button').focus(); await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Windows' });
  expect(await menu.getByRole('menuitemcheckbox').evaluateAll(els=>els.map(el=>[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')))).toEqual(
    ['Buy', 'Sell', 'Evaluation', 'Map', 'Weather', 'Balance Sheet', 'Bank', 'Market Value', 'Farm Expert']); // Edit omitted (user request)
  await expect(menu.getByRole('menuitemcheckbox', { name: 'Buy', exact: true })).toBeFocused();
  await page.keyboard.press('End'); await expect(menu.getByRole('menuitemcheckbox', { name: 'Farm Expert' })).toBeFocused();
  await page.keyboard.press('ArrowUp'); await expect(menu.getByRole('menuitemcheckbox', { name: 'Market Value', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.locator('#windows-menu-button')).toBeFocused();
  for (const viaMenu of [false, true]) {
    const open = async (key: string, label: string) => {
      if(key==='edit'){await focusEdit(page);return;}
      if(!viaMenu){await page.locator(`#window-${key}`).click();return;}
      await page.locator('#windows-menu-button').click();
      const item=page.getByRole('menuitemcheckbox',{name:label,exact:true});
      const alreadyOpen=await item.getAttribute('aria-checked')==='true';
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
    await open('expert', 'Farm Expert'); await expect(page.getByRole('region', { name: 'Farm Expert' })).toBeFocused();
    await open('edit', 'Edit'); await expect(page.locator('#viewport')).toBeFocused();
    await reveal(page, '#world'); await expect(page.locator('#world')).toBeVisible();
  }
  await windowMenu(page, 'Farm Expert'); await expect(page.getByRole('region', { name: 'Farm Expert' })).toBeFocused();
  expect(await save(page)).toEqual(before);
});

test('the native Farm Expert launcher shows the halved expert head and stays depressed while the Expert is open', async ({ page }) => {
  await start(page); const launcher = page.locator('#window-expert');
  expect(await launcher.boundingBox()).toEqual({ x: 8 * 32, y: 16, width: 32, height: 32 });
  expect(await launcher.locator('.bevel-button-face').evaluate(el => [(el as HTMLElement).style.backgroundImage.includes('expert-launcher.png'), (el as HTMLElement).style.backgroundPosition])).toEqual([true, '0px 0px']);
  await expect(launcher).toHaveAttribute('aria-pressed', 'false');
  await launcher.click(); await expect(page.getByRole('region', { name: 'Farm Expert' })).toBeFocused(); await expect(launcher).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape'); await expect(launcher).toHaveAttribute('aria-pressed', 'false');
});

test('the pause/resume launcher sits right of Date and Funds and toggles time with matching faces', async ({ page }) => {
  await start(page); const toggle = page.locator('#toolbar-pause'), funds = (await page.locator('#farm-cash').locator('..').boundingBox())!;
  const box = (await toggle.boundingBox())!; expect([box.width, box.height, box.y]).toEqual([32, 32, 16]);
  expect(box.x).toBeGreaterThanOrEqual(funds.x + funds.width); // right of the readouts
  const face = () => toggle.locator('.bevel-button-face').evaluate(el => [(el as HTMLElement).style.backgroundImage.includes('time-toggle.png'), (el as HTMLElement).style.backgroundPosition]);
  await expect(page.locator('#time-status')).toContainText('Paused');
  await expect(toggle).toHaveAccessibleName('Resume'); expect(await face()).toEqual([true, '-26px 0px']); // play arrow
  const before = await save(page);
  await toggle.click(); await expect(toggle).toHaveAccessibleName('Pause'); expect(await face()).toEqual([true, '0px 0px']);
  await expect(page.locator('#time-status')).toContainText('Running');
  await toggle.click(); await expect(toggle).toHaveAccessibleName('Resume'); await expect(page.locator('#time-status')).toContainText('Paused');
  expect(await save(page)).toEqual(before); // frozen clock: toggling alone changes no farm state
});

test('missing control-bar artwork reports an asset error before starting the farm', async ({ page }) => {
  await page.route('**/assets/control-bar.png', route => route.abort()); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SimFarm assets unavailable' })).toBeVisible();
  await expect(page.locator('.loading')).toContainText('control-bar.png');
  await expect(page.locator('#world')).toHaveCount(0);
});

test('flex-laid launchers and insets rebuild the source bevels with CSS around sprite faces, with captions as text', async ({ page }) => {
  await start(page); await page.evaluate(() => scrollTo(0, 0));
  const bar = page.getByRole('toolbar', { name: 'Game toolbar' });
  await expect(bar.locator('img')).toHaveCount(0);
  expect(await bar.locator('*').evaluateAll(els => els.filter(el => getComputedStyle(el).position === 'absolute').length)).toBe(0);
  const faces = [0, 1, 2, 3, 4, 5, 6, 8]; // source face7 (Edit) has no launcher; the last launcher is the native Expert face
  for (const [index, launcher] of (await bar.locator('.toolbar-launchers .window-launcher').all()).entries()) {
    // The frame is the button's black background behind 1px padding, so fractional zoom cannot open a gap.
    expect(await launcher.evaluate(el => { const s = getComputedStyle(el); return [s.borderTopWidth, s.backgroundColor, s.paddingTop]; })).toEqual(['0px', 'rgb(0, 0, 0)', '1px']);
    expect(await launcher.locator('.window-launcher-face').evaluate(el => { const s = getComputedStyle(el); return [s.borderTopWidth, s.borderTopColor, s.borderRightColor, s.backgroundPositionX, s.backgroundPositionY, s.imageRendering]; }))
      .toEqual(['2px', 'rgb(255, 255, 255)', 'rgb(130, 130, 130)', ...(index < faces.length ? [`${-(faces[index] * 32 + 3)}px`, '-3px'] : ['0px', '0px']), 'pixelated']);
  }
  // Full-width strip: readouts end 3px before the native pause launcher at the right edge; the forecast centres
  // between the launchers (nine, ending x288) and readouts.
  const right = page.viewportSize()!.width - 32;
  expect(await page.locator('#toolbar-pause').boundingBox()).toEqual({ x: right, y: 16, width: 32, height: 32 });
  expect(await page.locator('#farm-date').locator('..').boundingBox()).toEqual({ x: right - 103, y: 16, width: 100, height: 15 });
  expect(await page.locator('#farm-cash').locator('..').boundingBox()).toEqual({ x: right - 103, y: 33, width: 100, height: 15 });
  for (const id of ['#farm-date', '#farm-cash']) expect(await page.locator(id).locator('..').evaluate(el => getComputedStyle(el).fontSize)).toBe('10px');
  // The longest month name still fits without clipping.
  expect(await page.locator('#farm-date').evaluate(el => { const saved = el.textContent; el.textContent = 'September 30, 1993'; const fits = el.scrollWidth <= el.parentElement!.clientWidth; el.textContent = saved; return fits; })).toBe(true);
  expect(await page.locator('.toolbar-forecast').boundingBox()).toEqual({ x: (288 + right - 148) / 2 - 26, y: 22, width: 52, height: 20 });
  for (const id of ['#farm-date', '#farm-cash', '#farm-date-label', '#farm-cash-label']) expect(await page.locator(id).evaluate(el => getComputedStyle(el).color)).toBe('rgb(0, 0, 0)');
  await expect(page.locator('#farm-date-label')).toHaveText('Date'); await expect(page.locator('#farm-cash-label')).toHaveText('Funds');
  expect(await bar.locator('.toolbar-caption').allTextContents()).toEqual(['BUY', 'SELL']);
  await page.locator('#window-buy').hover(); await page.mouse.down();
  expect(await page.locator('#window-buy .window-launcher-face').evaluate(el => getComputedStyle(el).borderTopColor)).toBe('rgb(130, 130, 130)');
  await page.mouse.up();
});

test('launchers stay depressed while their window is open and release when it closes', async ({ page }) => {
  await start(page);
  const buy = page.locator('#window-buy'), bank = page.locator('#window-bank');
  const bevel = (button: typeof buy) => button.locator('.window-launcher-face').evaluate(el => getComputedStyle(el).borderTopColor);
  await expect(buy).toHaveAttribute('aria-pressed', 'false'); expect(await bevel(buy)).toBe('rgb(255, 255, 255)');
  await buy.click(); await page.mouse.move(600, 600);
  await expect(buy).toHaveAttribute('aria-pressed', 'true'); expect(await bevel(buy)).toBe('rgb(130, 130, 130)');
  await bank.click(); await page.mouse.move(600, 600);
  await expect(buy).toHaveAttribute('aria-pressed', 'true'); await expect(bank).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Close Bank', exact: true }).click();
  await expect(bank).toHaveAttribute('aria-pressed', 'false'); expect(await bevel(bank)).toBe('rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Close Buy', exact: true }).click();
  await expect(buy).toHaveAttribute('aria-pressed', 'false'); expect(await bevel(buy)).toBe('rgb(255, 255, 255)');
});

test('on narrow screens the menu bar and toolbar wrap so every control stays fully visible', async ({ page }) => {
  for (const width of [620, 400, 320, 240]) {
    await page.setViewportSize({ width, height: 700 }); await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const bar = page.getByRole('toolbar', { name: 'Game toolbar' }), box = (await bar.boundingBox())!;
    expect(box.height % 32, `width ${width}`).toBe(0); // whole 32px rows
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const controls = [...await bar.getByRole('button').all(), page.locator('#farm-date'), page.locator('#farm-cash'), page.locator('.toolbar-forecast'),
      ...await page.locator('.original-menu-heading').all()];
    for (const control of controls) {
      const r = (await control.boundingBox())!;
      expect(r.x >= 0 && r.x + r.width <= width + 0.5, `${width}: ${await control.evaluate(el => el.id || el.textContent)}`).toBe(true);
    }
    // Readouts and the pause launcher stay together on one row.
    const pause = (await page.locator('#toolbar-pause').boundingBox())!, funds = (await page.locator('#farm-cash').locator('..').boundingBox())!;
    expect(pause.y).toBeLessThanOrEqual(funds.y); expect(pause.y + pause.height).toBeGreaterThanOrEqual(funds.y + funds.height);
  }
});
