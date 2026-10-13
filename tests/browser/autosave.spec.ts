import { test, expect, type Page } from '@playwright/test';
import { readSaveText } from '../support/save-file';
import { newGame, reveal , speedItem } from '../support/workspace';
import { shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';

async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function command(page: Page, name: string) {
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name, exact: true }).click();
}
async function saveToFile(page: Page) {
  const pending = page.waitForEvent('download'); await command(page, 'Save to File...');
  return JSON.parse(readSaveText((await (await pending).path())!));
}
/** The IndexedDB current-game record, read in the page. */
function stored(page: Page, key = 'current') {
  return page.evaluate(key => new Promise<{ version: number; savedAt: number; text: string } | null>(resolve => {
    const open = indexedDB.open('simfarm', 1);
    open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains('games')) open.result.createObjectStore('games'); };
    open.onsuccess = () => { const get = open.result.transaction('games').objectStore('games').get(key); get.onsuccess = () => { resolve(get.result ?? null); open.result.close(); }; };
  }), key);
}
async function nextDay(page: Page) { await (await speedItem(page,'#next-day')).click(); }

test('File menu offers Save, Save to File... and Load from File... without Quit; Save stores the game and reopening restores it paused', async ({ page }) => {
  await start(page);
  await page.locator('#file-menu-button').click();
  expect(await page.getByRole('menu', { name: 'File' }).getByRole('menuitem').allTextContents()).toEqual(['About SimFarm', 'New Game', 'Save', 'Save to File...', 'Load from File...']);
  await page.keyboard.press('Escape');
  expect(await stored(page)).toBeNull(); // a fresh browser starts Scenario 1 without saving
  await nextDay(page);
  await command(page, 'Save'); await expect(page.locator('#save-status')).toHaveText('Farm saved.');
  const record = (await stored(page))!; expect(record.version).toBe(1);
  const before = await saveToFile(page), date = await page.locator('#farm-date').textContent();
  expect(JSON.parse(record.text)).toEqual(before);
  await page.reload();
  await expect(page.locator('#save-status')).toHaveText('Saved farm restored (paused).');
  await expect(page.locator('#farm-date')).toHaveText(date!); await expect(page.locator('#time-status')).toContainText('Paused');
  expect(await saveToFile(page)).toEqual({ ...before, runtime: { ...before.runtime, paused: true, elapsed: 0 } });
});

test('the calendar week rollover saves automatically', async ({ page }) => {
  await start(page);
  let date = '';
  for (let day = 0; day < 7 && !(await stored(page)); day++) { await nextDay(page); date = (await page.locator('#farm-date').textContent())!; }
  const record = await stored(page); expect(record).not.toBeNull();
  const calendar = JSON.parse(record!.text).scenario.farm.calendar; expect(calendar.day).toBe(0); // saved on the first day of a week
  await page.reload(); await expect(page.locator('#farm-date')).toHaveText(date);
});

test('New Game and Load from File are saved as soon as they start', async ({ page }) => {
  await start(page);
  await newGame(page); await page.locator('#new-farm-seed').fill('9029'); await reveal(page, '#region-design'); await page.locator('#region-design').click();
  await reveal(page, '#play-farm'); await page.locator('#play-farm').click(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect.poll(async () => JSON.parse((await stored(page))?.text ?? 'null')?.scenario?.origin).toBe('generated');
  await page.reload(); await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  const fixture = shopFixture(); fixture.state.scenario.farm.cash = 12345; const text = fixture.load().withAllCrops(browserCrops).save(4);
  await page.locator('#load-farm-file').setInputFiles({ name: 'farm.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await expect.poll(async () => JSON.parse((await stored(page))?.text ?? 'null')?.scenario?.farm?.cash).toBe(12345);
  await page.reload(); await expect(page.locator('#farm-cash')).toHaveText('$12,345');
});

test('hiding the tab flushes unsaved progress', async ({ page }) => {
  await start(page); await nextDay(page); const date = await page.locator('#farm-date').textContent();
  expect(await stored(page)).toBeNull();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => Boolean(await stored(page))).toBe(true);
  await page.reload(); await expect(page.locator('#farm-date')).toHaveText(date!);
});

test('an unreadable stored game falls back to Scenario 1 and is kept aside', async ({ page }) => {
  await start(page);
  await page.evaluate(() => new Promise<void>(resolve => {
    const open = indexedDB.open('simfarm', 1);
    open.onsuccess = () => { const t = open.result.transaction('games', 'readwrite'); t.objectStore('games').put({ version: 1, savedAt: 0, text: '{' }, 'current'); t.oncomplete = () => { open.result.close(); resolve(); }; };
  }));
  await page.reload(); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await expect(page.locator('#save-status')).toContainText('could not be restored');
  expect(await stored(page)).toBeNull(); expect((await stored(page, 'rejected'))?.text).toBe('{');
});

test('only one tab writes the stored game; another takes over when it closes', async ({ page, context }) => {
  await start(page);
  const second = await context.newPage(); await second.goto('/'); await expect(second.locator('#map-status')).toContainText('Scenario 1');
  await command(second, 'Save'); await expect(second.locator('#save-status')).toHaveText('Another SimFarm tab is saving this farm.');
  await page.close();
  await expect.poll(async () => { await command(second, 'Save'); return second.locator('#save-status').textContent(); }).toBe('Farm saved.');
});

test('Save to File... and Load from File... use the file pickers where available', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__pickerMode = 'save';
    w.showSaveFilePicker = async (options: { suggestedName: string }) => {
      if (w.__pickerMode === 'cancel') throw new DOMException('cancelled', 'AbortError');
      w.__suggested = options.suggestedName;
      return { createWritable: async () => ({ write: async (blob: Blob) => { w.__saved = new Uint8Array(await blob.arrayBuffer()); }, close: async () => {} }) };
    };
    w.showOpenFilePicker = async () => [{ getFile: async () => new File([w.__saved as BlobPart], 'picked.simfarm.json.gz') }];
  });
  await start(page); await nextDay(page);
  await command(page, 'Save to File...'); await expect(page.locator('#save-status')).toHaveText('Farm saved to file.');
  const saved = await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>, bytes = w.__saved as Uint8Array;
    const text = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    return { gzip: bytes[0] === 0x1f && bytes[1] === 0x8b, name: w.__suggested as string, date: JSON.parse(text).scenario.farm.calendar };
  });
  expect(saved.gzip).toBe(true); expect(saved.name).toMatch(/^simfarm-1-\d+-\d+-\d+\.simfarm\.json\.gz$/);
  const date = await page.locator('#farm-date').textContent();
  await nextDay(page); await command(page, 'Load from File...');
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await expect(page.locator('#farm-date')).toHaveText(date!);
  await page.evaluate(() => { (window as unknown as Record<string, unknown>).__pickerMode = 'cancel'; });
  await command(page, 'Save to File...'); await expect(page.locator('#save-status')).toHaveText('Save to file cancelled.');
  await expect(page.getByRole('dialog', { name: 'File error' })).toHaveCount(0);
});
