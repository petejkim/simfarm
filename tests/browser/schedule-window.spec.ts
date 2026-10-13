import {readSaveText} from '../support/save-file';
import { declineTownEventDialogs } from '../support/town-event-dialogs';
import {loadScenarioCheckpoint} from '../support/scenario-checkpoint';
import { setDisastersEnabled } from '../support/disaster-menu';
import { openWindow, expectPaletteAction, chooseField, expectSelectedField , speedItem } from '../support/workspace';
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readScenario } from '../../src/formats/scenario';
import { readArchive } from '../../src/formats/archive';
import { readPalette, decodePlanar } from '../../src/formats/graphics';
import { browserCrops } from '../support/crop-catalog';
import { scheduleMonth, expectWeekPlan } from '../support/schedule-window';
import { buyPlot, setAutoDoze, plantField, sprayField, clickFarmTile } from '../support/field-actions';
import { reveal } from '../support/workspace';
import { selectSaleOffer } from '../support/sell-window';
import { GameSimulation } from '../support/game';
const source=(name:string)=>readFileSync(new URL('../../../simfarm-dos/'+name,import.meta.url));
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}

test('original map and Schedule controls complete harvest, storage, sale and replanting without immediate field orders',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await loadScenarioCheckpoint(page,4);
  await expect(page.locator('#map-status')).toContainText('Scenario 5');
  await setDisastersEnabled(page,false);
  await reveal(page,'#zoom');await page.locator('#zoom').selectOption('0.5');
  await buyPlot(page,0,2);await setAutoDoze(page,true);await plantField(page,0,16);
  await expectPaletteAction(page,'View object');
  async function days(count:number){for(let i=0;i<count;i++){await (await speedItem(page,'#next-day')).click();
    await declineTownEventDialogs(page);
  }}
  async function examine(){
    await reveal(page,'#viewport');await page.getByRole('button',{name:'View object',exact:true}).click();
    await clickFarmTile(page,0,16);await expect(page.getByRole('dialog',{name:'Schedule',exact:true})).toBeVisible();
    await expectSelectedField(page,9);
  }
  await days(2);await sprayField(page,0,16,'fertilizer');
  await days(82);await examine();
  expect(Number(await page.locator('#schedule-value').textContent())).toBeGreaterThan(0);
  const before=await save(page),calendar=before.scenario.farm.calendar;
  const harvestWeek=calendar.month*4+calendar.week+1;
  await scheduleMonth(page,Math.floor(harvestWeek/4));
  await page.locator('[data-plan-action="harvest"]').click();await page.locator(`[data-plan-week="${harvestWeek}"]`).click();
  await expectWeekPlan(page,harvestWeek,/Harvest/);
  const scheduled=await save(page);
  const snapshot=(checkpoint:unknown)=>GameSimulation.load(JSON.stringify(checkpoint),browserCrops).simulation.getSnapshot();
  expect(snapshot(scheduled).scenario.fields[9].state).toBe(4);
  expect(snapshot(scheduled).scenario.schedule.get(harvestWeek,8)).toBe(440);
  // Remove the generated repeat-plant plan so this cycle waits for our explicit replant order.
  await page.getByRole('button',{name:'Clear remaining plan',exact:true}).click();
  await page.locator(`[data-plan-week="${harvestWeek+1}"]`).click();
  await expectWeekPlan(page,harvestWeek+1,/Fallow/);
  // Seven days reach the next weekly order; allow the source machinery/delivery stages to finish.
  await days(10);
  const harvested=snapshot(await save(page)).scenario;
  expect(harvested.fields[9].state).toBe(0);
  expect(harvested.inventory[5].active).toBe(true);
  expect(harvested.inventory[5].type).toBe(168);
  const offers=page.locator('#catalog-sell');
  await selectSaleOffer(page,label=>/^Sell Corn, lot 5, for \$[1-9]/.test(label));
  const price=Number((await offers.getAttribute('aria-label'))!.match(/\$(\d+)$/)![1]);
  const cashBefore=(await save(page)).scenario.farm.cash;
  await offers.click();const sold=await save(page);
  expect(sold.scenario.farm.cash).toBe(cashBefore+price);
  expect(snapshot(sold).scenario.inventory[5].active).toBe(false);
  await examine();
  const afterSale=await save(page),now=afterSale.scenario.farm.calendar;
  const plantWeek=now.month*4+now.week+1;
  await scheduleMonth(page,Math.floor(plantWeek/4));
  await page.locator('[data-plan-crop="0"]').click();await page.locator(`[data-plan-week="${plantWeek}"]`).click();
  await expectWeekPlan(page,plantWeek,/Plant /);
  await days(12);await examine();
  await expect(page.locator('#field-planner .schedule-crop-name')).toContainText('Corn');
  // Read the persisted simulation, not the interim Field orders panel.
  const replanted=await save(page);
  expect(snapshot(replanted).scenario.fields[9].state).toBe(4);
  expect(snapshot(replanted).scenario.fields[9].bytes[34]).toBeLessThan(3);
  expect(errors).toEqual([]);
});

test('Schedule restores source geometry, field artwork, gauges, all24 crops and weather overlays without changing the farm',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');const before=await save(page);
  const world=readScenario(source('SCEN0.SSM')),field=world.fields[1],firstWeek=world.farm.calendar.month*4;
  await openWindow(page,'schedule');await chooseField(page,1);
  const dialog=page.getByRole('dialog',{name:'Schedule',exact:true});
  // Shared frame around a 320×216 client of components; no background bitmap or canvas.
  await expect(page.locator('.schedule-window').locator('img,canvas')).toHaveCount(0);
  await expect(page.locator('[data-plan-week]')).toHaveCount(12);await expect(page.locator('[data-plan-action]')).toHaveCount(6);
  await expect(page.locator('.schedule-label').filter({hasText:'Disease'})).toHaveText('Disease');
  // Disease gauge shows fldgrph.til frame floor(byte22/52) from the field-gauge sheet.
  // The whole 56×32 dial shows: the bitmap rim (source 16,168) with the 48×24 frame stacked at offset 8,8.
  const gauge=Math.floor(field.bytes[22]/52),disease=page.locator('.schedule-gauge').first(),frame=disease.locator('.schedule-gauge-frame');
  
  expect(await disease.locator('.sprite').first().evaluate(el=>[getComputedStyle(el).backgroundImage.includes('schedule-window'),getComputedStyle(el).backgroundPosition])).toEqual([true,'-16px -168px']);
  expect(await frame.evaluate(el=>[getComputedStyle(el).backgroundImage.includes('field-gauges'),getComputedStyle(el).backgroundPosition])).toEqual([true,`${-gauge*48}px 0px`]);
  await page.getByRole('button',{name:'Water overlay',exact:true}).click();
  const first=browserCrops.find(c=>`${c.id}.crp`===world.cropFiles[0])!;
  await expect(page.locator('[data-plan-crop="0"]')).toHaveText(String(first.rawDefinition[40]>>>1));
  await expect(page.locator(`[data-plan-week="${firstWeek}"]`)).toHaveText(String(world.climate.precipitation[firstWeek]));
  await page.getByRole('button',{name:'Temperature overlay',exact:true}).click();
  await expect(page.getByRole('button',{name:'Water overlay',exact:true})).toHaveAttribute('aria-pressed','false');
  await expect(page.locator(`[data-plan-week="${firstWeek}"]`)).toHaveText(String(world.climate.temperature[firstWeek]));
  await page.getByRole('button',{name:'Temperature overlay',exact:true}).click();
  // All twenty-four crops in three rows of eight; no crop pager.
  await expect(page.locator('[data-plan-crop]')).toHaveCount(24);await expect(page.getByRole('button',{name:/^(Next|Previous) crops$/})).toHaveCount(0);
  const crops=(await page.locator('.schedule-crops').boundingBox())!;
  await page.locator('[data-plan-crop="23"]').click();
  await expect(page.locator('[data-plan-crop="23"]')).toHaveAttribute('aria-pressed','true');
  // CUT leaves the previous tool badge in place (source behaviour).
  const toolBadge=()=>page.locator('.schedule-badge-column').last().locator('.sprite').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundPosition));
  const toolTiles=await toolBadge();expect(toolTiles).toHaveLength(4);
  await page.getByRole('button',{name:'Clear remaining plan',exact:true}).click();
  expect(await toolBadge()).toEqual(toolTiles);
  await scheduleMonth(page,57);await expect(page.locator('[data-plan-week="239"]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Next month',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'TODAY',exact:true}).click();await expect(page.locator('#schedule-month')).toHaveValue(String(world.farm.calendar.month));
  await page.screenshot({path:'artifacts/browser-schedule-window.png'});
  await page.getByRole('button',{name:'CLOSE',exact:true}).click();
  await page.getByRole('button',{name:'View object',exact:true}).click();
  const rect=(await page.locator('#world').boundingBox())!;
  await page.mouse.click(rect.x+(field.x+2)*16+8,rect.y+(field.y+2)*16+8);
  await expect(dialog).toBeVisible();await expectSelectedField(page,1);
  expect(await save(page)).toEqual(before);expect(errors).toEqual([]);
});

test('missing Schedule artwork fails before play',async({page})=>{
  await page.route('**/assets/field-gauges.png',route=>route.abort());await page.goto('/');
  await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();
  await expect(page.locator('.loading')).toContainText('field-gauges.png');await expect(page.locator('#world')).toHaveCount(0);
});


test('reexamining the same field resets Schedule to today without editing its plan or losing the selected tool',async({page})=>{
  await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before=await save(page),world=readScenario(source('SCEN0.SSM')),field=world.fields[1];
  await openWindow(page,'schedule');await chooseField(page,1);
  await page.locator('[data-plan-action="harvest"]').click();await page.getByRole('button',{name:'Water overlay',exact:true}).click();
  await scheduleMonth(page,57);await page.getByRole('button',{name:'CLOSE',exact:true}).click();
  // Reopening through map inspection resets browsing to today.
  await openWindow(page,'schedule');await expect(page.locator('#schedule-month')).toHaveValue(String(world.farm.calendar.month));
  await page.getByRole('button',{name:'CLOSE',exact:true}).click();await page.getByRole('button',{name:'View object',exact:true}).click();
  const rect=(await page.locator('#world').boundingBox())!;
  await page.mouse.click(rect.x+(field.x+2)*16+8,rect.y+(field.y+2)*16+8);
  await expect(page.getByRole('dialog',{name:'Schedule',exact:true})).toBeVisible();
  await expectSelectedField(page,1);await expect(page.locator('#schedule-month')).toHaveValue(String(world.farm.calendar.month));
  await expect(page.locator('[data-plan-action="harvest"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Water overlay',exact:true})).toHaveAttribute('aria-pressed','true');
  // Browsing after entry must remain possible; snapshots do not repeatedly reset the month.
  await scheduleMonth(page,5);await expect(page.locator('#schedule-month')).toHaveValue('5');expect(await save(page)).toEqual(before);
});
