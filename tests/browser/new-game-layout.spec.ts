import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('New Game opens the original chooser directly, keeps native options, and fits both source panels at 1x',async({page})=>{
  await page.setViewportSize({width:640,height:480});await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const open=async()=>{await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'New Game',exact:true}).click();};
  await open();const win=page.locator('[data-window=newgame]'),region=page.locator('#geographic-chooser');
  await expect(region).toBeVisible();await expect(region.getByRole('heading')).toBeFocused();
  expect(await region.boundingBox()).toEqual({x:80,y:64,width:472,height:328});
  const bounds=(await win.boundingBox())!;expect(bounds.y+bounds.height).toBeLessThanOrEqual(480);
  await expect(page.locator('#choose-region,#create-farm,#new-farm-temperature')).toHaveCount(0);
  await expect(page.locator('#new-farm-seed')).toBeDisabled();await page.locator('#new-farm-session').selectOption('fresh');
  await page.locator('#new-farm-seed').fill('0');await page.locator('#region-design').click();await expect(region).toBeVisible();await expect(page.locator('#terrain-design')).toHaveCount(0);
  await page.locator('#new-farm-seed').fill('37');await page.locator('#new-farm-year').fill('2001');
  await page.screenshot({path:'artifacts/browser-new-game-region.png'});
  await page.locator('#region-design').click();const terrain=page.locator('#terrain-design');await expect(terrain).toBeVisible();
  expect(await terrain.boundingBox()).toEqual({x:128,y:64,width:352,height:304});
  await expect(win.getByRole('heading')).toHaveText('Design your terrain');await expect(win.getByRole('heading')).toHaveCount(1);
  await expect(page.locator('.terrain-footer')).toContainText('April 2001');
  await page.screenshot({path:'artifacts/browser-new-game-terrain.png'});
  await page.locator('#play-farm').click();await expect(page.locator('#map-status')).toContainText('Generated farm');
  const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();
  const state=JSON.parse(readFileSync((await(await download).path())!,'utf8'));
  expect(state.runtime.newFarm.provenance.options.seeds).toEqual({visual:37,simulation:37,bounded:37});
  expect(state.scenario.farm.calendar.year).toBe(2001);
});
