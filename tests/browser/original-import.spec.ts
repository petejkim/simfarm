import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { GameSimulation } from '../../src/simulation/game';
import { readCrop } from '../../src/formats/crop';
import { newFarmAssets, newFarmOptions } from '../support/new-farm';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
const crops = readdirSync(new URL('../../../simfarm-dos/CROPS', import.meta.url)).filter(n => /\.crp$/i.test(n)).map(n => readCrop(n.slice(0, -4).toLowerCase(), source('CROPS/' + n)));
async function load(page: Page, buffer: Buffer, name: string) {
  await page.locator('#load-farm-file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#save-farm').click();
  const download = await pending, path = `artifacts/browser-original-import-${name}.json`;
  await download.saveAs(path);
  return { data: JSON.parse(readFileSync(path, 'utf8')), filename: download.suggestedFilename() };
}

test('original SSM import retains the active session, continues and restores without fetching a scenario', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#next-day').click();
  const before = (await save(page, 'before')).data;
  const original = GameSimulation.load(JSON.stringify(before), crops, newFarmAssets.townLayouts).simulation;
  const bytes = source('SCEN6.SSM');
  const expected = original.importOriginal(bytes, crops).simulation;
  const requests: string[] = [];
  await page.route('**/assets/raw/SCEN*.SSM', route => { requests.push(route.request().url()); return route.abort(); });
  await load(page, bytes, 'MYFARM.SSM');
  await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
  await expect(page.locator('#scenario option:checked')).toHaveText('Imported farm');
  const imported = await save(page, 'loaded');
  expect(imported.filename).toContain('simfarm-imported-farm-');
  expect(imported.data).toEqual(JSON.parse(expected.save(null)));
  expect(imported.data.scenario.source).toBe(bytes.toString('hex'));
  expect(imported.data.runtime.random).toEqual(before.runtime.random);
  await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  const advanced = (await save(page, 'advanced')).data;
  expect(advanced).toEqual(JSON.parse(expected.save(null)));
  await load(page, Buffer.from(JSON.stringify(advanced)), 'imported.simfarm.json');
  expect((await save(page, 'restored')).data).toEqual(advanced);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('original import from a generated farm retains setup and works on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const generated = GameSimulation.createNew(newFarmOptions, { ...newFarmAssets, crops });
  await load(page, Buffer.from(generated.save(null)), 'generated.json');
  const bytes = source('SCEN7.SSM'), expected = generated.importOriginal(bytes, crops).simulation;
  await load(page, bytes, 'farm.ssm');
  const imported = (await save(page, 'generated-session')).data;
  expect(imported).toEqual(JSON.parse(expected.save(null)));
  expect(imported.runtime.newFarm).toBeNull(); expect(imported.runtime.retainedSetup).not.toBeNull();
  await load(page, Buffer.from(JSON.stringify(imported)), 'restored.json');
  expect((await save(page, 'generated-restored')).data).toEqual(imported);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({ path: 'artifacts/browser-original-import-mobile.png', fullPage: true });
});

test('invalid originals and missing crop assets leave the active farm intact and allow retry', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before = (await save(page, 'failure-before')).data, bytes = source('SCEN0.SSM');
  for (const buffer of [bytes.subarray(0, -1), Buffer.alloc(bytes.length)]) {
    await page.locator('#load-farm-file').setInputFiles({ name: 'broken.SSM', mimeType: 'application/octet-stream', buffer });
    await expect(page.locator('#save-status')).toContainText('Could not load farm');
    expect((await save(page, 'failure-invalid')).data).toEqual(before);
  }
  await page.route('**/assets/raw/crops/*.crp', route => route.fulfill({ status: 404, body: '' }));
  await page.locator('#load-farm-file').setInputFiles({ name: 'farm.SSM', mimeType: 'application/octet-stream', buffer: bytes });
  await expect(page.locator('#save-status')).toContainText('Missing game asset');
  expect((await save(page, 'failure-asset')).data).toEqual(before);
  await page.unroute('**/assets/raw/crops/*.crp'); await load(page, bytes, 'farm.SSM');
  await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
});

test('original imports keep unequal calendar and machinery clocks distinct through Next day and native restore', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const prior = (await save(page, 'unequal-before')).data;
  prior.scenario.farm.animationTicks = 1000; prior.scenario.farm.timerTicks = 40000; prior.runtime.dayTicks = 17;
  await load(page, Buffer.from(JSON.stringify(prior)), 'unequal.json');
  const bytes = Buffer.from(source('SCEN0.SSM'));
  bytes.writeUInt16LE(1010, 0x216f7); bytes.writeUInt16LE(7, 0x216f9);
  await load(page, bytes, 'unequal.SSM');
  const imported = (await save(page, 'unequal-imported')).data;
  expect(imported.runtime.dayTicks).toBe(27);
  const steps = imported.scenario.farm.dayDelayTicks - 27;
  await page.locator('#next-day').click();
  const next = (await save(page, 'unequal-next')).data;
  expect(next.runtime.daysAdvanced).toBe(imported.runtime.daysAdvanced + 1);
  expect(next.runtime.dayTicks).toBe(0);
  expect(next.scenario.farm.animationTicks).toBe(1010 + steps);
  expect(next.scenario.farm.timerTicks).toBe(7 + steps);
  await load(page, Buffer.from(JSON.stringify(next)), 'unequal-restored.json');
  expect((await save(page, 'unequal-restored')).data).toEqual(next);
});

test('loaded pause depth decides original resume pacing for both running and paused browser sessions', async ({ page }) => {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const baseline = (await save(page, 'pause-baseline')).data;
  baseline.runtime.disasters.frameDelay = 47;
  for (const running of [false, true]) for (const depth of [0, 1, 2, 255]) {
    await load(page, Buffer.from(JSON.stringify(baseline)), 'pause-baseline.json');
    if (running) await page.locator('#play-pause').click();
    await expect(page.locator('#time-status')).toContainText(running ? 'Running' : 'Paused');
    const prior = (await save(page, 'pause-prior')).data;
    const bytes = Buffer.from(source('SCEN0.SSM'));
    bytes[0x21718] = 0; bytes[0x21719] = depth;
    bytes.writeUInt16LE(777, 0x2171a); bytes.writeUInt16LE(5, 0x2171c);
    bytes.writeUInt16LE(29, 0x2171e); bytes.writeUInt16LE(13, 0x21720);
    await load(page, bytes, `pause-${depth}.SSM`);
    const actual = (await save(page, `pause-${running}-${depth}`)).data, resumes = depth === 1;
    expect(actual.scenario.farm.paceEquipment).toBe(resumes);
    expect(actual.scenario.farm.dayDelayTicks).toBe(resumes ? 256 : 777);
    expect(actual.scenario.farm.speed).toBe(resumes ? 1 : 5);
    expect(actual.scenario.irrigation.delay).toBe(resumes ? 2 : 13);
    expect(actual.runtime.traffic.delay).toBe(resumes ? 16 : 29);
    expect(actual.runtime.disasters.frameDelay).toBe(resumes ? 4 : 47);
    expect(actual.runtime.random).toEqual(prior.runtime.random);
    expect(actual.scenario.source).toBe(bytes.toString('hex'));
    await expect(page.locator('#time-status')).toContainText('Paused');
    const expected = GameSimulation.load(JSON.stringify(prior), crops, newFarmAssets.townLayouts).simulation.importOriginal(bytes, crops).simulation;
    expect(actual).toEqual(JSON.parse(expected.save(null)));
    await load(page, Buffer.from(JSON.stringify(actual)), 'pause-restored.json');
    expect((await save(page, 'pause-restored')).data).toEqual(actual);
    await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
    expect((await save(page, 'pause-next')).data).toEqual(JSON.parse(expected.save(null)));
  }
});
