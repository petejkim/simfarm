import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readSaveText } from '../support/save-file';
import { newGame, reveal } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { newFarmAssets } from '../support/new-farm';
import { GameSimulation } from '../../src/simulation/game';
import { readArchive } from '../../src/formats/archive';
import { readSetupMap } from '../../src/formats/new-farm';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const region = readSetupMap(readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')).find(e => e.name === 'scenario.odt')!.bytes).locations[13 * 18 + 8];

// No startup override and no saved game: the real first start.
test.use({ storageState: { cookies: [], origins: [] } });

async function saveToFile(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}

test('a first start without saved data generates a random farm in Region 9, 14 and keeps it across reloads', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2031-06-10T12:00:00Z') }); await page.clock.pauseAt(new Date('2031-06-10T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  // First launch opens New Game over the generated farm, which keeps starting behind it; Cancel keeps that farm.
  const setup = page.getByRole('region', { name: 'New farm', exact: true });
  await expect(setup).toBeVisible(); await reveal(page, '#region-map');
  await expect(page.locator('[data-region="8,13"]')).toHaveAttribute('aria-pressed', 'true');
  await setup.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(setup).toHaveCount(0);
  const first = await saveToFile(page), options = first.runtime.newFarm.provenance.options;
  expect(options.climate).toEqual({ precipitation: region.precipitation, temperature: region.temperature, wind: region.wind });
  expect([options.river, options.lake, options.date.year]).toEqual([true, false, 2031]);
  expect(options.seeds.simulation).toBeGreaterThan(0);
  // Exactly what New Game → Use This Region creates with these options.
  expect(first).toEqual(JSON.parse(GameSimulation.createGeographic(options, newFarmAssets, 'selected-climate').withAllCrops(browserCrops).save(null)));
  // Saved immediately: a reload restores the same farm instead of generating another one.
  await page.reload(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('#save-status')).toHaveText('Saved farm restored (paused).');
  await expect(setup).toHaveCount(0); // only the first launch
  expect(await saveToFile(page)).toEqual({ ...first, runtime: { ...first.runtime, paused: true } });
  // New Game opens on the same default region.
  await newGame(page); await reveal(page, '#region-map');
  await expect(page.locator('[data-region="8,13"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-region="8,13"]')).toHaveAccessibleName('Region 9, 14');
  expect(errors).toEqual([]);
});

test('first-launch New Game does not reopen on refresh when another tab holds the save slot', async ({ context, page }) => {
  // Another same-origin tab owns the single-writer lock, so the generated farm is never stored.
  const other = await context.newPage(); await other.goto('/assets/manifest.json');
  await other.evaluate(() => new Promise<void>(held => { void navigator.locks.request('simfarm-current-game', () => { held(); return new Promise<void>(() => {}); }); }));
  const setup = page.getByRole('region', { name: 'New farm', exact: true });
  await page.goto('/'); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain'); await expect(setup).toBeVisible();
  await page.reload(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('#save-status')).not.toHaveText('Saved farm restored (paused).'); // nothing was stored
  await page.waitForTimeout(500); await expect(setup).toHaveCount(0);
});

/** The IndexedDB current-game record text, read in the page. */
function storedText(page: Page) {
  return page.evaluate(() => new Promise<string | null>(resolve => {
    const open = indexedDB.open('simfarm', 1);
    open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('games')) open.result.createObjectStore('games'); };
    open.onsuccess = () => { const get = open.result.transaction('games').objectStore('games').get('current'); get.onsuccess = () => { resolve(get.result?.text ?? null); open.result.close(); }; };
  }));
}

test('a stored farm that cannot be restored is never replaced by a newly generated one', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect.poll(() => storedText(page)).not.toBeNull();
  const kept = await storedText(page);
  // Missing assets leave the record in place: startup must not generate and immediately save over it.
  // Fail only the restore's first request; later loads succeed, so a regression that generated a new
  // farm here would succeed and overwrite the record.
  let failed = false;
  await page.route('**/assets/raw/crops/apples.crp', route => { if (failed) return route.continue(); failed = true; return route.fulfill({ status: 404, body: '' }); });
  await page.reload(); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await expect(page.getByText(/Saved farm could not be restored/).first()).toBeVisible();
  await page.waitForTimeout(500); expect(await storedText(page)).toBe(kept);
});
