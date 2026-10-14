import { expect, type Page } from '@playwright/test';

/** Read the CSS highlight in world tiles, independent of the app's percentage calculations and screen zoom. */
export function previewFootprint(page: Page) {
  return page.locator('#world-preview').evaluate(el => {
    const world = document.querySelector<HTMLCanvasElement>('#world')!, base = world.getBoundingClientRect(), border = el.getBoundingClientRect();
    // Browser layout quantizes positions to subpixels, including the mobile1.2× zoom.
    const tile = base.width / world.width * 16, round = (n: number) => Math.round(n * 100) / 100;
    return [round((border.x - base.x) / tile), round((border.y - base.y) / tile), round(border.width / tile), round(border.height / tile)];
  });
}
export async function expectPreview(page: Page, footprint: { x: number; y: number; width: number; height: number }) {
  const border = page.locator('#world-preview');
  await expect(border).toHaveJSProperty('tagName', 'DIV');
  await expect(border).toHaveCSS('pointer-events', 'none');
  await expect(border).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  for (const side of ['top', 'right', 'bottom', 'left']) {
    await expect(border).toHaveCSS(`border-${side}-width`, '2px');
    await expect(border).toHaveCSS(`border-${side}-color`, 'rgb(154, 196, 224)');
  }
  await expect.poll(() => previewFootprint(page)).toEqual([footprint.x, footprint.y, footprint.width, footprint.height]);
}
