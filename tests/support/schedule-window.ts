import { expect, type Page } from '@playwright/test';
import {readSaveText} from './save-file';
import { openWindow, reveal } from './workspace';
import { clickFarmTile } from './field-actions';
/** Use a real checkpoint to locate next week; all changes go through original controls.
 * CUT prevents the generated repeat plan from planting again before a harvest assertion. */
export async function scheduleNextHarvest(page:Page,x:number,y:number,fixedWeek?:number){
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save',exact:true}).click();
  const saved=JSON.parse(readSaveText((await (await pending).path())!));
  const calendar=saved.scenario.farm.calendar,week=calendar.month*4+calendar.week+1;
  await reveal(page,'#viewport');await page.getByRole('button',{name:'View object',exact:true}).click();
  await clickFarmTile(page,x,y);await scheduleMonth(page,Math.floor(week/4));
  await page.locator('[data-plan-action="harvest"]').click();await page.locator(`[data-plan-week="${week}"]`).click();
  if(fixedWeek!==undefined){
    // Fixed harvest week: the chosen week is rejected and keeps its existing plan.
    await expect(page.locator(`[data-plan-week="${week}"]`)).not.toHaveAttribute('aria-label',/Harvest/);
    await scheduleMonth(page,Math.floor(fixedWeek/4));
    await expect(page.locator(`[data-plan-week="${fixedWeek}"]`)).toHaveAttribute('aria-label',/Harvest/);
    return {week:fixedWeek,daysUntil:(fixedWeek-calendar.month*4-calendar.week)*7-calendar.day};
  }
  await expectWeekPlan(page,week,/Harvest/);
  await page.getByRole('button',{name:'Clear remaining plan',exact:true}).click();
  await page.locator(`[data-plan-week="${week+1}"]`).click();
  await expectWeekPlan(page,week+1,/Fallow/);
  return {week,daysUntil:7-calendar.day};
}
/** Enter the original field window from the map, then queue a crop for a supplied future week. */
export async function schedulePlant(page:Page,x:number,y:number,week:number,cropSlot:number){
  await reveal(page,'#viewport');await page.getByRole('button',{name:'View object',exact:true}).click();
  await clickFarmTile(page,x,y);
  await scheduleMonth(page,Math.min(57,Math.floor(week/4)));
  if(!await page.locator(`[data-plan-crop="${cropSlot}"]`).count())
    await page.getByRole('button',{name:cropSlot>=16?'Next crops':'Previous crops',exact:true}).click();
  await page.locator(`[data-plan-crop="${cropSlot}"]`).click();
  await page.locator(`[data-plan-week="${week}"]`).click();
}
/** Exercise the real keyboard-operable original month scrollbar. */
export async function scheduleMonth(page:Page,month:number){
  await openWindow(page,'schedule');const range=page.locator('#schedule-month');await range.focus();
  await range.press(month>28?'End':'Home');
  for(let i=0;i<(month>28?57-month:month);i++)await range.press(month>28?'ArrowLeft':'ArrowRight');
}
export async function scheduleWeek(page:Page,week:number){
  await openWindow(page,'schedule');
  if(!await page.locator(`[data-plan-week="${week}"]`).count())await scheduleMonth(page,Math.min(57,Math.floor(week/4)));
  return page.locator(`[data-plan-week="${week}"]`);
}

/** Each week button is labelled "date: plan", so a plan edit is visible on the week itself. */
export async function expectWeekPlan(page:Page,week:number,plan:RegExp){
  await expect(page.locator(`[data-plan-week="${week}"]`)).toHaveAttribute('aria-label',plan);
}
