import type { Page } from '@playwright/test';

/** Raw terrain pixels. The CSS tool border is verified separately through its DOM geometry/style;
 * it never modifies the canvas beneath it. */
export function terrainPixels(page: Page, r: { x: number; y: number; width: number; height: number }) {
  return page.locator('#world').evaluate((world: HTMLCanvasElement, r) => {
    const out = Object.assign(document.createElement('canvas'), { width: r.width, height: r.height }), context = out.getContext('2d')!;
    context.drawImage(world, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    return Array.from(context.getImageData(0, 0, r.width, r.height).data);
  }, r);
}
