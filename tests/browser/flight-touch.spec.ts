import { test, expect, type Locator, type Page } from '@playwright/test';
import { readSaveText } from '../support/save-file';
import { readNativeSave } from '../../src/formats/native-save';
import { aircraftFixture } from '../support/aircraft';
import { browserCrops } from '../support/crop-catalog';
import { speedItem, expectNoHorizontalOverflow } from '../support/workspace';

/** On-screen flight controls on touch screens (native, user request; FlightOverlay.tsx). The flight starts from a paused
 * mid-flight checkpoint, so the terrain needs no mouse-driven takeoff. */
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'flight.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function saved(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return readSaveText((await (await pending).path())!);
}
const runtime = async (page: Page) => JSON.parse(await saved(page)).runtime;
function flyingSave() {
  const game = aircraftFixture().load().withAllCrops(browserCrops); game.dispatch({ type: 'buy-aircraft' });
  for (const kind of ['fuel', 'load'] as const) game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind } });
  game.dispatch({ type: 'start-flight', slot: 1, columns: 12, rows: 20 }); game.dispatch({ type: 'set-paused', paused: true });
  expect(game.getSnapshot().aircraftFlight).not.toBeNull();
  return game.save(4);
}
const button = (page: Page, name: string) => page.locator('#flight-overlay').getByRole('button', { name, exact: true });
const box = async (l: Locator) => (await l.boundingBox())!;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
/** Every button lies inside the terrain viewport, away from the readouts and the centred plane, and none overlap. */
async function expectClearLayout(page: Page) {
  const viewport = await box(page.locator('#viewport')), readouts = await box(page.locator('.flight-readouts'));
  const buttons = await Promise.all((await page.locator('.flight-button').all()).map(box));
  expect(buttons).toHaveLength(6);
  const plane = { x: viewport.x + viewport.width / 2 - 24, y: viewport.y + viewport.height / 2 - 24, width: 48, height: 48 };
  for (const [i, b] of buttons.entries()) {
    expect(b.x >= viewport.x && b.y >= viewport.y && b.x + b.width <= viewport.x + viewport.width && b.y + b.height <= viewport.y + viewport.height).toBe(true);
    expect(b.width).toBeGreaterThanOrEqual(44); expect(overlaps(b, readouts)).toBe(false); expect(overlaps(b, plane)).toBe(false);
    for (const other of buttons.slice(i + 1)) expect(overlaps(b, other)).toBe(false);
  }
  expect(readouts.x + readouts.width).toBeLessThanOrEqual(viewport.x + viewport.width);
  await expectNoHorizontalOverflow(page);
}

test.describe('touch flight controls', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test('taps queue single controls, a held button keeps turning, readouts follow the flight and End lands', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto('/'); await load(page, flyingSave());
    await expect(page.locator('#flight-overlay')).toBeVisible(); await expect(page.locator('.flight-keys')).toHaveCount(0);
    await expect(page.locator('#flight-altitude')).toHaveText('10'); await expect(page.locator('#flight-heading')).toHaveText('W');
    await expect(page.locator('#flight-fuel')).toHaveText('100%'); await expect(page.locator('#flight-payload')).toHaveText('Pesticide 100%');
    await expect(page.locator('#flight-landing')).toHaveText('lands at airport');
    await expectClearLayout(page);
    await page.screenshot({ path: 'artifacts/browser-flight-touch-portrait.png' });

    // 10px text, and no readout moves when another value's text changes width (W → NW, 9% → 100%, Spray → Spraying).
    await expect(page.locator('.flight-readouts')).toHaveCSS('font-size', '10px');
    const shifts = await page.locator('.flight-readouts').evaluate(list => {
      const values: Record<string, string[]> = { 'flight-altitude': ['1', '9', '10', '100'], 'flight-heading': ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
        'flight-fuel': ['0%', '9%', '55%', '100%'], 'flight-payload-label': ['Spray', 'Spraying'],
        'flight-payload': ['Empty', 'Pesticide 1%', 'Herbicide 100%', 'Fungicide 100%'], 'flight-damage': ['0%', '9%', '100%'] };
      const lefts = () => [...list.querySelectorAll('dt, dd')].map(e => e.getBoundingClientRect().left).join();
      const moved: string[] = [], base = lefts();
      for (const [id, texts] of Object.entries(values)) {
        const el = document.getElementById(id)!, original = el.textContent;
        for (const text of texts) { el.textContent = text; if (lefts() !== base) moved.push(`${id}=${text}`); }
        el.textContent = original;
      }
      return moved;
    });
    expect(shifts).toEqual([]);

    // Paused, taps only queue: one control per tap, and the buttons never take focus.
    await button(page, 'Climb').tap(); await button(page, 'Spray').tap();
    await expect(page.locator('.flight-button:focus')).toHaveCount(0);
    expect((await runtime(page)).aircraftFlight.inputs).toEqual(['climb', 'spray-toggle']);

    // Hold Turn left with a real touch while the flight runs: it repeats as each queued turn is consumed.
    const session = await page.context().newCDPSession(page), left = await box(button(page, 'Turn left'));
    const finger = { x: left.x + left.width / 2, y: left.y + left.height / 2 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
    await expect(button(page, 'Turn left')).toHaveCSS('color', 'rgb(0, 0, 0)'); // :active feedback while held
    await (await speedItem(page, '#play-pause')).click();
    await expect(page.locator('#flight-heading')).toHaveText('S', { timeout: 15000 }); // W → SW → S, counter-clockwise
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await (await speedItem(page, '#play-pause')).click();
    await expect(page.locator('#flight-altitude')).toHaveText('11'); await expect(button(page, 'Spray')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#flight-payload-label')).toHaveText('Spraying');
    const held = (await runtime(page)).aircraftFlight;
    expect(held.inputs.length).toBeLessThanOrEqual(1); // released: nothing piles up

    // Landscape phone keeps the same clear layout.
    await page.setViewportSize({ width: 844, height: 390 }); await expectClearLayout(page);
    await page.screenshot({ path: 'artifacts/browser-flight-touch-landscape.png' });

    // End is immediate; the outcome is the one the readout announced (the plane may have left the airport region).
    const announced = await page.locator('#flight-landing').textContent();
    await button(page, 'End flight').tap(); await (await speedItem(page, '#play-pause')).click();
    await expect(page.locator('#flight-overlay')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('.map-panel')).not.toHaveClass(/is-flying/);
    const after = readNativeSave(await saved(page)).state;
    expect(after.aircraftFlight).toBeNull(); expect(after.scenario.equipment[1].active).toBe(announced === 'lands at airport');
    expect(errors).toEqual([]);
  });
});
