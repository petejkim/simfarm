import {readSaveText} from '../support/save-file';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { GameSimulation } from '../support/game';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') }); await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readSaveText((await (await pending).path())!));
}
async function load(page: Page, name: string, buffer: Buffer) {
  await page.locator('#load-farm-file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}

test('a checkpoint at calendar equality advances on the next tick and native1x takes four seconds per full day', async ({ page }) => {
  await start(page);
  const world = readScenario(source('SCEN4.SSM'));
  const crops = world.cropFiles.map(file => readCrop(file.slice(0, -4), source('CROPS/' + file.toUpperCase())));
  const game = new GameSimulation(world, crops).withAllCrops(browserCrops), checkpoint = JSON.parse(game.save(4));
  checkpoint.scenario.farm.dayDelayTicks = 64; checkpoint.scenario.farm.timerTicks = 500; checkpoint.scenario.farm.animationTicks = 600;
  checkpoint.runtime.dayTicks = 64;
  await load(page, 'equal.json', Buffer.from(JSON.stringify(checkpoint))); expect(await save(page)).toEqual(checkpoint);
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  const next = await save(page); expect(next.runtime.daysAdvanced).toBe(checkpoint.runtime.daysAdvanced + 1);
  expect(next.runtime.dayTicks).toBe(0); expect(next.scenario.farm.timerTicks).toBe(501); expect(next.scenario.farm.animationTicks).toBe(601);
  await load(page, 'next.json', Buffer.from(JSON.stringify(next))); expect(await save(page)).toEqual(next);
  await expect(page.locator('#simulation-speed-value')).toHaveAttribute('title', 'At 1×, one full game day takes four real seconds.');
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await page.clock.runFor(3000);
  expect((await save(page)).runtime.daysAdvanced).toBe(next.runtime.daysAdvanced);
  await page.clock.runFor(1400); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  expect((await save(page)).runtime.daysAdvanced).toBe(next.runtime.daysAdvanced + 1);
  await expect(page.locator('#calendar-delay-status')).toHaveCount(0);
});

test('maximum original delay is explained on mobile, blocks Next day and retains running clocks without advancing the date', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 }); await start(page);
  const input = Buffer.from(source('SCEN4.SSM')); input.writeUInt16LE(65535, 0x2171a); input[0x21719] = 0;
  await load(page, 'maximum.SSM', input);
  await expect(page.locator('#next-day')).toBeDisabled();
  await expect(page.locator('#calendar-delay-status')).toHaveText('This save cannot advance the calendar. Load a different save or start a new farm.');
  const before = await save(page); expect(before.scenario.farm.dayDelayTicks).toBe(65535);
  await reveal(page, '#calendar-delay-status'); await page.locator('#calendar-delay-status').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-calendar-maximum-mobile.png', fullPage: false });
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await page.clock.runFor(200); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  const after = await save(page); expect(after.runtime.daysAdvanced).toBe(before.runtime.daysAdvanced);
  expect(after.scenario.farm.calendar).toEqual(before.scenario.farm.calendar);
  expect(after.scenario.farm.animationTicks).not.toBe(before.scenario.farm.animationTicks);
  await load(page, 'maximum.json', Buffer.from(JSON.stringify(after))); expect(await save(page)).toEqual(after);
  await expect(page.locator('#next-day')).toBeDisabled();
  await load(page, 'normal.SSM', source('SCEN4.SSM'));
  await expect(page.locator('#calendar-delay-status')).toHaveCount(0); await expect(page.locator('#next-day')).toBeEnabled();
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); expect((await save(page)).runtime.daysAdvanced).toBe(after.runtime.daysAdvanced + 1);
});
