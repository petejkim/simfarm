import {readSaveText} from '../support/save-file';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { livestockFixture, shopFixture } from '../support/livestock';
import { browserCrops } from '../support/crop-catalog';
import { GameSimulation } from '../support/game';
import { reveal , speedItem } from '../support/workspace';
import { townEventMessage } from '../../src/ui/town-event-message';

function fixture(month: number, animal = false) {
  const f = animal ? livestockFixture(1) : shopFixture();
  f.state.scenario.farm.dayDelayTicks = 0;
  Object.assign(f.state.scenario.farm.calendar, { day: 6, week: 3, month });
  f.state.scenario.farm.messages = true;
  f.state.finances.town.recreationCount = 1; f.state.finances.town.recreationCoordinates.set([72, 72]);
  f.state.disasters.enabled = false;
  return f;
}
async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-01-01') }); await page.clock.pauseAt(new Date('1993-01-01'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  // Startup amain has priority until it begins (user policy); event music requested earlier is ignored.
  // Start music with a gesture and wait, so the first event's track request is not raced by startup.
  await page.keyboard.press('Shift'); await expect(page.locator('#audio-status')).toContainText('Playing amain');
}
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'event.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const download = page.waitForEvent('download'); await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  return JSON.parse(readSaveText((await (await download).path())!));
}
async function checkMessage(page: Page, game: InstanceType<typeof GameSimulation>) {
  const state = game.getSnapshot().townEvent, model = townEventMessage(state, readFileSync('artifacts/original-assets/events.dat'))!;
  const win = page.locator('[data-window=town-event-message]');
  await expect(win).toBeVisible(); await expect(win.locator('[data-town-event]')).toHaveAttribute('data-town-event', state.pending!.kind);
  await expect(page.locator('#town-event-message-text')).toHaveText(model.text);
  expect(await win.evaluate(el => el.matches(':modal'))).toBe(true);
  expect(await page.locator('#town-event-message-text').evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
  expect(await win.locator('.message-portrait').evaluate(el => (el as HTMLElement).style.backgroundPosition))
    .toBe(`${-(model.portrait % 8) * 112}px ${-Math.floor(model.portrait / 8) * 64}px`);
  for (const [i, button] of model.buttons.entries()) await expect(page.locator(`#town-event-${i}`)).toHaveText(button.caption);
  // The modal message makes the Speed menu unreachable; the pause launcher shares its blocked condition.
  await expect(page.locator('#toolbar-pause')).toBeDisabled();
  return win;
}

test('calendar fair and rodeo entries use original modal choices, select MIDI and charge exactly once', async ({ page }) => {
  await start(page); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  // Startup has priority while the worklet and first MIDI are still loading.
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing amain');await page.keyboard.press('Escape');
  for (const [month, animal] of [[5, false], [8, true], [8, false]] as const) {
    const game = fixture(month, animal).load().withAllCrops(browserCrops); await load(page, game.save(4));
    await (await speedItem(page,'#next-day')).click(); game.dispatch({ type: 'advance-day' });
    const win = await checkMessage(page, game);
    await expect(page.locator('#audio-status')).toContainText(`Playing ${month === 5 ? 'rodeo' : 'carnival'}`);
    const date = await page.locator('#farm-date').textContent(); await page.clock.runFor(8000);
    await expect(page.locator('#farm-date')).toHaveText(date!);
    if (animal) await page.screenshot({ path: 'artifacts/browser-fair-entry.png' });
    await page.locator('#town-event-0').click(); game.dispatch({ type: 'resolve-town-event', accept: true });
    await expect(win).toHaveCount(0); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  expect(errors).toEqual([]);
});

test('loading a pending entry restores its choice; Escape declines without charging or replaying event music', async ({ page }) => {
  await start(page);
  const game = fixture(5).load().withAllCrops(browserCrops); game.dispatch({ type: 'advance-day' });
  await load(page, game.save(4)); await checkMessage(page, game);
  await page.keyboard.press('Escape'); game.dispatch({ type: 'resolve-town-event', accept: false });
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await expect(page.locator('#audio-status')).not.toContainText('rodeo');
  expect(game.getSnapshot().townEvent.participation).toBe(0);
});

test('saved fair and rodeo results show both outcomes and pay/clean up only on acknowledgement', async ({ page }) => {
  await start(page);
  for (const mode of [1, 2] as const) {
    for (const won of [false, true]) {
      let game: ReturnType<GameSimulation['withAllCrops']> | null = null;
      for (let seed = 1; seed <= 16; seed++) {
        const f = fixture(9); f.state.scenario.farm.calendar.week = 0;
        Object.assign(f.state.townEvent, { mode, artworkMode: mode, weeksRemaining: 1, participation: mode === 1 ? 1000 : 1, animalType: 2 });
        f.state.random.simulation = seed;
        const candidate = f.load().withAllCrops(browserCrops); candidate.dispatch({ type: 'advance-day' });
        const result = candidate.getSnapshot().townEvent.pending;
        if (result && 'won' in result && result.won === won) { game = candidate; break; }
      }
      expect(game).not.toBeNull();
      await load(page, game!.save(4)); await checkMessage(page, game!);
      await expect(page.locator('#farm-cash')).toHaveText('$100,000');
      if (mode === 1 && !won) {
        await expect(page.locator('#town-event-0')).toHaveText('RATS');
        await page.screenshot({ path: 'artifacts/browser-rodeo-loss.png' });
      }
      await page.locator('#town-event-0').click(); game!.dispatch({ type: 'resolve-town-event', accept: true });
      expect(await save(page)).toEqual(JSON.parse(game!.save(4)));
      await expect(page.locator('#farm-cash')).toHaveText(won ? '$101,000' : '$100,000');
    }
  }
});
