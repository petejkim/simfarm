import { test, expect, type Page } from '@playwright/test';
import { readSaveText } from '../support/save-file';
import { reveal } from '../support/workspace';

async function save(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}
async function start(page: Page) {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await reveal(page, '#viewport');
  await page.locator('#viewport').evaluate(v => v.scrollTo(350, 300));
}
async function point(page: Page) {
  const box = (await page.locator('#viewport').boundingBox())!;
  return { x: box.x + box.width * 0.3, y: box.y + box.height * 0.4 };
}
async function under(page: Page, at: { x: number; y: number }) {
  return page.locator('#world').evaluate((c, p) => {
    const r = c.getBoundingClientRect(), z = r.width / 1536;
    return [(p.x - r.left) / z, (p.y - r.top) / z];
  }, at);
}

for (const hasTouch of [false, true]) test.describe(hasTouch ? 'CSS-scaled hybrid viewport' : 'desktop viewport', () => {
  test.use({ hasTouch });
  test('Ctrl+wheel zooms under the cursor, keeps Settings and picking in sync, and leaves the checkpoint intact', async ({ page }) => {
    await start(page);
    const before = await save(page), at = await point(page), anchored = await under(page, at);
    const bars = await page.locator('.original-control-bar').boundingBox();
    const pageScale = await page.evaluate(() => visualViewport!.scale);
    await page.mouse.move(at.x, at.y); await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await expect(page.locator('#zoom')).toHaveValue('1.35');
    for (const [i, value] of (await under(page, at)).entries()) expect(Math.abs(value - anchored[i])).toBeLessThan(1);
    await page.mouse.wheel(0, 100); await page.keyboard.up('Control');
    await expect(page.locator('#zoom')).toHaveValue('1');
    for (const [i, value] of (await under(page, at)).entries()) expect(Math.abs(value - anchored[i])).toBeLessThan(1);
    expect(await page.evaluate(() => visualViewport!.scale)).toBe(pageScale);
    expect(await page.locator('.original-control-bar').boundingBox()).toEqual(bars);
    // Scroll without Control remains native scrolling, with no terrain zoom change.
    const top = await page.locator('#viewport').evaluate(v => v.scrollTop);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.locator('#viewport').evaluate(v => v.scrollTop)).toBeGreaterThan(top);
    await expect(page.locator('#zoom')).toHaveValue('1');
    // Pointer-to-tile conversion and the CSS tool highlight use the published zoom.
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
    await expect(page.locator('#zoom')).toHaveValue('1.35');
    const tile = (await under(page, at)).map(v => Math.floor(v / 16));
    await page.mouse.move(at.x + 1, at.y); await page.mouse.move(at.x, at.y);
    const highlight = await page.locator('#world-preview').boundingBox();
    const world = (await page.locator('#world').boundingBox())!, scale = world.width / 1536;
    expect(highlight).not.toBeNull();
    expect(highlight!.x).toBeCloseTo(world.x + tile[0] * 16 * scale, 0);
    expect(highlight!.y).toBeCloseTo(world.y + tile[1] * 16 * scale, 0);
    expect(await save(page)).toEqual(before);
  });
});

test('wheel limits, small trackpad deltas, rapid events, Settings changes and dialog isolation', async ({ page }) => {
  await start(page); const at = await point(page);
  const dispatch = (deltaY: number, deltaMode = 0, count = 1) => page.locator('#world').evaluate((c, args) => {
    return Array.from({ length: args.count }, () => !c.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, ctrlKey: true, clientX: args.at.x, clientY: args.at.y,
      deltaY: args.deltaY, deltaMode: args.deltaMode,
    })));
  }, { at, deltaY, deltaMode, count });
  // Individually sub-percent deltas must accumulate, including events before a React render.
  expect(await dispatch(-1, 0, 10)).toEqual(Array(10).fill(true));
  await expect(page.locator('#zoom')).toHaveValue('1.03');
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('2');
  // A wheel event in the floating Settings window is outside the terrain's listener.
  expect(await page.locator('#zoom').evaluate(c => c.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100,
  })))).toBe(true);
  await expect(page.locator('#zoom')).toHaveValue('2');
  await reveal(page, '#viewport');
  await dispatch(-1, 1); await expect(page.locator('#zoom')).toHaveValue('2.1');
  await dispatch(-100000); await expect(page.locator('#zoom')).toHaveValue('4');
  expect(await dispatch(-100000)).toEqual([true]); // still prevents page zoom at the upper bound
  await dispatch(100000); await expect(page.locator('#zoom')).toHaveValue('0.5');
  expect(await dispatch(100000)).toEqual([true]);
  await dispatch(-1, 2);
  await expect.poll(async () => Number(await page.locator('#zoom').inputValue())).toBeGreaterThan(0.5);
  expect(await page.locator('#viewport').evaluate(v => v.scrollLeft >= 0 && v.scrollTop >= 0 &&
    v.scrollLeft <= v.scrollWidth - v.clientWidth && v.scrollTop <= v.scrollHeight - v.clientHeight)).toBe(true);
});
