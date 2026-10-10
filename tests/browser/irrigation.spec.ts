import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { readScenario, worldIndex } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';

const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
function fixture(wind = 10, dig = false) {
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  for (let x = 8; x < 25; x++) for (let y = 8; y < 25; y++) scenario.cells[worldIndex(x, y)] = { terrain: 15, overlay: 0x800, attribute: 0 };
  for (let x = 11; x < 20; x++) scenario.cells[worldIndex(x, 10)].terrain = dig ? (x === 17 ? 161 : 15) : 87;
  scenario.cells[worldIndex(9, 10)].terrain = 0x200f;
  scenario.irrigation.sourceCount = 0; scenario.irrigation.sources.fill(0);
  Object.assign(scenario.farm, { animationTicks: 0, timerTicks: 0, dayDelayTicks: 3 });
  Object.assign(scenario.farm.calendar, { day: 0, week: 0, month: 0 }); scenario.schedule.bytes.fill(0);
  const field = scenario.fields[1]; field.bytes[10] = field.bytes[11] = 11; field.bytes[2] = 4;
  field.equipment = field.pendingEquipment = 0; field.bytes[51] = field.bytes[52] = 0;
  const checkpoint = JSON.parse(new GameSimulation(scenario, crops).withAllCrops(browserCrops).save(4)); checkpoint.runtime.weather.wind = wind;
  return { game: GameSimulation.load(JSON.stringify(checkpoint), browserCrops).simulation.withAllCrops(browserCrops), crops };
}
async function select(page: Page, x: number, y: number) {
  await page.locator('#viewport').evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await page.locator('#viewport').scrollIntoViewIfNeeded();
  const box = (await page.locator('#world').boundingBox())!;
  await page.mouse.click(box.x + x * 16 + 8, box.y + y * 16 + 8);
  await expect(page.locator('#cell-status')).toContainText(`Tile ${x}, ${y}`);
}
async function download(page: Page, path: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  await (await pending).saveAs(path); return JSON.parse(readFileSync(path, 'utf8'));
}

test('purchased water pump wets original ditch pixels, refreshes fields and continues its saved wave', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const { game } = fixture(); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'ditches.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('70'); await select(page, 10, 10);
  await page.locator('#build-building').click(); game.dispatch({ type: 'build', buildingType: 70, x: 10, y: 10 });
  await expect(page.locator('#building-result')).toHaveText('Built for $1,000.');
  const pixel = () => page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(14 * 16, 10 * 16, 16, 16).data));
  const before = await pixel(); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const wet = await pixel(); expect(wet).not.toEqual(before);
  const atlas = PNG.sync.read(readFileSync('public/assets/scenario4.tiles.png')), expected: number[] = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const offset = ((3 * 16 + y) * atlas.width + 2 * 16 + x) * 4; // original wet ditch tile98.
    expected.push(...atlas.data.subarray(offset, offset + 4));
  }
  expect(wet).toEqual(expected);
  await page.waitForTimeout(100); expect(await pixel()).toEqual(wet); // Paused means no water propagation.
  const path = 'artifacts/browser-irrigation.simfarm.json', saved = await download(page, path);
  expect(saved).toEqual(JSON.parse(game.save(4))); expect(saved.scenario.irrigation.active).toBe(true);
  expect(saved.scenario.irrigation.flow.length).toBeGreaterThan(0);
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); expect(await pixel()).toEqual(wet);
  for (let i = 0; i < 2; i++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(game.getSnapshot().scenario.fields[1].bytes[51]).toBe(9);
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  // The wave has advanced since the first wet atlas check. A failed load must
  // preserve its current pixels and checkpoint, not restore the earlier phase.
  const beforeRejectedLoad = await pixel();
  const malformed = JSON.parse(game.save(4)); malformed.scenario.irrigation.sourceCount = 65;
  await page.locator('#load-farm-file').setInputFiles({ name: 'bad-water.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(malformed)) });
  await expect(page.locator('#save-status')).toContainText('irrigation source count'); expect(await pixel()).toEqual(beforeRejectedLoad);
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#map-tool').selectOption('build');
  await page.locator('#building-type').selectOption('71'); await select(page, 20, 20); await page.locator('#building-type').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-irrigation.png', fullPage: true }); expect(errors).toEqual([]);
});

test('wind-powered building saves original masked footprint and respects low wind before a wet pass', async ({ page }) => {
  const { game } = fixture(8);
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles({ name: 'wind.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('71'); await select(page, 20, 20);
  await page.locator('#build-building').click(); game.dispatch({ type: 'build', buildingType: 71, x: 20, y: 20 });
  await expect(page.locator('#building-result')).toHaveText('Built for $2,000.');
  await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  const saved = await download(page, 'artifacts/browser-irrigation-wind.simfarm.json'); expect(saved).toEqual(JSON.parse(game.save(4)));
  expect(saved.scenario.irrigation.phase).toBe(1); expect(saved.scenario.irrigation.active).toBe(false); expect(saved.scenario.irrigation.flow).toEqual([]);
  const cells = game.getSnapshot().scenario.cells;
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    const c = cells[worldIndex(20 + x, 20 + y)]; expect(c.overlay & 0x7ff).toBe(1010 + y * 2 + x); expect(c.terrain & 0x800).toBe(0x800);
  }
});

test('Irrigation controls dig a connected supply, install and operate a valve, and persist rendered waterworks', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const { game } = fixture(10, true); await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'dig.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#map-tool').selectOption('build'); await page.locator('#building-type').selectOption('70'); await select(page, 10, 10);
  await page.locator('#build-building').click(); game.dispatch({ type: 'build', buildingType: 70, x: 10, y: 10 });
  await page.locator('#map-tool').selectOption('irrigation');
  for (let x = 11; x <= 19; x++) {
    await select(page, x, 10); await expect(page.locator('#irrigation-placement-status')).toContainText(x === 17 ? '$40' : '$80');
    await page.locator('#apply-irrigation').click(); game.dispatch({ type: 'irrigation', tool: 'ditch', x, y: 10 });
  }
  await page.locator('#irrigation-tool').selectOption('valve'); await select(page, 15, 10);
  await page.locator('#apply-irrigation').click(); game.dispatch({ type: 'irrigation', tool: 'valve', x: 15, y: 10 });
  await expect(page.locator('#valve-state')).toContainText('is open');
  await page.locator('#irrigation-tool').selectOption('close-valve'); await page.locator('#apply-irrigation').click();
  game.dispatch({ type: 'irrigation', tool: 'close-valve', x: 15, y: 10 });
  await expect(page.locator('#valve-state')).toContainText('is closed');
  await expect(page.locator('#irrigation-result')).toHaveText('Waterworks updated for $0.');
  // Remove the translucent placement preview; compare interior pixels against the original atlas.
  await page.locator('#map-tool').selectOption('inspect');
  const pixels = await page.locator('#world').evaluate((c: HTMLCanvasElement) => Array.from(c.getContext('2d')!.getImageData(15 * 16 + 2, 10 * 16 + 2, 12, 12).data));
  const atlas = PNG.sync.read(readFileSync('public/assets/scenario4.tiles.png')), expected: number[] = [];
  for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) {
    const offset = ((3 * 16 + y) * atlas.width + 27 * 16 + x) * 4; // Closed valve123.
    expected.push(...atlas.data.subarray(offset, offset + 4));
  }
  expect(pixels).toEqual(expected);
  for (let i = 0; i < 3; i++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(game.getSnapshot().scenario.fields[1].bytes[51]).toBe(4);
  const path = 'artifacts/browser-ditches.simfarm.json'; expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path); await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await page.locator('#map-tool').selectOption('irrigation'); await select(page, 15, 10);
  await page.locator('#irrigation-tool').selectOption('open-valve'); await page.locator('#apply-irrigation').click();
  game.dispatch({ type: 'irrigation', tool: 'open-valve', x: 15, y: 10 }); await expect(page.locator('#valve-state')).toContainText('is open');
  for (let i = 0; i < 8; i++) { await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(game.getSnapshot().scenario.fields[1].bytes[51]).toBeGreaterThan(4);
  expect(await download(page, path)).toEqual(JSON.parse(game.save(4)));
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#irrigation-tool').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/browser-ditch-controls.png', fullPage: true }); expect(errors).toEqual([]);
});

test('Irrigation placement shows blocked terrain and insufficient cash without charging or clearing', async ({ page }) => {
  const { game, crops } = fixture(10, true), save = JSON.parse(game.save(4));
  save.scenario.farm.cash = 104; save.scenario.farm.autoClear = true;
  const world = Buffer.from(save.scenario.world, 'hex'); world.writeUInt16LE(535, worldIndex(20, 20) * 5);
  save.scenario.world = world.toString('hex'); save.runtime.weather.soilMoisture = 0;
  const sim = GameSimulation.load(JSON.stringify(save), browserCrops).simulation.withAllCrops(browserCrops), before = JSON.parse(sim.save(4));
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles({ name: 'low-cash.json', mimeType: 'application/json', buffer: Buffer.from(sim.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await page.locator('#map-tool').selectOption('irrigation');
  await select(page, 20, 20); await expect(page.locator('#irrigation-placement-status')).toContainText('not enough cash');
  await expect(page.locator('#apply-irrigation')).toBeDisabled();
  await page.locator('#irrigation-tool').selectOption('valve');
  await expect(page.locator('#irrigation-placement-status')).toContainText('straight ditch');
  await expect(page.locator('#apply-irrigation')).toBeDisabled();
  expect(await download(page, 'artifacts/browser-ditch-rejected.simfarm.json')).toEqual(before);
});
