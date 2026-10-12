import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import { aircraftCatalog } from '../support/aircraft-browser';
import { reveal, openWindow, expectFarmCash } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { aircraftFixture } from '../support/aircraft';
import { GameSimulation } from '../support/game';
import { readNativeSave, writeNativeSave } from '../../src/formats/native-save';
import { readArchive } from '../../src/formats/archive';
import { readPalette } from '../../src/formats/graphics';
import { readSprite } from '../../src/formats/sprite';
import type { AircraftFlight, FlightControl } from '../../src/simulation/aircraft-flight';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'flight.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  const path = 'artifacts/browser-flight.simfarm.json'; await (await pending).saveAs(path);
  return JSON.parse(readSaveText(path));
}
function prepared() {
  const f = aircraftFixture(), game = f.load().withAllCrops(browserCrops); game.dispatch({ type: 'buy-aircraft' });
  for (const kind of ['fuel', 'load'] as const) game.dispatch({ type: 'service-aircraft', slot: 1, action: { kind } });
  return { ...f, game };
}
async function freeze(page: Page) {
  await page.clock.install(); await page.clock.pauseAt(new Date(Date.now() + 1000));
}
async function launch(page: Page, game: ReturnType<typeof prepared>['game']) {
  await openWindow(page, 'aircraft');
  const dimensions = await page.locator('#viewport').evaluate(v => {
    const z = Number((document.querySelector('#zoom') as HTMLSelectElement).value);
    const cells = (p: number) => Math.max(8, Math.min(80, Math.floor(p / (16 * z))));
    return { columns: cells(v.clientWidth), rows: cells(v.clientHeight) };
  });
  await reveal(page, '#fly-aircraft'); await page.locator('#fly-aircraft').click(); game.dispatch({ type: 'start-flight', slot: 1, ...dimensions });
  await expect(page.locator('.map-panel')).toHaveClass(/is-flying/);
  await expect(page.locator('#flight-controls')).toHaveCount(0); // no interim flight panel
  await pause(page, game);
}
/** Pause/resume through the ordinary Speed controls (no flight panel), mirrored in the expected game. */
async function pause(page: Page, game: ReturnType<typeof prepared>['game']) {
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); game.dispatch({ type: 'set-paused', paused: !game.getSnapshot().paused });
}
/** Flight keys work from anywhere: S/W altitude, A/D turn, E end, Space spray. */
const KEYS: Partial<Record<FlightControl, string>> = { climb: 'KeyS', descend: 'KeyW', left: 'KeyA', right: 'KeyD', end: 'KeyE', 'spray-toggle': 'Space' };
async function press(page: Page, game: ReturnType<typeof prepared>['game'], control: FlightControl) {
  await page.keyboard.press(KEYS[control]!); game.dispatch({ type: 'flight-control', control });
}
/** Fly for a while on the frozen clock (fixture: 16 ticks/day, so at 0.5× one tick is 500 ms and a flight step ~1 s). Each mocked frame gives the page loop exactly 16 ms, so the
 * expected game replays the same frames; it is paused again unless the flight ended (restoring pause). */
async function fly(page: Page, game: ReturnType<typeof prepared>['game'], ms: number) {
  // While still paused, let one frame pass so the page loop has a previous frame (its first frame counts no time).
  await page.clock.runFor(16);
  await pause(page, game);
  await page.evaluate(() => { const w = window as unknown as { __frames: number; __count?: boolean }; w.__frames = 0;
    if (!w.__count) { w.__count = true; const c = () => { w.__frames++; requestAnimationFrame(c); }; requestAnimationFrame(c); } });
  await page.clock.runFor(ms);
  const frames = await page.evaluate(() => (window as unknown as { __frames: number }).__frames);
  for (let i = 0; i < frames; i++) game.tick(16);
  if (!game.getSnapshot().paused) await pause(page, game);
}
async function spritesMatch(page: Page, f: AircraftFlight) {
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => entries.find(e => e.name === n)!.bytes;
  const palette = readPalette(asset('simfarm.pal')), direction = (f.heading + f.spin) & 7;
  // Independent source formulas include half-tile centres for odd viewport dimensions.
  const x = f.cameraX * 16 + f.columns * 8 + f.offsetX * 16, y = f.cameraY * 16 + f.rows * 8 + f.offsetY * 16;
  // Native order: shadow beneath the airplane, then dust (later layers overwrite earlier pixels).
  const layers: [string, number, number, number][] = [['apshadow.spr', direction, x - 2 * f.altitude, y + 2 * f.altitude], ['airplane.spr', direction, x, y]];
  if (f.spraying) layers.push(['cropdust.spr', direction & 1, x + [0, -24, -24, -24, 0, 24, 24, 24][direction], y + [24, 24, 0, -24, -24, -24, 0, 24][direction]]);
  const pixels = new Map<number, number[]>();
  for (const [name, frame, left, top] of layers) {
    const rgba = readSprite(asset(name), palette).frames[frame].rgba;
    for (let i = 0; i < 1024; i++) if (rgba[i * 4 + 3]) {
      const px = left + i % 32, py = top + Math.floor(i / 32);
      if (px >= 0 && px < 1536 && py >= 0 && py < 1536) pixels.set(py * 1536 + px, Array.from(rgba.subarray(i * 4, i * 4 + 4)));
    }
  }
  // The map repaints after React commits the new snapshot; wait for that frame.
  await expect.poll(() => page.locator('#world').evaluate((c: HTMLCanvasElement, points) => {
    const rgba = c.getContext('2d')!.getImageData(0, 0, 1536, 1536).data;
    return points.map(p => Array.from(rgba.subarray(p * 4, p * 4 + 4)));
  }, [...pixels.keys()])).toEqual([...pixels.values()]);
}

test('Fly captures the map, original sprites follow keyboard steering, pause/step and resize preserve the flight, and End lands at the airport', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await freeze(page); await page.goto('/');
  const { game } = prepared(); await load(page, game.save(4)); await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('2'); await launch(page, game);
  await expect(page.locator('#next-day')).toBeDisabled();
  await spritesMatch(page, game.getSnapshot().aircraftFlight!);
  await press(page, game, 'spray-toggle'); await press(page, game, 'right'); await press(page, game, 'climb'); await fly(page, game, 4000);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await spritesMatch(page, game.getSnapshot().aircraftFlight!);
  const flown = game.getSnapshot().aircraftFlight!; expect([flown.heading, flown.altitude, flown.spraying]).toEqual([7, 11, true]);
  await page.setViewportSize({ width: 1280, height: 844 });
  await expect.poll(() => page.locator('#viewport').evaluate((v, f) => {
    const canvas = document.querySelector('#world')!.getBoundingClientRect(), bounds = v.getBoundingClientRect();
    const x = canvas.left + ((f.cameraX + f.columns / 2 + f.offsetX) * 16 + 16) * 2;
    const y = canvas.top + ((f.cameraY + f.rows / 2 + f.offsetY) * 16 + 16) * 2;
    return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;
  }, game.getSnapshot().aircraftFlight!)).toBe(true);
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('1');
  await spritesMatch(page, game.getSnapshot().aircraftFlight!); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-flight.png', fullPage: true });
  await press(page, game, 'end'); await fly(page, game, 2000); expect(game.getSnapshot().lastFlightEnd?.kind).toBe('landed');
  await expect(page.locator('.map-panel')).not.toHaveClass(/is-flying/); await expect(page.locator('#flight-result')).toHaveCount(0); // no result screen
  await reveal(page, '#next-day'); await expect(page.locator('#next-day')).toBeEnabled();
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('held flight keys queue one control at a time and Space never presses the focused button', async ({ page }) => {
  await freeze(page); await page.goto('/'); const { game } = prepared(); await load(page, game.save(4)); await launch(page, game);
  // #play-pause keeps focus after pausing; Space must only toggle spraying, not resume the game.
  await expect(page.locator('#play-pause')).toBeFocused(); await page.keyboard.press('Space');
  await expect(page.locator('#time-status')).toContainText('Paused');
  expect((await save(page)).runtime.aircraftFlight.inputs).toEqual(['spray-toggle']);
  await press(page, game, 'spray-toggle'); // undo, then hold a turn key
  // Browser auto-repeat (repeated keydown) and the hold timer add nothing while the last control is unconsumed.
  for (let i = 0; i < 20; i++) await page.keyboard.down('KeyA');
  await page.clock.runFor(1000); await page.keyboard.up('KeyA');
  expect((await save(page)).runtime.aircraftFlight.inputs).toEqual(['spray-toggle', 'spray-toggle', 'left']);  // While flying, a held key keeps turning as each queued turn is consumed.
  const before = (await save(page)).runtime.aircraftFlight.heading;
  await page.keyboard.down('KeyA'); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await page.clock.runFor(8000); await page.locator('#play-pause').click(); await page.keyboard.up('KeyA');
  const turned = ((before - (await save(page)).runtime.aircraftFlight.heading) + 8) % 8;
  expect(turned).toBeGreaterThanOrEqual(2);
});

test('browser spraying changes actual crop bytes, mid-flight save/load resumes queued inputs, and ending outside an airport loses the plane', async ({ page }) => {
  await freeze(page); await page.goto('/'); const f = prepared(), state = readNativeSave(f.game.save(4)).state, field = state.scenario.fields[1];
  field.bytes.fill(0); field.bytes[7] = 1; field.bytes[10] = 8; field.bytes[11] = 16; field.bytes[12] = 8; field.bytes[13] = 8;
  field.bytes[20] = 100; field.bytes[32] = 10; field.bytes[60] = 101;
  const game = GameSimulation.load(writeNativeSave(state, 4), browserCrops).simulation.withAllCrops(browserCrops);
  await load(page, game.save(4)); await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('2'); await launch(page, game);
  await press(page, game, 'spray-toggle'); await fly(page, game, 9000);
  // Spraying over the field removed its pests and added toxicity (expected values come from the mirrored game).
  expect(game.getSnapshot().scenario.fields[1].bytes[20]).toBeLessThan(100); expect(game.getSnapshot().scenario.fields[1].bytes[32]).toBeGreaterThan(10);
  await press(page, game, 'right');
  const checkpoint = await save(page); expect(checkpoint).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, JSON.stringify(checkpoint));
  await expect(page.locator('#time-status')).toContainText('Paused'); expect(game.getSnapshot().aircraftFlight?.inputs).toEqual(['right']);
  await fly(page, game, 2000); await spritesMatch(page, game.getSnapshot().aircraftFlight!);
  await press(page, game, 'end'); await fly(page, game, 2000); expect(game.getSnapshot().lastFlightEnd?.kind).toBe('crashed');
  await expect(page.locator('#flight-result')).toHaveCount(0);
  expect(game.getSnapshot().scenario.equipment[1].active).toBe(false); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await aircraftCatalog(page); await page.locator('#catalog-buy').click(); game.dispatch({type:'buy-aircraft'});
  await expectFarmCash(page,game.getSnapshot().scenario.farm.cash); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});

test('original engine PCM plays without frame restarts, caches between clips, and stops on pause, mute and farm replacement', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', r => { if (r.url().endsWith('/plane.voc')) requests.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const voices: { length: number; time: number; duration: number; stopped: boolean; analyser: AnalyserNode }[] = [];
    Object.assign(window, { __flightVoices: voices });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(), start = source.start.bind(source), stop = source.stop.bind(source);
          let voice: typeof voices[number];
          source.start = (...args) => {
            const analyser = this.createAnalyser(); source.connect(analyser);
            voice = { length: source.buffer!.length, time: this.currentTime, duration: source.buffer!.duration, stopped: false, analyser };
            voices.push(voice); start(...args);
          };
          source.stop = (...args) => { if (voice) voice.stopped = true; stop(...args); };
          return source;
        };
      }
    };
  });
  await page.goto('/'); const f = prepared(); await load(page, f.game.save(4)); await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('2');
  await toggleOption(page,'Sound Effects'); await openWindow(page, 'aircraft'); await reveal(page, '#fly-aircraft'); await page.locator('#fly-aircraft').click();
  const voices = () => page.evaluate(() => (window as unknown as { __flightVoices: { length: number; time: number; duration: number; stopped: boolean }[] }).__flightVoices
    .filter(v => v.length === 12848).map(({ length, time, duration, stopped }) => ({ length, time, duration, stopped })));
  await expect.poll(() => page.evaluate(() => {
    const all = (window as unknown as { __flightVoices: { length: number; analyser: AnalyserNode }[] }).__flightVoices;
    const voice = all.find(v => v.length === 12848), values = new Float32Array(2048);
    voice?.analyser.getFloatTimeDomainData(values); return Math.max(...values.map(Math.abs));
  })).toBeGreaterThan(0.01);
  await expect.poll(async () => (await voices()).length).toBeGreaterThanOrEqual(2);
  const initial = await voices(); expect(initial[1].time - initial[0].time).toBeGreaterThanOrEqual(initial[0].duration - 0.02);
  expect(initial[0].stopped).toBe(false); expect(requests).toHaveLength(1);
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await expect.poll(async () => (await voices()).at(-1)!.stopped).toBe(true);
  const checkpoint = await save(page), count = (await voices()).length;
  await page.keyboard.press('KeyD'); expect((await voices()).length).toBe(count); // Queued controls while paused are silent.
  await toggleOption(page,'Sound Effects'); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await expect(page.locator('#time-status')).toContainText('Running');
  expect(requests).toHaveLength(1); expect((await voices()).length).toBe(count);
  await toggleOption(page,'Sound Effects'); await expect.poll(async () => (await voices()).length).toBeGreaterThan(count);
  await load(page, JSON.stringify(checkpoint)); await expect(page.locator('#time-status')).toContainText('Paused');
  await expect.poll(async () => (await voices()).at(-1)!.stopped).toBe(true);
  expect(await save(page)).toEqual(checkpoint); expect(errors).toEqual([]);
});

test('missing engine audio reports once per flight attempt and can recover without changing flight rules', async ({ page }) => {
  let requests = 0; const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/plane.voc', route => { requests++; return route.fulfill({ status: 404, body: 'Missing engine' }); });
  await page.goto('/'); const f = prepared(); await load(page, f.game.save(4)); await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('2');
  await toggleOption(page,'Sound Effects'); await openWindow(page, 'aircraft'); await reveal(page, '#fly-aircraft'); await page.locator('#fly-aircraft').click();
  await expect(page.locator('#sound-error')).toContainText('plane.voc');
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); const snapshot = await save(page);
  expect(snapshot.runtime.aircraftFlight).not.toBeNull(); expect(requests).toBe(1);
  const expected = GameSimulation.load(JSON.stringify(snapshot), browserCrops).simulation.withAllCrops(browserCrops);
  await press(page, expected, 'right'); expect(await save(page)).toEqual(JSON.parse(expected.save(4)));
  await page.unroute('**/plane.voc'); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await expect(page.locator('#sound-error')).toHaveCount(0); await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  expect(errors).toEqual([]);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
