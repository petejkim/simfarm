import { test, expect, type Page } from '@playwright/test';
import { readSaveText } from '../support/save-file';
import { aircraftFixture } from '../support/aircraft';
import { browserCrops } from '../support/crop-catalog';
import { expectPaletteAction, reveal } from '../support/workspace';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'hotkeys.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}
const KEYS = [['M', 'Move object', 'Move object'], ['E', 'View object', 'Examine object'], ['R', 'Paved road', 'Paved road'],
  ['D', 'Dirt road', 'Dirt road'], ['F', 'Fence', 'Fence'], ['G', 'Gate', 'Gate'], ['I', 'Ditch', 'Ditch'], ['V', 'Valve', 'Valve'],
  ['L', 'Hay', 'Hay'], ['W', 'Trough', 'Trough'], ['T', 'Trees', 'Trees'], ['B', 'Bulldoze', 'Bulldoze']] as const;

test('tool hotkeys select every palette tool case-insensitively and tooltips name their keys', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const palette = page.getByRole('toolbar', { name: 'Edit tools' });
  for (const [key, name, title] of KEYS) {
    await expect(palette.getByRole('button', { name, exact: true })).toHaveAttribute('title', `${title} (${key})`);
    await reveal(page, '#viewport'); await page.keyboard.press(key.toLowerCase()); await expectPaletteAction(page, name);
    await page.keyboard.press('Escape'); await page.keyboard.press(`Shift+${key}`); await expectPaletteAction(page, name);
    await page.keyboard.press('Escape');
  }
  // Keys typed into form controls, modified keys and open menus keep their own meaning.
  await page.keyboard.press('e'); await expectPaletteAction(page, 'View object');
  await page.keyboard.press('Control+r'); await page.keyboard.press('Meta+b'); await expectPaletteAction(page, 'View object');
  await page.locator('#options-menu-button').click(); await page.keyboard.press('f'); await expectPaletteAction(page, 'View object');
  await page.keyboard.press('Escape');
  await reveal(page, '#zoom'); await page.locator('#zoom').focus(); await page.keyboard.press('t'); await expectPaletteAction(page, 'View object');
});

test('tool hotkeys do nothing while an aircraft is flying', async ({ page }) => {
  const f = aircraftFixture(), game = f.load().withAllCrops(browserCrops); game.dispatch({ type: 'buy-aircraft' });
  for (const kind of ['fuel', 'load'] as const) game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind } });
  game.dispatch({ type: 'start-flight', slot: 1, columns: 20, rows: 16 }); expect(game.getSnapshot().aircraftFlight).not.toBeNull();
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/'); await load(page, game.save(4)); await expect(page.locator('.map-panel')).toHaveClass(/is-flying/);
  const before = await save(page);
  for (const [key] of KEYS) { await page.keyboard.press(key.toLowerCase()); await page.keyboard.press(`Shift+${key}`); }
  // Some letters are original flight controls and queue flight inputs; nothing else, such as a tool status, changes.
  const after = await save(page); after.runtime.aircraftFlight.inputs = before.runtime.aircraftFlight.inputs;
  await expectPaletteAction(page, 'View object'); expect(after).toEqual(before);
});
