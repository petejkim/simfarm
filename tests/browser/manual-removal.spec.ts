import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import { plantField, clickFarmTile } from '../support/field-actions';
import { reveal, openWindow, expectPaletteAction } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { breedingFixture } from '../support/animal-lifecycle';
import { GameSimulation } from '../support/game';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { checkManualRemoval } from '../../src/simulation/manual-removal';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'removal.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  const file = 'artifacts/browser-removal.simfarm.json'; await (await pending).saveAs(file);
  return JSON.parse(readSaveText(file));
}
async function selectTile(page:Page,x:number,y:number){
  await reveal(page,'#viewport');await page.getByRole('button',{name:'Bulldoze',exact:true}).click();await clickFarmTile(page,x,y);
}

async function clearingPixels(page: Page, x: number, y: number) {
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (name: string) => archive.find(e => e.name === name)!.bytes;
  const expected = decodePlanar(asset('ega16til.til').subarray(664 * 128, 665 * 128), 16, 16, readPalette(asset('simfarm.pal'))).rgba;
  const actual = await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y });
  expect(actual).toEqual(Array.from(expected));
}

test('removal selection cancels safely, confirms stored-content demolition, plays original PCM and saves exact cleanup', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const create = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = create(), start = source.start.bind(source);
          source.start = (...args) => {
            if (source.buffer?.length === 12736) { const analyser = this.createAnalyser(); source.connect(analyser); Object.assign(window, { __removalExplosion: analyser }); }
            start(...args);
          };
          return source;
        };
      }
    };
  });
  const f = breedingFixture(), game = f.load().withAllCrops(browserCrops);
  game.dispatch({ type: 'build', buildingType: 67, x: 40, y: 40 });
  game.dispatch({ type: 'buy-equipment', equipmentType: 0, x: 40, y: 40 });
  await page.goto('/'); await load(page, game.save(4)); await expect(page.locator('#removal-panel')).toHaveCount(0);
  const dialog=page.getByRole('dialog',{name:'Message',exact:true});await expect(dialog).toHaveCount(0);
  await selectTile(page,21,21);await expect(dialog).toContainText('destroy this structure?');
  await dialog.getByRole('button',{name:'CANCEL',exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await toggleOption(page,'Sound Effects');
  for (const [x, y] of [[21, 21], [41, 41]]) {
    await selectTile(page, x, y); const quote = checkManualRemoval(game.getSnapshot().scenario, x, y); expect(quote.ok).toBe(true);
    if (!quote.ok) throw new Error('Missing removal target');
    if (x === 21) {
      await page.setViewportSize({ width: 1280, height: 844 }); await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
      await page.screenshot({ path: 'artifacts/browser-manual-removal.png', fullPage: true });
    }
    await page.getByRole('button',{name:'YES',exact:true}).click(); game.dispatch({ type: 'remove-object', x, y, kind: quote.kind, slot: quote.slot });
    
    await expect.poll(() => page.evaluate(() => {
      const analyser = (window as unknown as { __removalExplosion?: AnalyserNode }).__removalExplosion, data = new Float32Array(2048);
      analyser?.getFloatTimeDomainData(data); return Math.max(...data.map(Math.abs));
    })).toBeGreaterThan(0.01);
    await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'View object',exact:true}).click();
    await clearingPixels(page, quote.x, quote.y);
    await expect(page.locator('#farm-cash')).toHaveText(`$${game.getSnapshot().scenario.farm.cash.toLocaleString('en-US')}`);
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  await page.reload(); await load(page, game.save(4)); await expect(page.locator('#removal-panel')).toHaveCount(0);
  for (let d = 0; d < 14; d++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' }); }
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); expect(errors).toEqual([]);
});

test('field removal explains active machinery, destroys a growing crop after confirmation and permits replanting after saved clearing', async ({ page }) => {
  const w = readScenario(source('SCEN4.SSM')), crops = w.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  w.farm.cash = 100000; const game = new GameSimulation(w, crops).withAllCrops(browserCrops);
  game.dispatch({ type: 'buy-land', regionX: 0, regionY: 2 }); game.dispatch({ type: 'set-auto-clear', enabled: true });
  game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  const result = game.getSnapshot().lastNewFieldResult; expect(result?.ok).toBe(true); if (!result?.ok) throw new Error('Missing field');
  await page.goto('/'); await load(page, game.save(4)); await expect(page.locator('#removal-panel')).toHaveCount(0);
  await selectTile(page,1,17);const dialog=page.getByRole('dialog',{name:'Message',exact:true});await expect(dialog).toContainText('equipment is operating');
  await expect(dialog.getByRole('button',{name:'YES',exact:true})).toHaveCount(0);await dialog.getByRole('button',{name:'OK',exact:true}).click(); expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await selectTile(page,1,17);await expect(dialog).toContainText('destroy this field?');
  await page.getByRole('button',{name:'YES',exact:true}).click(); game.dispatch({ type: 'remove-object', x: 1, y: 17, kind: 'field', slot: result.slot });
  
  await page.getByRole('button',{name:'View object',exact:true}).click(); await clearingPixels(page, 0, 16);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.reload(); await load(page, game.save(4)); await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  await plantField(page,0,16);await expectPaletteAction(page,'View object'); game.dispatch({ type: 'create-field', x: 0, y: 16, cropSlot: 0 });
  expect(game.getSnapshot().lastNewFieldResult?.ok).toBe(true); await expect(page.locator('#map-tool')).toHaveCount(0);
  await reveal(page, '#next-day'); await page.locator('#next-day').click(); game.dispatch({ type: 'advance-day' });
  expect(game.getSnapshot().scenario.fields[result.slot].state).toBe(4);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
