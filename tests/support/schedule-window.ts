import type { Page } from '@playwright/test';
import { openWindow } from './workspace';
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
