import {readSaveText} from '../support/save-file';
import {loadScenarioCheckpoint} from '../support/scenario-checkpoint';
import { fieldDescription } from '../support/field-checkpoint';
import { buyPlot, selectProperty, setAutoDoze, clickFarmTile } from '../support/field-actions';
import { scheduleMonth, scheduleWeek } from '../support/schedule-window';
import { reveal, openWindow } from '../support/workspace';
import { browserCrops } from '../support/crop-catalog';
import { test, expect, type Page } from '@playwright/test';
import { shopFixture } from '../support/livestock';

async function checkpoint(page: Page, name: string) {
  const pending = page.waitForEvent('download'); await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  const path = `artifacts/navigation-${name}.json`; await (await pending).saveAs(path);
  return JSON.parse(readSaveText(path));
}

test('Schedule and Bank remain accessible without Farm controls and navigation preserves the farm checkpoint', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('original terrain');
  const before = await checkpoint(page, 'before');
  await expect(page.getByRole('dialog',{name:'Farm controls',exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Field information',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Farm controls',exact:true})).toHaveCount(0);
  await openWindow(page,'schedule');
  await expect(page.locator('#field-planner')).toBeVisible();
  await expect(page.locator('#field-planner')).toBeInViewport();
  await reveal(page, '#planner-field'); await page.locator('#planner-field').selectOption('1');
  await expect(page.locator('#planner-field')).toHaveValue('1');
  await expect(page.locator('#field-planner')).toHaveAttribute('aria-label','Field 1 schedule');
  await reveal(page, '.plan-calendar'); await expect(page.locator('.plan-calendar')).toBeVisible();
  await scheduleMonth(page,48);
  await page.getByRole('button',{name:'Close Schedule',exact:true}).click();
  await openWindow(page,'schedule'); // Reexamination opens the original field window at today's month.
  await expect(page.locator('#schedule-month')).toHaveValue(String(before.scenario.farm.calendar.month));
  await reveal(page, '#planner-field'); await page.locator('#planner-field').selectOption('2');
  await expect(page.locator('#planner-field')).toHaveValue('2');
  await expect(page.locator('#schedule-month')).toHaveValue(String(before.scenario.farm.calendar.month));
  await openWindow(page,'bank');
  await expect(page.locator('#loan-panel')).toBeFocused();
  await reveal(page, '#loan-amount'); await expect(page.locator('#loan-amount')).toBeVisible();
  await page.getByRole('button', { name: 'Close Bank terminal', exact: true }).click();
  await expect(page.locator('#loan-amount')).not.toBeVisible();
  await openWindow(page,'bank');
  await reveal(page, '#loan-amount'); await expect(page.locator('#loan-amount')).toBeVisible();
  expect(await checkpoint(page, 'after')).toEqual(before);
  await loadScenarioCheckpoint(page,1);
  await expect(page.locator('#map-status')).toContainText('Scenario 2');
  await expect(page.locator('#loan-panel')).not.toBeVisible();
  await expect(page.locator('#field-planner')).not.toBeVisible();
  await expect(page.locator('#planner-field')).toHaveValue('');
  await page.screenshot({ path: 'artifacts/browser-navigation-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Map and Plant lead through land purchase, field creation and planning without interim forms', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 844 }); await page.goto('/');
  await loadScenarioCheckpoint(page,4); await expect(page.locator('#map-status')).toContainText('Scenario 5');
  await reveal(page, '#zoom'); await page.locator('#zoom').selectOption('0.5');
  await selectProperty(page,0,2);
  await expect(page.getByRole('dialog',{name:'Map',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Property',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.overview-viewport canvas')).toBeFocused();
  await expect(page.getByRole('dialog',{name:'Land purchase',exact:true})).toHaveCount(0);
  await buyPlot(page,0,2);await expect(page.locator('#farm-cash')).toHaveText('$21,940');
  await setAutoDoze(page,true);
  await reveal(page,'#viewport');
  await page.getByRole('button',{name:'Plant',exact:true}).click();
  const plant=page.getByRole('menu',{name:'Plant Field',exact:true});await expect(plant).toBeVisible();
  await expect(page.getByRole('dialog',{name:'New field',exact:true})).toHaveCount(0);
  await page.locator('[data-field-tool="0"]').click();await clickFarmTile(page,0,16);
  await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  expect(await fieldDescription(page)).toContain('Field 9 · Planting');
  await openWindow(page,'schedule');
  await expect(page.locator('#planner-field')).toHaveValue('9');
  await expect(page.locator('#field-planner')).toBeInViewport();
  await page.getByRole('button',{name:'Clear remaining plan',exact:true}).click(); await (await scheduleWeek(page,239)).click();
  await expect(page.locator('#plan-result')).toContainText('Plan updated');
  await openWindow(page,'bank');
  await reveal(page, '#loan-amount'); await page.locator('#loan-amount').fill('1000'); await reveal(page, '#borrow-loan'); await page.locator('#borrow-loan').click();
  await expect(page.locator('#loan-result')).toHaveText('Borrowed $1,000.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
  await expect(page.getByRole('dialog',{name:'Farm controls',exact:true})).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Field information',exact:true})).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/browser-navigation-windows.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('an empty farm creates its first field with Plant and then opens Schedule', async ({ page }) => {
  await page.goto('/'); const f = shopFixture(), game = f.load().withAllCrops(browserCrops), text = game.save(4);
  const load = async () => {
    await page.locator('#load-farm-file').setInputFiles({ name: 'empty.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  };
  await load(); await page.getByRole('button',{name:'Plant',exact:true}).click();
  const plant=page.getByRole('menu',{name:'Plant Field',exact:true});
  await expect(plant).toBeVisible();await expect(plant.getByRole('menuitem')).toHaveCount(24);
  await expect(plant.getByRole('menuitem').first()).toBeFocused();
  await expect(page.getByRole('dialog',{name:'New field',exact:true})).toHaveCount(0);
  await expect(page.locator('#field-planner')).not.toBeVisible();
  await page.keyboard.press('Escape');expect(await checkpoint(page,'empty-cancel')).toEqual(JSON.parse(text));
  await page.getByRole('button',{name:'Plant',exact:true}).click();
  await page.locator('[data-field-tool="0"]').click();
  await page.locator('#viewport').evaluate(v=>v.scrollTo(30*16,30*16));
  const map=(await page.locator('#world').boundingBox())!;await page.mouse.click(map.x+40*16+8,map.y+40*16+8);
  game.dispatch({type:'create-field',x:40,y:40,cropSlot:0});expect(game.getSnapshot().lastNewFieldResult?.ok).toBe(true);
  await expect(page.locator('#field-tool-result')).toContainText('Field planted.');
  expect(await checkpoint(page,'empty-planted')).toEqual(JSON.parse(game.save(4)));
  await openWindow(page,'schedule');await expect(page.locator('#planner-field')).toHaveValue('1');
  await load(); await expect(page.locator('#field-planner')).not.toBeVisible();
  await expect(page.locator('#map-tool')).toHaveCount(0);
  expect(await checkpoint(page, 'empty')).toEqual(JSON.parse(text));
});
