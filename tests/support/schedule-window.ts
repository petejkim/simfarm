import type { Page } from '@playwright/test';
import { openWindow, reveal } from './workspace';
import { clickFarmTile } from './field-actions';
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
