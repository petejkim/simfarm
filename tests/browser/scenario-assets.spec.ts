import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { createHash } from 'node:crypto';

test('runtime title and terrain screens retain source pixels and original chooser metadata', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  for (const [name, hash] of [
    ['sftitle', '32269cf18061fa1d62f8bd9197da0347e8ce23f4210ec4abf0e83ae3ab36d349'],
    ['defworld', '6ed5cbf89537cd4b49fc1c53067485901c807157bde2fae5a7ea9f2fac35636a'],
  ]) {
    const response = await page.request.get(`/assets/${name}.png`); expect(response.ok()).toBe(true);
    const png = PNG.sync.read(await response.body()); expect([png.width, png.height]).toEqual([640, 480]);
    expect(createHash('sha256').update(png.data).digest('hex')).toBe(hash);
  }
  // Unused screen exports are gone; their raw scanline hashes remain pinned in scenario-chooser.test.ts.
  const response = await page.request.get('/assets/new-farm-setup.json'), setup = await response.json();
  expect(setup.farms.map((f: { id: number; x: number; y: number }) => [f.id, f.x, f.y])).toEqual([
    [0,0,8],[1,1,11],[2,1,3],[3,3,6],[4,9,7],[5,11,6],[6,13,11],[7,15,8],
  ]);
  expect(setup.initialLocation).toEqual({ x: 2, y: 8 }); expect(setup.locations).toHaveLength(324);
});
