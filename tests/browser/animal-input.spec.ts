import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import { reveal, openWindow , speedItem } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { livestockFixture } from '../support/livestock';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'animal-input.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  const path = 'artifacts/browser-animal-input.simfarm.json'; await (await pending).saveAs(path);
  return JSON.parse(readSaveText(path));
}

test('map hover steers original livestock through zoom and scrolling, and clears on pointer exit or window blur', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message)); await page.goto('/');
  for (const [zoom, action] of [[0.5, 'hover'], [1, 'hover'], [2, 'scroll'], [1, 'leave'], [1, 'blur']] as const) {
    const f = livestockFixture(16); f.state.scenario.animals[1].bytes[13] = f.state.scenario.animals[1].bytes[14] = 0;
    f.state.scenario.farm.calendar.day = 1; // Even day has no new needs before the first move.
    const game = f.load().withAllCrops(browserCrops); await load(page, game.save(4));
    await reveal(page, '#zoom'); await page.locator('#zoom').selectOption(String(zoom)); await page.locator('#speed-menu-button').focus();
    await reveal(page, '#viewport'); await page.locator('#viewport').scrollIntoViewIfNeeded();
    await page.locator('#viewport').evaluate(v => { v.scrollLeft = v.scrollTop = 0; });
    const rect = await page.locator('#world').boundingBox(); expect(rect).not.toBeNull();
    await page.mouse.move(rect!.x + 9.5 * 16 * zoom, rect!.y + 10.5 * 16 * zoom);
    let pointer: { x: number; y: number } | null = { x: 9, y: 10 };
    if (action === 'scroll') {
      await page.locator('#viewport').evaluate((v, pixels) => { v.scrollLeft = pixels; v.dispatchEvent(new Event('scroll')); }, 32 * zoom);
      pointer = { x: 11, y: 10 };
    }
    if (action === 'leave') { await page.mouse.move(0, 0); pointer = null; }
    if (action === 'blur') { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); pointer = null; }
    game.dispatch({ type: 'set-map-pointer', pointer });
    // Open Speed with the keyboard, leaving the pointer on the map.
    await page.locator('#speed-menu-button').focus(); await page.keyboard.press('Enter');
    await (await speedItem(page,'#next-day')).focus(); await page.keyboard.press('Enter'); game.dispatch({ type: 'advance-day' });
    await expect(page.locator('#time-status')).toContainText('1 days advanced');
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    if (action === 'hover') expect(game.getSnapshot().scenario.animals[1].x).toBe(11);
    if (action === 'scroll') expect(game.getSnapshot().scenario.animals[1].x).toBe(9);
  }
  expect(errors).toEqual([]);
});

test('original animal voices are audible when enabled, mute does not alter state, and missing PCM leaves play usable', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', r => { if (r.url().endsWith('.voc')) requests.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const Base = window.AudioContext, voices: { length: number; analyser: AnalyserNode }[] = [];
    Object.assign(window, { __animalVoices: voices });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const s = create(), start = s.start.bind(s);
          s.start = (...args) => { const analyser = this.createAnalyser(); s.connect(analyser);
            voices.push({ length: s.buffer!.length, analyser }); start(...args); };
          return s;
        };
      }
    };
  });
  await page.goto('/');
  const weekly = livestockFixture(16); weekly.state.scenario.farm.calendar.day = 6; weekly.state.random.simulation = 300;
  const muted = weekly.load().withAllCrops(browserCrops); await load(page, muted.save(4));
  await (await speedItem(page,'#next-day')).click(); muted.dispatch({ type: 'advance-day' }); expect(requests).toEqual([]);
  expect(await save(page)).toEqual(JSON.parse(muted.save(4)));
  await load(page, weekly.load().withAllCrops(browserCrops).save(4)); await toggleOption(page,'Sound Effects'); await (await speedItem(page,'#next-day')).click();
  await expect.poll(() => page.evaluate(() => {
    const voices = (window as unknown as { __animalVoices: { length: number; analyser: AnalyserNode }[] }).__animalVoices;
    const voice = voices.find(v => v.length === 8210), values = new Float32Array(2048);
    voice?.analyser.getFloatTimeDomainData(values); return Math.max(...values.map(Math.abs));
  })).toBeGreaterThan(0.01);
  expect(requests.filter(r => r.endsWith('/cow2.voc'))).toHaveLength(1);
  expect(await save(page)).toEqual(JSON.parse(muted.save(4)));
  // Collision recovery exercises all six verified filename/variant paths.
  for (const [type, visual, name, length] of [[160, 0, 'horse1', 8300], [161, 256, 'cow2', 8210],
    [162, 0, 'pig', 5204], [163, 0, 'sheep1', 6456], [163, 256, 'sheep2', 11219]] as const) {
    const f = livestockFixture(16), a = f.state.scenario.animals[1]; a.bytes[6] = type; a.flags |= 8;
    a.bytes[13] = a.bytes[14] = a.bytes[30] = a.bytes[31] = 0;
    f.state.scenario.farm.calendar.day = 1;
    f.state.scenario.farm.animationTicks = f.state.scenario.farm.timerTicks = f.state.animalFrame.lastMoveTick = 640;
    f.state.animalFrame.lastCentreTick = f.state.traffic.lastTick = 640; f.state.random.visual = visual;
    for (const d of f.state.finances.accounts.assets.animalDefinitions) d.count = Number(d.type === type);
    const game = f.load().withAllCrops(browserCrops); await load(page, game.save(4)); await (await speedItem(page,'#next-day')).click(); game.dispatch({ type: 'advance-day' });
    await expect.poll(() => page.evaluate(n => (window as unknown as { __animalVoices: { length: number }[] }).__animalVoices.some(v => v.length === n), length)).toBe(true);
    expect(requests.some(r => r.endsWith(`/${name}.voc`))).toBe(true);
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await toggleOption(page,'Sound Effects'); await load(page, weekly.load().withAllCrops(browserCrops).save(4));
  const count = requests.length; await (await speedItem(page,'#next-day')).click(); expect(requests).toHaveLength(count);
  await page.route('**/cow2.voc', route => route.fulfill({ status: 404, body: 'Missing voice' }));
  // Samples stay cached once decoded; a fresh page exercises the missing-file path.
  await page.reload(); await expect(page.locator('#map-status')).toContainText('original terrain');
  await load(page, weekly.load().withAllCrops(browserCrops).save(4)); await toggleOption(page,'Sound Effects'); await (await speedItem(page,'#next-day')).click();
  await expect(page.locator('#sound-error')).toContainText('cow2.voc'); await expect((await speedItem(page,'#next-day'))).toBeEnabled();
  expect(await save(page)).toEqual(JSON.parse(muted.save(4))); expect(errors).toEqual([]);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
