import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {openWindow} from '../support/workspace';
import {FIXED_HARVEST_MESSAGE} from '../../src/formats/field-message';

test('Schedule fixed harvest opens the original mandatory Message and returns to the unchanged plan',async({page})=>{
  await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Messages',exact:true}).click();
  async function save(){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await(await pending).path())!,'utf8'));}
  const before=await save();await openWindow(page,'schedule');await page.locator('#planner-field').selectOption('1');
  const calendar=before.scenario.farm.calendar,week=calendar.month*4+calendar.week+1;
  await page.locator('[data-plan-action="harvest"]').click();await page.locator(`[data-plan-week="${week}"]`).click();
  const win=page.locator('[data-window=field-message]');await expect(win).toBeVisible();await expect(page.locator('#field-message-text')).toHaveText(FIXED_HARVEST_MESSAGE);
  expect(await win.boundingBox()).toEqual({x:192,y:150,width:256,height:192});expect(await win.locator('.message-portrait img').evaluate(el=>[parseFloat((el as HTMLElement).style.left),parseFloat((el as HTMLElement).style.top)])).toEqual([-224,-576]);
  expect(await page.locator('#field-message-ok').boundingBox()).toEqual({x:296,y:306,width:48,height:24});expect(await win.evaluate(el=>(el as HTMLDialogElement).matches(':modal'))).toBe(true);
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');expect(await win.boundingBox()).toMatchObject({x:202,y:150});
  const date=await page.locator('#farm-date').textContent();await page.clock.fastForward(12000);await expect(page.locator('#farm-date')).toHaveText(date!);
  await page.screenshot({path:'artifacts/browser-field-message.png'});await page.keyboard.press('Escape');await expect(win).toHaveCount(0);await expect(page.getByRole('dialog',{name:'Schedule',exact:true})).toBeVisible();expect(await save()).toEqual(before);
  await page.locator(`[data-plan-week="${week}"]`).click();await expect(win).toBeVisible();await page.locator('#field-message-ok').click();expect(await save()).toEqual(before);
  await page.locator('#load-farm-file').setInputFiles({name:'farm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await expect(win).toHaveCount(0);
});
