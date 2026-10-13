import {readSaveText} from '../support/save-file';
import {toggleOption} from '../support/options-menu';
import { selectSupply } from '../support/supply-actions';
import { schedulePlant, expectWeekPlan } from '../support/schedule-window';
import { buyBuilding } from '../support/building-actions';
import { clickFarmTile, sprayField } from '../support/field-actions';
import { reveal, expectFarmCash , speedItem, expectNoHorizontalOverflow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { disasterFixture } from '../support/disasters';
import { shopFixture } from '../support/livestock';
import { readArchive } from '../../src/formats/archive';
import { decodePlanar, readPalette } from '../../src/formats/graphics';
import { readScenario, worldIndex } from '../../src/formats/scenario';

async function load(page: Page, text: string) {
  await page.locator('#load-farm-file').setInputFiles({ name: 'supplies.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save to File...', exact: true }).click();
  const file = 'artifacts/browser-crop-shop.simfarm.json'; await (await pending).saveAs(file); return JSON.parse(readSaveText(file));
}
async function selectTile(page: Page, x: number, y: number) {
  await page.locator('#viewport').evaluate((el, p) => el.scrollTo(p.x * 16, p.y * 16), { x, y });
  await reveal(page, '#viewport'); await page.locator('#viewport').scrollIntoViewIfNeeded(); const rect = await page.locator('#world').boundingBox();
  await page.mouse.click(rect!.x + x * 16 + 8, rect!.y + y * 16 + 8);
}
async function originalPixels(page: Page, x: number, y: number, tile: number, overlay?: number) {
  const source = (name: string) => readFileSync(new URL('../../../simfarm-dos/' + name, import.meta.url));
  const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA')), asset = (n: string) => archive.find(e => e.name === n)!.bytes;
  const palette = readPalette(asset('simfarm.pal'));
  // Crop uploads0x468c2..0x46a13 replace the base atlas's seed/harvest placeholders.
  const cropSlot = tile >= 832 && tile <= 847 ? tile - 832 : tile >= 816 && tile <= 831 ? tile - 816 : null;
  const raw = cropSlot === null ? asset('ega16til.til').subarray(tile * 128, (tile + 1) * 128)
    : source('CROPS/' + readScenario(source('SCEN4.SSM')).cropFiles[cropSlot].toUpperCase()).subarray(tile >= 832 ? 0x1480 : 0x1400, tile >= 832 ? 0x1500 : 0x1480);
  const expected = decodePlanar(raw, 16, 16, palette).rgba;
  if (overlay !== undefined) {
    const index = overlay - 848, masked = decodePlanar(asset('mskdtile.til').subarray(index * 128, (index + 1) * 128), 16, 16, palette, 7).rgba;
    for (let p = 0; p < expected.length; p += 4) if (masked[p + 3]) expected.set(masked.subarray(p, p + 4), p);
  }
  expect(await page.locator('#world').evaluate((c: HTMLCanvasElement, p) => Array.from(c.getContext('2d')!.getImageData(p.x * 16, p.y * 16, 16, 16).data), { x, y })).toEqual(Array.from(expected));
}

async function audio(page: Page) {
  await page.addInitScript(() => {
    const Base = window.AudioContext;
    Object.assign(window, { supplyAudio: [] as { length: number; peak: number }[] });
    window.AudioContext = class extends Base {
      constructor(options?: AudioContextOptions) {
        super(options); const make = this.createBufferSource.bind(this);
        this.createBufferSource = () => {
          const source = make(), start = source.start.bind(source);
          source.start = (...args) => {
            const entry = { length: source.buffer?.length ?? 0, peak: 0 }, analyser = this.createAnalyser(); source.connect(analyser);
            (window as unknown as { supplyAudio: typeof entry[] }).supplyAudio.push(entry);
            const timer = setInterval(() => {
              const data = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(data);
              entry.peak = Math.max(entry.peak, ...Array.from(data, Math.abs));
            }, 10);
            source.addEventListener('ended', () => clearInterval(timer)); start(...args);
          };
          return source;
        };
      }
    };
  });
}
const played = (page: Page) => page.evaluate(() => (window as unknown as { supplyAudio: { length: number; peak: number }[] }).supplyAudio);


test('supply controls buy original stock, plays feedback, preserves checkpoints and supplies live planting and care', async ({ page }) => {
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await audio(page);await page.goto('/');
  const f=disasterFixture();f.state.scenario.farm.autoBuySeeds=false;const g=f.load().withAllCrops(browserCrops);
  g.dispatch({type:'build',buildingType:67,x:10,y:10});g.dispatch({type:'toggle-building-interior',slot:1,x:10,y:10});
  await load(page,g.save(4));await toggleOption(page,'Sound Effects');
  for(const productType of [196,220,221,222,223]){
    await selectSupply(page,productType);await clickFarmTile(page,10,10);
    g.dispatch({type:'buy-crop-supply',productType,x:10,y:10});await expectFarmCash(page,g.getSnapshot().scenario.farm.cash);
    expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  }
  await expect.poll(async()=>(await played(page)).some(s=>s.length===1389 && s.peak>0.01)).toBe(true);
  await selectTile(page,12,12);
  await originalPixels(page,10,10,836);await originalPixels(page,10,11,217,915);await originalPixels(page,10,12,217,914);
  await originalPixels(page,11,10,217,913);await originalPixels(page,11,11,217,912);
  const sounds=(await played(page)).length;await load(page,g.save(4));
  expect((await played(page)).length).toBe(sounds);
  await schedulePlant(page,20,20,1,4);g.dispatch({type:'edit-field-plan',fieldSlot:1,week:1,action:{kind:'plant',cropSlot:4}});
  await expectWeekPlan(page,1,/Plant /);
  for(let n=0;n<7;n++){await (await speedItem(page,'#next-day')).click();g.dispatch({type:'advance-day'});}
  expect(g.getSnapshot().scenario.inventory.some(i=>i.active&&i.type===196)).toBe(false);
  for(let n=0;n<10 && g.getSnapshot().scenario.fields[1].state!==4;n++){await (await speedItem(page,'#next-day')).click();g.dispatch({type:'advance-day'});}
  await sprayField(page,g.getSnapshot().scenario.fields[1].x,g.getSnapshot().scenario.fields[1].y,'fertilizer');g.dispatch({type:'treat-field',fieldSlot:1,treatment:'fertilizer'});
  expect(g.getSnapshot().lastTreatmentResult).toMatchObject({ok:true,source:'stored'});
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));expect(errors).toEqual([]);
});

test('supply shop explains storage and money limits, supports building and map selection, and fits390px', async ({ page })=>{
  const f=shopFixture(),g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
  const before=g.save(4);await selectSupply(page,192);await clickFarmTile(page,10,10);
  await expectFarmCash(page,g.getSnapshot().scenario.farm.cash);
  expect(await save(page)).toEqual(JSON.parse(before));
  await buyBuilding(page,66,10,10);g.dispatch({type:'build',buildingType:66,x:10,y:10});
  await selectSupply(page,192);
  for(let n=0;n<6;n++){await clickFarmTile(page,10,10);g.dispatch({type:'buy-crop-supply',productType:192,x:10,y:10});}
  await clickFarmTile(page,10,10);await expectFarmCash(page,g.getSnapshot().scenario.farm.cash);
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  const other=shopFixture();other.state.scenario.farm.cash=2000;const fresh=other.load().withAllCrops(browserCrops);fresh.dispatch({type:'build',buildingType:64,x:20,y:20});
  await load(page,fresh.save(4));await selectSupply(page,220);
  await clickFarmTile(page,20,20);await expectFarmCash(page,fresh.getSnapshot().scenario.farm.cash);
  await clickFarmTile(page,21,20);await expectFarmCash(page,fresh.getSnapshot().scenario.farm.cash);
  expect(await save(page)).toEqual(JSON.parse(fresh.save(4)));
  // Use a newly built store with free room to exercise cash rejection, not capacity.
  const ready=shopFixture().load().withAllCrops(browserCrops);ready.dispatch({type:'build',buildingType:67,x:10,y:10});const broke=JSON.parse(ready.save(4));broke.scenario.farm.cash=0;
  await load(page,JSON.stringify(broke));await selectSupply(page,192);await clickFarmTile(page,10,10);
  await expectFarmCash(page,0);
  await page.setViewportSize({width:1280,height:844});await expectNoHorizontalOverflow(page);
  await page.screenshot({path:'artifacts/browser-crop-supplies.png',fullPage:true});expect(await save(page)).toEqual(broke);
});


// These cases test explicit audio enabling/muting; default-on behavior is covered by options.spec.ts.
test.beforeEach(async({page})=>{await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false,sound:false})));});
