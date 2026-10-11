import { sprayField, buyPlot, selectProperty, setAutoDoze, plantField, clickFarmTile } from '../support/field-actions';
import { scheduleWeek, schedulePlant, scheduleNextHarvest } from '../support/schedule-window';
import { saleOffers, selectSaleOffer } from '../support/sell-window';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops, useOriginalCatalog } from '../support/crop-catalog';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { readScenario } from '../../src/formats/scenario';
import { readCrop } from '../../src/formats/crop';
import { GameSimulation } from '../support/game';

test('crop and masked pixels match source assets at original world coordinates; fields can be inspected', async ({ page }) => {
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const entries = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
  const asset = (name: string) => entries.find(e => e.name === name)!.bytes;
  const palette = readPalette(asset('simfarm.pal'));
  const grapes = decodePlanar(source('CROPS/GRAPES.CRP').subarray(0, 128), 16, 16, palette).rgba;
  const base = decodePlanar(asset('ega16til.til').subarray(170 * 128, 171 * 128), 16, 16, palette).rgba;
  const overlay = decodePlanar(asset('mskdtile.til').subarray(0, 128), 16, 16, palette, 7).rgba;
  for (let p = 0; p < base.length; p += 4) if (overlay[p + 3]) base.set(overlay.subarray(p, p + 4), p);
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  const pixels = (x: number, y: number) => page.locator('#world').evaluate((canvas: HTMLCanvasElement, point) =>
    Array.from(canvas.getContext('2d')!.getImageData(point.x * 16, point.y * 16, 16, 16).data), { x, y });
  expect(await pixels(41, 31)).toEqual(Array.from(grapes));
  expect(await pixels(59, 85)).toEqual(Array.from(base));
  await expect(page.locator('#field option')).toHaveCount(14);
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await expect(page.locator('#field-status')).toHaveText('Field 1 · Growing · 8 × 8 tiles at 39, 29');
  await expect(page.locator('#field option:checked')).toContainText('Grapes');
  // Selecting a field centers its actual map bounds; the viewport center must hit it.
  await reveal(page, '#viewport'); await page.locator('#viewport').scrollIntoViewIfNeeded();
  const center = await page.locator('#viewport').evaluate(v => ({ x: v.clientWidth / 2 + 1, y: v.clientHeight / 2 + 1 }));
  await reveal(page, '#viewport'); await page.locator('#viewport').click({ position: center });
  await expect(page.locator('#field')).toHaveValue('1');
  await expect(page.locator('#cell-status')).toContainText('Tile 43, 33');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('1');
  await expect(page.locator('#map-status')).toHaveText('Scenario 2 · original terrain');
  await expect(page.locator('#field option')).toHaveCount(10);
  await expect(page.locator('#field')).toHaveValue('');
  await expect(page.locator('#field-status')).toContainText('9 fields');
});

test('original scenario maps, crop selection, navigation and audible MIDI', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // Observe actual Web Audio output, not just the play button's label.
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    const audio = { contexts: [] as AudioContext[], analysers: [] as AnalyserNode[] };
    Object.assign(window, { __audioTest: audio });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); audio.contexts.push(this);
        const original = this.createGain.bind(this);
        this.createGain = () => {
          const gain = original();
          if (!audio.analysers.length) { const analyser = this.createAnalyser(); gain.connect(analyser); audio.analysers.push(analyser); }
          return gain;
        };
      }
    };
  });
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  const colors = await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, 1536, 1536).data, colors = new Set<number>();
    for (let p = 0; p < data.length; p += 4) colors.add((data[p] << 16) | (data[p + 1] << 8) | data[p + 2]);
    return colors.size;
  });
  expect(colors).toBeGreaterThan(8);
  await reveal(page, '#viewport'); await page.locator('#viewport').click({ position: { x: 160, y: 160 } });
  await expect(page.locator('#cell-status')).toContainText('graphic');
  await openWindow(page,'expert');await page.getByRole('button',{name:'Crops',exact:true}).click();
  for(let i=0;i<24&&!await page.locator('[data-expert-crop="corn"]').count();i++)await page.getByRole('button',{name:'NEXT',exact:true}).click();
  await expect(page.locator('[data-expert-crop="corn"]')).toContainText('Temperature: 2000 Degree Days');
  await expect.poll(() => page.locator('.expert-crop-picture').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 112)).toBeTruthy();
  for (let i = 1; i < 8; i++) {
    await reveal(page, '#scenario'); await page.locator('#scenario').selectOption(String(i));
    await expect(page.locator('#map-status')).toHaveText(`Scenario ${i + 1} · original terrain`);
  }
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('0.5');
  await expect(page.locator('#world')).toHaveCSS('width', '768px');
  await openWindow(page, 'options'); await page.locator('#music').selectOption('amain');await page.getByRole('button', { name: 'Play music' }).click();
  await expect(page.locator('#audio-status')).toContainText('Playing amain');
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { __audioTest: { contexts: AudioContext[]; analysers: AnalyserNode[] } }).__audioTest;
    const data = new Float32Array(2048);
    audio.analysers[0]?.getFloatTimeDomainData(data);
    return Math.max(...data.map(Math.abs));
  })).toBeGreaterThan(0.001);
  await openWindow(page, 'options'); await page.getByRole('button', { name: 'Stop music' }).click();
  await expect(page.locator('#audio-status')).toHaveText('Music off');
  await expect.poll(() => page.evaluate(() => {
    const audio = (window as unknown as { __audioTest: { analysers: AnalyserNode[] } }).__audioTest;
    const data = new Float32Array(2048); audio.analysers[0].getFloatTimeDomainData(data);
    return Math.max(...data.map(Math.abs));
  })).toBeLessThan(0.0001);
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('0');
  await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.screenshot({ path: 'artifacts/native-browser.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('missing assets give a useful startup error', async ({ page }) => {
  await page.route('**/assets/catalog.json', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SimFarm assets unavailable' })).toBeVisible();
  await expect(page.locator('#app')).toContainText('./tools/bun run import');
});

test('scenario changes cancel pending loads and recover after missing farm assets', async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/raw/SCEN0.SSM', async route => {
    await pending;
    await route.fulfill({ body: readFileSync(new URL('../../../simfarm-dos/SCEN0.SSM', import.meta.url)) });
  });
  await page.route('**/assets/scenario2.tiles.png', route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Loading map…');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('1');
  await expect(page.locator('#map-status')).toHaveText('Scenario 2 · original terrain');
  release();
  await expect(page.locator('#field option')).toHaveCount(10);
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('2');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('2');
  await expect(page.locator('#map-status')).toContainText('Cannot load scenario2.tiles.png');
  await expect(page.locator('#world')).toHaveCount(0);
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('3');
  await expect(page.locator('#map-status')).toHaveText('Scenario 4 · original terrain');
  await expect(page.locator('#field option')).toHaveCount(4);
  await expect(page.locator('#world')).toHaveCSS('width', '3072px');
});

test('time controls advance the simulation, render crop changes, pause, and reset on scenario changes', async ({ page }) => {
  test.setTimeout(45_000); // Advances17.6s of animation and repaints full maps; isolated run takes25s.
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await expect(page.locator('#farm-date')).toHaveText('April 28, 1993');
  await expect(page.locator('#field-growth')).toContainText('Crop age: 0 weeks');
  const before = await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#farm-date')).toHaveText('May 1, 1993');
  await expect(page.locator('#field-growth')).toContainText('Crop age: 1 weeks');
  const after = await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
  expect(after).not.toBe(before);
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await expect(page.locator('#next-day')).toBeDisabled();
  await page.clock.runFor(12400);
  await expect(page.locator('#time-status')).toHaveText('Running · 4 days advanced');
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await page.clock.runFor(3100);
  await expect(page.locator('#time-status')).toHaveText('Paused · 4 days advanced');
  await expect(page.locator('#next-day')).toBeEnabled();
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('0');
  await expect(page.locator('#time-status')).toHaveText('Paused · 0 days advanced');
  await page.clock.runFor(2100);
  await expect(page.locator('#time-status')).toHaveText('Paused · 0 days advanced');
  await expect(page.locator('#farm-date')).toHaveText('August 12, 1993');
  expect(errors).toEqual([]);
});

test('scheduled planting buys seed, rents machinery and renders original crop pixels', async ({ page }) => {
  const errors: string[] = [];page.on('pageerror', error => errors.push(error.message));
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const scenario=readScenario(source('SCEN1.SSM')),field=scenario.fields[1],cropFile=scenario.cropFiles[2];
  const crops=scenario.cropFiles.map(file=>readCrop(file.replace('.crp',''),source(`CROPS/${file.toUpperCase()}`)));
  const game=new GameSimulation(scenario,crops).withAllCrops(browserCrops);
  const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  const palette=readPalette(archive.find(e=>e.name==='simfarm.pal')!.bytes);
  const expected=decodePlanar(source(`CROPS/${cropFile.toUpperCase()}`).subarray(0,128),16,16,palette).rgba;
  await page.goto('/');await reveal(page,'#scenario');await page.locator('#scenario').selectOption('1');
  const week=scenario.farm.calendar.month*4+scenario.farm.calendar.week+1;
  await schedulePlant(page,field.x,field.y,week,2);
  game.dispatch({type:'edit-field-plan',fieldSlot:1,week,action:{kind:'plant',cropSlot:2}});
  await expect(page.locator('#plan-result')).toContainText('Plan updated');
  await expect(page.locator('#plant-field,#plant-crop')).toHaveCount(0);
  // Planning does not buy seed before the selected week arrives.
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  for(let day=0;day<14;day++){
    await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
  }
  expect(game.getSnapshot().scenario.fields[1].state).toBe(4);
  expect(game.getSnapshot().scenario.fields[1].cropSlot).toBe(2);
  expect(game.getSnapshot().scenario.farm.seedExpenses).toBeGreaterThan(0);
  expect(game.getSnapshot().scenario.farm.rentalExpenses).toBeGreaterThan(0);
  await expect(page.locator('#field-status')).toContainText('Growing');
  await expect(page.locator('#farm-cash')).toHaveText(`$${game.getSnapshot().scenario.farm.cash.toLocaleString('en-US')}`);
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save',exact:true}).click();
  expect(JSON.parse(readFileSync((await (await pending).path())!,'utf8'))).toEqual(JSON.parse(game.save(1)));
  const actual=await page.locator('#world').evaluate((canvas:HTMLCanvasElement,point)=>
    Array.from(canvas.getContext('2d')!.getImageData(point.x*16,point.y*16,16,16).data),{x:field.x+3,y:field.y+4});
  expect(actual).toEqual(Array.from(expected));
  await page.screenshot({path:'artifacts/browser-planting.png',fullPage:true});
  expect(errors).toEqual([]);
});

for (const id of [0, 4]) test(`scheduled harvest controls complete ${id === 0 ? 'worker' : 'machinery'} harvest and show stored crops`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const scenario = readScenario(source(`SCEN${id}.SSM`)), field = scenario.fields[1];
  const file = scenario.cropFiles[field.cropSlot], crop = readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`));
  const quantity = crop.rawDefinition[32] | crop.rawDefinition[33] << 8;
  const crops=scenario.cropFiles.map(name=>readCrop(name.replace('.crp',''),source(`CROPS/${name.toUpperCase()}`)));
  const expectedGame=new GameSimulation(scenario,crops).withAllCrops(browserCrops);
  await page.clock.install();
  await page.goto('/');
  if (id) { await reveal(page, '#scenario'); await page.locator('#scenario').selectOption(String(id)); }
  await expect(page.locator('#map-status')).toHaveText(`Scenario ${id + 1} · original terrain`);
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await expect(page.locator('#harvest-estimate')).toContainText('Estimated crop value: $0');
  await expect(page.locator('#harvest-stock')).toHaveText('No stored harvests.');
  const {week,daysUntil}=await scheduleNextHarvest(page,field.x,field.y,crop.rawDefinition[76]||undefined);
  if(!crop.rawDefinition[76]){
    expectedGame.dispatch({type:'edit-field-plan',fieldSlot:1,week,action:{kind:'harvest'}});
    expectedGame.dispatch({type:'edit-field-plan',fieldSlot:1,week:week+1,action:{kind:'clear'}});
  }else{
    expectedGame.dispatch({type:'edit-field-plan',fieldSlot:1,week:scenario.farm.calendar.month*4+scenario.farm.calendar.week+1,action:{kind:'harvest'}});
  }
  await expect(page.locator('#field-status')).toContainText('Growing');
  await expect(page.locator('#harvest-field')).toHaveCount(0);
  await expect(page.locator('#plant-field')).toHaveCount(0);
  await page.clock.runFor(1000);
  await expect(page.locator('#field-status')).toContainText('Growing');
  for (let day = 0; day < daysUntil+12; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click();expectedGame.dispatch({type:'advance-day'}); }
  await expect(page.locator('#field-status')).toContainText(crop.rawDefinition[62] & 1 ? 'Growing' : 'Waiting');
  // SCEN0's other grape and almond fields also harvest on their saved annual dates.
  await expect(page.locator('#harvest-stock')).toHaveText(id === 0 ? '13 stored harvests' : '1 stored harvest');
  await selectSaleOffer(page, name => name.startsWith(`Sell ${crop.name},`));
  const lot=expectedGame.getSnapshot().scenario.inventory.find(i=>i.active&&i.type===168+field.cropSlot)!;
  await expect(page.locator('#harvest-items')).toContainText(`${crop.name} · Quantity ${quantity} · Loss ${Math.floor(lot.loss*100/65535)}%`);
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save',exact:true}).click();
  expect(JSON.parse(readFileSync((await (await pending).path())!,'utf8'))).toEqual(JSON.parse(expectedGame.save(id)));
  await expect(page.locator('#harvest-progress')).toHaveCount(0);
  await expect(page.locator('#plant-field')).toHaveCount(0);
  if (!(crop.rawDefinition[62] & 1)) await expect(page.locator('#harvest-field')).toHaveCount(0);
  await page.screenshot({ path: `artifacts/browser-harvest-${id}.png`, fullPage: true });
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('1');
  await expect(page.locator('#harvest-stock')).toHaveText('No stored harvests.');
  await expect(page.locator('#harvest-result')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a planted original corn crop grows, is harvested and sold through browser controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install();
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  const initial=readScenario(readFileSync(new URL('../../../simfarm-dos/SCEN4.SSM',import.meta.url)));
  await schedulePlant(page,initial.fields[1].x,initial.fields[1].y,initial.farm.calendar.month*4+initial.farm.calendar.week+1,0);
  for(let day=0;day<7-initial.farm.calendar.day;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();}
  for (let day = 0; day < 84; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#field-status')).toContainText('Growing');
  await expect(page.locator('#harvest-estimate')).not.toContainText('value: $0,');
  const previousLots = await saleOffers(page);
  const {daysUntil}=await scheduleNextHarvest(page,initial.fields[1].x,initial.fields[1].y);
  for(let day=0;day<daysUntil+1;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();}
  await expect(page.locator('#harvest-stock')).toHaveText('4 stored harvests');
  const newLots = (await saleOffers(page))
    .filter(name => !previousLots.some(old => old?.split(', for ')[0] === name.split(', for ')[0]));
  expect(newLots).toHaveLength(1);
  await openWindow(page, 'sell');
  await selectSaleOffer(page, name => name === newLots[0]);
  const sell = page.getByRole('button', { name: newLots[0], exact: true });
  const amount = Number((await sell.getAttribute('aria-label'))!.split(', for $')[1]);
  const cash = Number((await page.locator('#farm-cash').textContent())!.replace(/[^0-9]/g, ''));
  expect(amount).toBeGreaterThan(0);
  await sell.click();
  await expect(page.locator('#farm-cash')).toHaveText(`$${(cash + amount).toLocaleString('en-US')}`);
  await expect(page.locator('#sale-result')).toHaveText(`Harvest sold for $${amount.toLocaleString('en-US')}.`);
  await expect(page.locator('#harvest-stock')).toHaveText('3 stored harvests');
  await expect(sell).toHaveCount(0);
  await expect(page.locator('#plant-field')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/browser-farming-cycle.png', fullPage: true });
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('0');
  await expect(page.locator('#sale-result')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('speed slider adjusts running time, stays paused and keeps Next day to one day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  // Optional disaster dialogs pause browser time; their suspension is tested separately.
  await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Messages',exact:true}).click();
  await openWindow(page, 'speed');
  const slider = page.getByRole('slider', { name: 'Speed', exact: true });
  await expect(page.locator('#simulation-speed-value')).toHaveText('1×');
  await slider.focus(); await slider.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', '16× simulation speed');
  await page.clock.runFor(1000);
  await expect(page.locator('#time-status')).toHaveText('Paused · 0 days advanced');
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#time-status')).toHaveText('Paused · 1 days advanced');
  await slider.focus(); await slider.press('Home');
  await expect(page.locator('#simulation-speed-value')).toHaveText('0.25×');
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await page.clock.runFor(16400);
  await expect(page.locator('#time-status')).toHaveText('Running · 2 days advanced');
  await slider.focus(); await slider.press('End');
  await page.clock.runFor(4000);
  await expect(page.locator('#time-status')).toHaveText('Running · 18 days advanced');
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click();
  await page.clock.runFor(1000);
  await expect(page.locator('#time-status')).toHaveText('Paused · 18 days advanced');
  await page.screenshot({ path: 'artifacts/browser-speed.png', fullPage: true });
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#simulation-speed-value')).toHaveText('1×');
  await expect(page.locator('#time-status')).toHaveText('Paused · 0 days advanced');
  await page.setViewportSize({ width: 1280, height: 844 });
  await openWindow(page, "speed"); await expect(slider).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});

test('map tools buy original land and complete a new-field planting and harvest cycle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('0.5');
  await plantField(page,0,16);
  await expect(page.locator('#field-tool-result')).toContainText('Buy all the land');
  await selectProperty(page,0,2);
  await expect(page.locator('.overview-land-value')).toHaveText('18060');
  await page.screenshot({ path: 'artifacts/browser-land-purchase.png', fullPage: true });
  await buyPlot(page,0,2);
  await expect(page.locator('#farm-cash')).toHaveText('$21,940');
  await expect(page.locator('#map-land-result')).toHaveText('Bought plot at 0, 16 for $18,060.');
  await plantField(page,0,16);
  await expect(page.locator('#field-tool-result')).toContainText('Terrain blocks');
  await setAutoDoze(page,true);await clickFarmTile(page,0,16);
  await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  await expect(page.locator('#field')).toHaveValue('9');
  await expect(page.locator('#field option')).toHaveCount(10);
  await expect(page.locator('#field-status')).toHaveText('Field 9 · Planting · 8 × 8 tiles at 0, 16');
  await expect(page.locator('#farm-cash')).toHaveText('$21,888');
  await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  for (let day = 0; day < 12; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#field-status')).toContainText('Growing');
  // Original unowned soil is poor; this checks new-field work and delivery, not a profitable crop.
  await expect(page.locator('#harvest-estimate')).toContainText('value: $0,');
  await page.screenshot({ path: 'artifacts/browser-new-field.png', fullPage: true });
  const {daysUntil}=await scheduleNextHarvest(page,0,16);
  for (let day = 0; day < daysUntil+12; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#harvest-stock')).toHaveText('1 stored harvest');
  await reveal(page, '.sell-harvest'); await page.locator('.sell-harvest').click();
  await expect(page.locator('#harvest-stock')).toHaveText('No stored harvests.');
  await expect(page.locator('#field-status')).toContainText('Waiting');
  await expect(page.locator('#plant-field')).toHaveCount(0);
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('0');
  await expect(page.locator('#map-tool')).toHaveCount(0);
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.locator('#options-menu-button').click();
  await expect(page.getByRole('menuitemcheckbox',{name:'AutoDoze',exact:true})).toHaveAttribute('aria-checked','true');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  expect(errors).toEqual([]);
});

test('fertilizing a new original plot produces a valuable corn harvest through browser controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();
  await reveal(page, '#disasters-enabled'); await page.locator('#disasters-enabled').uncheck();
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('0.5');
  await buyPlot(page,0,2);await setAutoDoze(page,true);await plantField(page,0,16);
  await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  for (let day = 0; day < 2; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#field-status')).toContainText('Growing');
  await sprayField(page,0,16,'fertilizer');
  await expect(page.locator('#field-status')).toContainText('Fertilize');
  await expect(page.locator('#field-tool-result')).toHaveText('Treatment ordered.');
  await expect(page.locator('#farm-cash')).toHaveText('$21,613');
  await expect(page.locator('#plant-field')).toHaveCount(0);
  await expect(page.locator('#harvest-field')).toHaveCount(0);
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#field-status')).toContainText('Growing');
  await expect(page.locator('#field-growth')).toContainText('Fertility: 255 / 255');
  await page.screenshot({ path: 'artifacts/browser-fertilizer.png', fullPage: true });
  for (let day = 3; day < 84; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#harvest-estimate')).toContainText('value: $1,700');
  const {daysUntil}=await scheduleNextHarvest(page,0,16);
  for(let day=0;day<daysUntil+12;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();}
  // Scheduled replanting changes history after the weekly quote; the lot still sells at that quote.
  await selectSaleOffer(page,name=>/^Sell Corn, lot 5, for \$[1-9]/.test(name));
  const sale=page.locator('#catalog-sell'),price=Number((await sale.getAttribute('aria-label'))!.split(', for $')[1]);
  const cash=Number((await page.locator('#farm-cash').textContent())!.replace(/[^0-9]/g,''));
  await sale.click();await expect(page.locator('#farm-cash')).toHaveText(`$${(cash+price).toLocaleString('en-US')}`);
  await expect(page.locator('#harvest-stock')).toHaveText('4 stored harvests');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('0');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await expect(page.locator('#field-tool-result')).toBeEmpty();
  expect(errors).toEqual([]);
});

test('all four field treatments use original stored supplies and restore crop work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  const field=readScenario(readFileSync(new URL('../../../simfarm-dos/SCEN0.SSM',import.meta.url))).fields[1];
  for(const [name,status] of [['fertilizer','Fertilize'],['pesticide','Pesticide'],['herbicide','Herbicide'],['fungicide','Fungicide']]){
    const cash=await page.locator('#farm-cash').textContent();
    await sprayField(page,field.x,field.y,name);await expect(page.locator('#field-status')).toContainText(status);
    await expect(page.locator('#field-tool-result')).toHaveText('Treatment ordered.');await expect(page.locator('#farm-cash')).toHaveText(cash!);
    for(let day=0;day<8;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();}
    await expect(page.locator('#field-status')).toContainText('Growing');
  }
  await page.setViewportSize({width:1280,height:844});await reveal(page,'#viewport');await expect(page.getByRole('button',{name:'Spray',exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  expect(errors).toEqual([]);
});

test('saved new-field work survives a page reload and finishes the valuable farming cycle', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();
  await reveal(page, '#disasters-enabled'); await page.locator('#disasters-enabled').uncheck();
  await reveal(page, '#disasters-panel > summary'); await page.locator('#disasters-panel > summary').click();
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('0.5');
  await buyPlot(page,0,2);await setAutoDoze(page,true);await plantField(page,0,16);
  await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  for (let day = 0; day < 2; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await sprayField(page,0,16,'fertilizer');
  await expect(page.locator('#field-status')).toContainText('Fertilize');
  const date = await page.locator('#farm-date').textContent();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.simfarm\.json$/);
  const path = 'artifacts/browser-farm.simfarm.json'; await download.saveAs(path);
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  const schedule = Buffer.from(saved.scenario.schedule, 'hex');
  const newFieldPlan = (week: number) => schedule.readUInt16LE((week * 98 + 8) * 2);
  // SCEN4 starts at week 15/day 6: planting records week 15, fertilizer two days later records week 16.
  expect([newFieldPlan(0), newFieldPlan(15), newFieldPlan(16), newFieldPlan(28)]).toEqual([209, 832, 915, 440]);
  await page.reload();
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Load Game', exact: true }).click();
  await (await chooserPromise).setFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await expect(page.locator('#scenario')).toHaveValue('4');
  await expect(page.locator('#farm-date')).toHaveText(date!);
  await expect(page.locator('#time-status')).toHaveText('Paused · 2 days advanced');
  await expect(page.locator('#farm-cash')).toHaveText('$21,613');
  await expect(page.locator('#field')).toHaveValue('');
  await reveal(page, '#field'); await page.locator('#field').selectOption('9');
  await expect(page.locator('#field-status')).toContainText('Fertilize');
  const restoredDownload = page.waitForEvent('download');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const restoredPath = 'artifacts/browser-restored-plan.simfarm.json';
  await (await restoredDownload).saveAs(restoredPath);
  expect(JSON.parse(readFileSync(restoredPath, 'utf8')).scenario.schedule).toBe(saved.scenario.schedule);
  await page.screenshot({ path: 'artifacts/browser-load.png', fullPage: true });
  for (let day = 2; day < 84; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#harvest-estimate')).toContainText('value: $1,700');
  const {daysUntil}=await scheduleNextHarvest(page,0,16);
  for(let day=0;day<daysUntil+12;day++){await reveal(page,'#next-day');await page.locator('#next-day').click();}
  await selectSaleOffer(page,name=>/^Sell Corn, lot 5, for \$[1-9]/.test(name));
  const sale=page.locator('#catalog-sell'),price=Number((await sale.getAttribute('aria-label'))!.split(', for $')[1]);
  const cash=Number((await page.locator('#farm-cash').textContent())!.replace(/[^0-9]/g,''));
  await sale.click();await expect(page.locator('#farm-cash')).toHaveText(`$${(cash+price).toLocaleString('en-US')}`);
  await page.setViewportSize({ width: 1280, height: 844 });
  await reveal(page, '#save-farm'); await page.locator('#save-farm').scrollIntoViewIfNeeded();
  await reveal(page, '#save-farm'); await expect(page.locator('#save-farm')).toBeVisible();
  await reveal(page, '#load-farm'); await expect(page.locator('#load-farm')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  expect(errors).toEqual([]);
});

test('loading preserves running speed and partial ticks; corrupt files leave the current farm intact', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2026-01-01T00:00:01Z'));
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  await openWindow(page, 'speed'); await page.getByRole('slider', { name: 'Speed', exact: true }).fill('4'); // 4×
  await reveal(page, '#play-pause'); await page.locator('#play-pause').click(); await page.clock.runFor(1748);
  async function saved() {
    const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
    const file = await pending; return readFileSync((await file.path())!, 'utf8');
  }
  const text = await saved(), expected = JSON.parse(text);
  expect(expected.runtime.paused).toBe(false); expect(expected.runtime.speed).toBe(4);
  expect(expected.runtime.dayTicks).toBeGreaterThan(0);
  for (const text of ['{}', 'x'.repeat(1_000_001), JSON.stringify({ ...expected, version: 99 })]) {
    await page.locator('#load-farm-file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(page.locator('#save-status')).toContainText('Could not load farm:');
    expect(JSON.parse(await saved())).toEqual(expected);
  }
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#time-status')).toHaveText('Paused · 0 days advanced');
  const file = { name: 'farm.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(text) };
  await page.locator('#load-farm-file').setInputFiles(file);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  expect(JSON.parse(await saved())).toEqual(expected);
  await expect(page.locator('#play-pause')).toHaveText('Pause');
  await expect(page.locator('#simulation-speed-value')).toHaveText('4×');
  await expect(page.locator('#next-day')).toBeDisabled();
  // Reopening the same file triggers a fresh load; the input clears after each selection.
  await page.locator('#load-farm-file').setInputFiles(file);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  expect(JSON.parse(await saved())).toEqual(expected);
  const legacy = JSON.parse(text); useOriginalCatalog(legacy); legacy.version = 1; delete legacy.scenario.schedule; delete legacy.scenario.irrigation;
  delete legacy.runtime.animalFrame; delete legacy.runtime.market; delete legacy.runtime.traffic; delete legacy.runtime.setup;
  const crops = expected.scenario.cropFiles.map((file: string) => readCrop(file.replace('.crp', ''),
    readFileSync(new URL('../../../simfarm-dos/CROPS/' + file.toUpperCase(), import.meta.url))));
  // V1 also lacked finance state, including species counts changed by live births.
  const originalFinance = JSON.parse(new GameSimulation(readScenario(Buffer.from(expected.scenario.source, 'hex')), crops).withAllCrops(browserCrops).save(0)).runtime.finances;
  await page.locator('#load-farm-file').setInputFiles({ name: 'old-farm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(legacy)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  // Pre-v9 saves lacked water waves; pre-v10 saves lacked animal frame state.
  // Clocks/cache migrate once; missing traffic stays empty without RNG replay.
  // V1 never recorded terrain history, so the migration keeps it unknown.
  expect(JSON.parse(await saved())).toEqual({ ...expected,
    runtime: { ...expected.runtime, setup: { terrainHistory: null, sourceArchive: null, previewRaw: null, climateSelection: null },
      originalPause: { depth: null, speedChecks: [null, null, null, null, null] },
      finances: originalFinance, animalFrame: { lastCentreTick: 0, lastMoveTick: 0, herd: '00'.repeat(21) },
      traffic: { records: Array.from({ length: 16 }, () => Array(8).fill(0)), activeCount: 0, delay: 16, lastTick: 0 },
      market: { history: expected.runtime.cropMarketPrices.map((price: number) => [...Array(29).fill(null), price]), mood: 0, rawBC72: 0 } },
    scenario: { ...expected.scenario,
    farm: { ...expected.scenario.farm, equipmentPacingByte: null },
    irrigation: { ...expected.scenario.irrigation, phase: 0, lastTick: 0, active: false, flow: [] } } });
  // Migration restores source Messages=true; isolate clock continuation from optional notices.
  await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Messages',exact:true}).click();
  await page.clock.runFor(4400);
  await expect(page.locator('#time-status')).toContainText('Running · 6 days advanced');
});

test('failed or cancelled asset loading cannot replace a current farm', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#map-status')).toHaveText('Scenario 1 · original terrain');
  const pendingDownload = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const file = { name: 'farm.json', mimeType: 'application/json', buffer: readFileSync((await (await pendingDownload).path())!) };
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await page.route('**/scenario0.tiles.png', route => route.abort());
  await page.locator('#load-farm-file').setInputFiles(file);
  await expect(page.locator('#save-status')).toContainText('Could not load farm:');
  await expect(page.locator('#time-status')).toHaveText('Paused · 1 days advanced');
  await expect(page.locator('#scenario')).toHaveValue('4');
  await page.unroute('**/scenario0.tiles.png');
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const requestSeen = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/scenario0.tiles.png', async route => { requested(); await held; await route.abort(); });
  await page.locator('#load-farm-file').setInputFiles(file); await requestSeen;
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('2');
  await expect(page.locator('#map-status')).toHaveText('Scenario 3 · original terrain');
  release();
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#scenario')).toHaveValue('2');
  await expect(page.locator('#time-status')).toHaveText('Paused · 1 days advanced');
  expect(errors).toEqual([]);
});


test('a farm saved while a harvest truck drives to storage loads and completes delivery', async ({ page }) => {
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const scenario = readScenario(source('SCEN1.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const game = new GameSimulation(scenario, crops).withAllCrops(browserCrops);
  game.dispatch({ type: 'harvest-field', fieldSlot: 1 }); game.dispatch({ type: 'set-paused', paused: false });
  for (let tick = 0; tick < 2048 && game.getSnapshot().scenario.fields[1].step !== 15; tick++) game.tick(4000 / (scenario.farm.dayDelayTicks + 1));
  expect(game.getSnapshot().scenario.fields[1].step).toBe(15);
  game.dispatch({ type: 'set-paused', paused: true });
  await page.goto('/'); await expect(page.locator('#save-farm')).toBeEnabled();
  await page.locator('#load-farm-file').setInputFiles({ name: 'truck.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(game.save(1)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await expect(page.locator('#field-status')).toContainText('Harvest');
  for (let day = 0; day < 8; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#harvest-stock')).toHaveText('1 stored harvest');
  await expect(page.locator('#field-status')).toContainText('Waiting');
});

test('original field plans harvest and replant automatically through the browser clock', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await expect(page.locator('#schedule-status')).toHaveText('Field plans run automatically each week.');
  for (let day = 0; day < 78; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#field-status')).toContainText('Harvest');
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  for (let day = 78; day < 85; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#field-status')).toContainText('Planting');
  await expect(page.locator('#farm-cash')).toHaveText('$39,848');
  await expect(page.locator('#harvest-stock')).toHaveText('4 stored harvests');
  await reveal(page, '.sell-harvest'); const sell = page.locator('.sell-harvest').first();
  const amount = Number((await sell.getAttribute('aria-label'))!.split(', for $')[1]);
  expect(amount).toBeGreaterThan(0);
  await sell.click();
  await expect(page.locator('#farm-cash')).toHaveText(`$${(39848 + amount).toLocaleString('en-US')}`);
  await page.screenshot({ path: 'artifacts/browser-automatic-plans.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('weekly seed failure is reported without replacing crops or spending cash', async ({ page }) => {
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const scenario = readScenario(source('SCEN4.SSM'));
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  scenario.farm.cash = 0;
  Object.assign(scenario.farm.calendar, { month: 0, week: 0, day: 6 });
  scenario.schedule.set(1, 0, 832);
  const game = new GameSimulation(scenario, crops).withAllCrops(browserCrops);
  await page.goto('/');
  await page.locator('#load-farm-file').setInputFiles({ name: 'no-seed-cash.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#schedule-status')).toHaveText('Weekly orders stopped at field 1: not enough cash for seed.');
  await expect(page.locator('#field-status')).toContainText('Growing');
  await expect(page.locator('#farm-cash')).toHaveText('$0');
});

test('calendar planner edits five years, preserves saved plans and dispatches the edited orders', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#map-status')).toHaveText('Scenario 5 · original terrain');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await openWindow(page,'schedule');
  await (await scheduleWeek(page,15)).click();
  await expect(page.locator('#plan-result')).toHaveText('Choose a future week.');
  await page.locator('[data-plan-crop="15"]').click(); await (await scheduleWeek(page,16)).click();
  await expect(page.locator('#plan-selection')).toContainText('Plant Peanuts');
  await expect(page.locator('#field-status')).toContainText('Growing');
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  await page.locator('[data-plan-action="fertilizer"]').click(); await page.locator('[data-plan-week="16"]').click();
  await expect(page.locator('#plan-result')).toContainText('already has planting');
  await page.locator('[data-plan-week="17"]').click();
  await expect(page.locator('#plan-selection')).toContainText('Fertilize');
  await page.locator('[data-plan-crop="7"]').click(); await (await scheduleWeek(page,239)).click();
  await expect(page.locator('#plan-selection')).toContainText('December 22–28, 1997');
  await expect(page.locator('#plan-selection')).toContainText('Plant Soybeans');
  const pending = page.waitForEvent('download');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = 'artifacts/browser-edited-plan.simfarm.json'; await (await pending).saveAs(path);
  const saved = JSON.parse(readFileSync(path, 'utf8')), plan = Buffer.from(saved.scenario.schedule, 'hex');
  expect([16, 17, 239].map(w => plan.readUInt16LE(w * 196))).toEqual([847, 915, 839]);
  await page.reload();
  await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await openWindow(page,'schedule');
  await expect(page.locator('#plan-selection')).toContainText('Plant Peanuts');
  await page.setViewportSize({ width: 1280, height: 844 });
  await reveal(page, '#field-planner'); await page.locator('#field-planner').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-field-planner.png', fullPage: true });
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#field-status')).toContainText('Planting');
  await expect(page.locator('#field option:checked')).toContainText('Peanuts');
  for (let day = 0; day < 7; day++) { await reveal(page, '#next-day'); await page.locator('#next-day').click(); }
  await expect(page.locator('#field-status')).toContainText('Fertilize');
  expect(errors).toEqual([]);
});

test('planner locks current prices, respects fixed harvests and clears future work', async ({ page }) => {
  await page.goto('/');
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await openWindow(page,'schedule');
  const current = page.locator('.plan-calendar [aria-current="date"]');
  const week = Number(await current.getAttribute('data-plan-week'));
  await page.locator('[data-plan-action="contract"]').click(); await current.click();
  await expect(page.locator('#plan-selection')).toContainText('Price contract');
  await current.click(); await expect(page.locator('#plan-result')).toContainText('already has a price contract');
  await expect(page.locator('#farm-cash')).toHaveText('$40,000');
  await page.locator('[data-plan-action="harvest"]').click(); await (await scheduleWeek(page,week+1)).click();
  await expect(page.locator('#plan-result')).toContainText('fixed annual harvest week');
  await page.locator('#field-message-ok').click();
  await page.getByRole('button',{name:'Clear remaining plan',exact:true}).click(); await page.locator(`[data-plan-week="${week+1}"]`).click();
  await expect(page.locator('#plan-selection')).toContainText('Fallow');
  await (await scheduleWeek(page,239)).focus(); await expect(page.locator('#plan-selection')).toContainText('Fallow');
  await reveal(page, '#scenario'); await page.locator('#scenario').selectOption('4');
  await expect(page.locator('#plan-result')).toHaveCount(0);
  await reveal(page, '#field'); await page.locator('#field').selectOption('1');
  await openWindow(page,'schedule');
  await page.locator('[data-plan-action="harvest"]').click(); await (await scheduleWeek(page,17)).click();
  await expect(page.locator('#plan-selection')).toContainText('Harvest');
  await page.locator('[data-plan-week="18"]').focus(); await expect(page.locator('#plan-selection')).toContainText('Fallow');

});

test('Loans panel borrows, quotes installments, saves balances and pays off through React', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('original terrain');
  const cash = await page.locator('#farm-cash').textContent();
  await openWindow(page, 'bank');
  await reveal(page, '#loan-amount'); await page.locator('#loan-amount').fill('0'); await expect(page.locator('#borrow-loan')).toBeEnabled();
  await reveal(page, '#loan-amount'); await page.locator('#loan-amount').fill('1000'); await expect(page.locator('#loan-quote')).toContainText('$57');
  await reveal(page, '#borrow-loan'); await page.locator('#borrow-loan').click();
  await expect(page.locator('#loan-balance')).toHaveText('$1,000'); await expect(page.locator('#loan-installment')).toHaveText('$57');
  await expect(page.locator('#loan-result')).toHaveText('Borrowed $1,000.');
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const download = await pending, path = 'artifacts/browser-loan.simfarm.json'; await download.saveAs(path);
  expect(JSON.parse(readFileSync(path, 'utf8')).runtime.finances.loan.principal).toBe(1000);
  await page.reload(); await page.locator('#load-farm-file').setInputFiles(path);
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await openWindow(page, 'bank'); await expect(page.locator('#loan-balance')).toHaveText('$1,000');
  await page.setViewportSize({ width: 1280, height: 844 });
  await reveal(page, '#loan-panel'); await page.locator('#loan-panel').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await page.screenshot({ path: 'artifacts/browser-loans.png', fullPage: true });
  await reveal(page, '#repay-loan'); await page.locator('#repay-loan').click();
  await expect(page.locator('#loan-balance')).toHaveText('$0'); await expect(page.locator('#loan-installment')).toHaveText('$0');
  await expect(page.locator('#farm-cash')).toHaveText(cash!); await expect(page.locator('#repay-loan')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('loaded loans collect the March installment at the month boundary', async ({ page }) => {
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const scenario = readScenario(source('SCEN4.SSM')); scenario.schedule.bytes.fill(0);
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const game = new GameSimulation(scenario, crops).withAllCrops(browserCrops); game.dispatch({ type: 'borrow', amount: 1000 });
  const save = JSON.parse(game.save(4));
  Object.assign(save.scenario.farm.calendar, { day: 6, week: 3, month: 1 }); save.scenario.farm.cash = 4000;
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles({ name: 'loan.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.'); await openWindow(page, 'bank');
  await reveal(page, '#next-day'); await page.locator('#next-day').click();
  await expect(page.locator('#farm-date')).toContainText('March 1');
  await expect(page.locator('#loan-balance')).toHaveText('$943'); await expect(page.locator('#farm-cash')).toHaveText('$3,943');
});

test('saved financial default stops time and actions, supports ending or restarting the farm', async ({ page }) => {
  const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
  const scenario = readScenario(source('SCEN4.SSM')); scenario.schedule.bytes.fill(0);
  const crops = scenario.cropFiles.map(file => readCrop(file.replace('.crp', ''), source(`CROPS/${file.toUpperCase()}`)));
  const initial = new GameSimulation(scenario, crops).withAllCrops(browserCrops), save = JSON.parse(initial.save(4));
  Object.assign(save.scenario.farm.calendar, { day: 6, week: 3, month: 0 }); save.scenario.farm.cash = 0;
  Object.assign(save.runtime.finances.debt, { balanceDue: 0xffffffff, balanceCountdown: 1 });
  const game = GameSimulation.load(JSON.stringify(save), browserCrops).simulation.withAllCrops(browserCrops); game.dispatch({ type: 'advance-day' });
  expect(game.getSnapshot().finances.defaultDecision?.status).toBe('pending');
  const file = { name: 'default.simfarm.json', mimeType: 'application/json', buffer: Buffer.from(game.save(4)) };
  await page.goto('/'); await page.locator('#load-farm-file').setInputFiles(file);
  await expect(page.getByRole('region', { name: 'Financial default', exact: true })).toBeVisible();
  await expect(page.locator('#play-pause')).toBeDisabled(); await expect(page.locator('#next-day')).toBeDisabled();
  await openWindow(page, 'bank'); await expect(page.locator('#borrow-loan')).toBeDisabled();
  await reveal(page, '#default-exit'); await page.locator('#default-exit').click(); await expect(page.getByRole('region', { name: 'Farm session ended', exact: true })).toBeVisible();
  await expect(page.locator('#next-day')).toBeDisabled();
  await page.locator('#load-farm-file').setInputFiles(file); await reveal(page, '#default-restart'); await page.locator('#default-restart').click();
  await expect(page.getByRole('region', { name: 'Financial default', exact: true })).toHaveCount(0);
  await reveal(page, '.new-farm-panel'); await expect(page.locator('.new-farm-panel')).toBeVisible(); await expect(page.locator('#next-day')).toBeDisabled();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Farm session ended', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Choose another farm', exact: true }).click();
  await reveal(page, '#region-design'); await page.locator('#region-design').click(); await reveal(page, '#play-farm'); await page.locator('#play-farm').click();
  await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');
  await expect(page.locator('#next-day')).toBeEnabled(); await expect(page.locator('#time-status')).toContainText('0 days advanced');
  await openWindow(page, 'bank'); await expect(page.locator('#loan-overdue')).toHaveCount(0);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
