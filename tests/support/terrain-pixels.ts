import type { Page } from '@playwright/test';

/** World-pixel RGBA of a terrain region as shown: the #world canvas with the tool-highlight overlay
 * (#world-preview, placed in percent of the 1536px world) composited on top. */
export function terrainPixels(page: Page, r: { x: number; y: number; width: number; height: number }) {
  return page.locator('#world').evaluate((world: HTMLCanvasElement, r) => {
    const out = Object.assign(document.createElement('canvas'), { width: r.width, height: r.height }), context = out.getContext('2d')!;
    context.drawImage(world, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height);
    const overlay = document.querySelector<HTMLCanvasElement>('#world-preview');
    if (overlay && !overlay.hidden) {
      const at = (value: string) => Math.round(parseFloat(value) / 100 * world.width);
      context.drawImage(overlay, at(overlay.style.left) - r.x, at(overlay.style.top) - r.y);
    }
    return Array.from(context.getImageData(0, 0, r.width, r.height).data);
  }, r);
}
