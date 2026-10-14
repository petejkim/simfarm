import { test, expect, type Page } from '@playwright/test';
import { disasterFixture } from '../support/disasters';
import { browserCrops } from '../support/crop-catalog';
import { terrainPixels } from '../support/terrain-pixels';
import { toggleOption } from '../support/options-menu';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'render.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function observeDraws(page: Page) {
  await page.evaluate(() => {
    const state = { count: 0 }; Object.assign(window, { worldDraws: state });
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (this: CanvasRenderingContext2D, ...args: unknown[]) {
      if (this.canvas.id === 'world') state.count++;
      return (draw as (...args: unknown[]) => void).apply(this, args);
    } as typeof draw;
  });
}
const count = (page: Page) => page.evaluate(() => (window as unknown as { worldDraws: { count: number } }).worldDraws.count);

test.beforeEach(async ({ page }) => {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.addInitScript(() => localStorage.setItem('simfarm.options.v1', JSON.stringify({ music: false, sound: false })));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
});

test('unchanged terrain publishes draw nothing with no sprite, including nonvisual disaster flags', async ({ page }) => {
  const f = disasterFixture(); f.state.paused = true;
  const region = { x: 300, y: 300, width: 192, height: 192 };
  for (const flags of [0, 8, 64, 128]) {
    f.state.disasters.flags = flags;
    await load(page, f.load().withAllCrops(browserCrops).save(4));
    const before = await terrainPixels(page, region);
    await observeDraws(page); await toggleOption(page, 'AutoScroll');
    expect(await count(page), `flags ${flags}`).toBe(0);
    expect(await terrainPixels(page, region)).toEqual(before);
  }
});

test('moving disaster sprites retain full redraws and their last frame is erased when removed', async ({ page }) => {
  const f = disasterFixture(); f.state.paused = true;
  const clean = f.load().withAllCrops(browserCrops).save(4), region = { x: 320, y: 320, width: 64, height: 48 };
  await load(page, clean); const base = await terrainPixels(page, region);
  for (const [kind, flags] of [['tornado', 1], ['swarm', 32]] as const) {
    f.state.disasters.flags = flags;
    Object.assign(f.state.disasters[kind], { x: 20, y: 20, frame: 0 });
    if (kind === 'swarm') f.state.disasters.swarm.fieldSlot = 1;
    await load(page, f.load().withAllCrops(browserCrops).save(4));
    expect(await terrainPixels(page, region)).not.toEqual(base);
    await observeDraws(page); await toggleOption(page, 'AutoScroll');
    expect(await count(page)).toBeGreaterThanOrEqual(9216);
    await load(page, clean); expect(await terrainPixels(page, region)).toEqual(base);
    await observeDraws(page); await toggleOption(page, 'AutoScroll');
    expect(await count(page)).toBe(0);
  }
});
