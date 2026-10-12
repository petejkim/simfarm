import {readSaveText} from '../support/save-file';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops, useOriginalCatalog } from '../support/crop-catalog';
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
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const download = await pending, path = `artifacts/browser-original-import-${name}.json`;
  await download.saveAs(path);
  return { data: JSON.parse(readSaveText(path)), filename: download.suggestedFilename() };
}

test('original SSM import retains the active session, continues and restores without fetching a scenario', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  const before = (await save(page, 'before')).data;
  const original = GameSimulation.load(JSON.stringify(before), browserCrops, newFarmAssets.townLayouts).simulation.withAllCrops(browserCrops);
  const bytes = source('SCEN6.SSM');
  const expected = original.importOriginal(bytes, crops).simulation.withAllCrops(browserCrops);
  const requests: string[] = [];
  await page.route('**/assets/raw/SCEN*.SSM', route => { requests.push(route.request().url()); return route.abort(); });
  await load(page, bytes, 'MYFARM.SSM');
  await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
  await expect(page.locator('#map-status')).toHaveText('Imported farm · original terrain');
  const imported = await save(page, 'loaded');
  expect(imported.filename).toContain('simfarm-imported-farm-');
  expect(imported.data).toEqual(JSON.parse(expected.save(null)));
  expect(imported.data.scenario.source).toBe(bytes.toString('hex'));
  expect(imported.data.runtime.random).toEqual(before.runtime.random);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
  const advanced = (await save(page, 'advanced')).data;
  expect(advanced).toEqual(JSON.parse(expected.save(null)));
  await load(page, Buffer.from(JSON.stringify(advanced)), 'imported.simfarm.json');
  expect((await save(page, 'restored')).data).toEqual(advanced);
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('original import from a generated farm retains setup and works on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const generated = GameSimulation.createNew(newFarmOptions, { ...newFarmAssets, crops }).withAllCrops(browserCrops);
  await load(page, Buffer.from(generated.save(null)), 'generated.json');
  const bytes = source('SCEN7.SSM'), expected = generated.importOriginal(bytes, crops).simulation.withAllCrops(browserCrops);
  await load(page, bytes, 'farm.ssm');
  const imported = (await save(page, 'generated-session')).data;
  expect(imported).toEqual(JSON.parse(expected.save(null)));
  expect(imported.runtime.newFarm).toBeNull(); expect(imported.runtime.retainedSetup).not.toBeNull();
  await load(page, Buffer.from(JSON.stringify(imported)), 'restored.json');
  expect((await save(page, 'generated-restored')).data).toEqual(imported);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
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
  const steps = imported.scenario.farm.dayDelayTicks + 1 - 27;
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
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
    if (running) { await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); }
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
    expect(actual.runtime.originalPause).toEqual({ depth: Math.max(0, depth - 1), speedChecks: resumes ? [0, 0, 1, 0, 0] : [0, 0, 0, 0, 1] });
    expect(actual.runtime.random).toEqual(prior.runtime.random);
    expect(actual.scenario.source).toBe(bytes.toString('hex'));
    await expect(page.locator('#time-status')).toContainText('Paused');
    const expected = GameSimulation.load(JSON.stringify(prior), browserCrops, newFarmAssets.townLayouts).simulation.withAllCrops(browserCrops).importOriginal(bytes, crops).simulation.withAllCrops(browserCrops);
    expect(actual).toEqual(JSON.parse(expected.save(null)));
    await load(page, Buffer.from(JSON.stringify(actual)), 'pause-restored.json');
    expect((await save(page, 'pause-restored')).data).toEqual(actual);
    await reveal(page, '#next-day'); await page.locator('#next-day').click(); expected.dispatch({ type: 'advance-day' });
    expect((await save(page, 'pause-next')).data).toEqual(JSON.parse(expected.save(null)));
  }
});

test('equipment pacing bytes survive browser checkpoints; v21 keeps unknown identity and rejects malformed v22 atomically', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const current = (await save(page, 'byte-before')).data;
  const legacy = structuredClone(current); useOriginalCatalog(legacy); legacy.version = 21; delete legacy.scenario.farm.equipmentPacingByte;
  await load(page, Buffer.from(JSON.stringify(legacy)), 'legacy.json');
  const migrated = (await save(page, 'byte-migrated')).data;
  expect(migrated.version).toBe(27);
  expect(migrated).toEqual({ ...current, scenario: { ...current.scenario, farm: { ...current.scenario.farm, equipmentPacingByte: null } },
    runtime: { ...current.runtime, originalPause: { depth: null, speedChecks: [null, null, null, null, null] } } });
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  const advanced = (await save(page, 'byte-advanced')).data; expect(advanced.scenario.farm.equipmentPacingByte).toBeNull();
  for (const byte of [undefined, -1, 256, 0.5, '2']) {
    const bad = structuredClone(advanced); bad.scenario.farm.equipmentPacingByte = byte;
    await page.locator('#load-farm-file').setInputFiles({ name: 'bad-byte.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await expect(page.locator('#save-status')).toContainText('equipment pacing');
    expect((await save(page, 'byte-rejected')).data).toEqual(advanced);
  }
  for (const [byte, depth, expected] of [[3, 0, 3], [255, 2, 255], [255, 1, 2], [0, 0, 0]]) {
    const bytes = Buffer.from(source('SCEN4.SSM')); bytes[0x21718] = byte; bytes[0x21719] = depth;
    await load(page, bytes, 'source.SSM'); const imported = (await save(page, 'byte-original')).data;
    expect(imported.scenario.farm.equipmentPacingByte).toBe(expected);
    expect(imported.scenario.farm.paceEquipment).toBe(expected !== 0);
    await load(page, Buffer.from(JSON.stringify(imported)), 'checkpoint.json');
    expect((await save(page, 'byte-restored')).data).toEqual(imported);
  }
});

test('original pause ownership survives checkpoints; v22 migrates to unknown and malformed v23 rejection is atomic', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const base = (await save(page, 'owner-base')).data;
  const legacy = structuredClone(base); useOriginalCatalog(legacy); legacy.version = 22; delete legacy.runtime.originalPause;
  await load(page, Buffer.from(JSON.stringify(legacy)), 'v22.json');
  const unknown = (await save(page, 'owner-unknown')).data;
  expect(unknown.version).toBe(27);
  expect(unknown).toEqual({ ...base, runtime: { ...base.runtime, originalPause: { depth: null, speedChecks: [null, null, null, null, null] } } });
  for (const owner of [undefined, { depth: 256, speedChecks: [0, 0, 1, 0, 0] }, { depth: 0, speedChecks: [0, 0, -1, 0, 0] }]) {
    const bad = structuredClone(unknown); bad.runtime.originalPause = owner;
    await page.locator('#load-farm-file').setInputFiles({ name: 'bad-owner.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await expect(page.locator('#save-status')).toContainText('Could not load farm');
    expect((await save(page, 'owner-rejected')).data).toEqual(unknown);
  }
  const raw = structuredClone(base); raw.runtime.originalPause = { depth: 255, speedChecks: [128, 3, 254, 1, 255] };
  await load(page, Buffer.from(JSON.stringify(raw)), 'raw-owner.json'); expect((await save(page, 'owner-raw')).data).toEqual(raw);
  await load(page, source('SCEN4.SSM'), 'wrap.SSM');
  const wrapped = (await save(page, 'owner-wrapped')).data;
  expect(wrapped.runtime.originalPause).toEqual({ depth: 0, speedChecks: raw.runtime.originalPause.speedChecks });
  await page.reload(); await load(page, Buffer.from(JSON.stringify(wrapped)), 'checkpoint.json');
  expect((await save(page, 'owner-restored')).data).toEqual(wrapped);
  const one = Buffer.from(source('SCEN4.SSM')); one[0x21719] = 1;
  await load(page, one, 'resume.SSM');
  expect((await save(page, 'owner-normal')).data.runtime.originalPause).toEqual({ depth: 0, speedChecks: [0, 0, 1, 0, 0] });
});
