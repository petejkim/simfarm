import {readSaveText} from '../support/save-file';
import {test,expect} from '@playwright/test';

test('New Game opens the original chooser directly, keeps native options, and fits both source panels at 1x',async({page})=>{
  await page.setViewportSize({width:640,height:480});await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const open=async()=>{await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'New Game',exact:true}).click();};
  await open();const win=page.locator('[data-window=newgame]'),region=page.locator('#geographic-chooser');
  await expect(region).toBeVisible();await expect(region.getByRole('heading')).toBeFocused();
  expect(await region.boundingBox()).toEqual({x:80,y:64,width:472,height:328});
  const bounds=(await win.boundingBox())!;expect(bounds.y+bounds.height).toBeLessThanOrEqual(480);
  await expect(page.locator('#choose-region,#create-farm,#new-farm-temperature')).toHaveCount(0);
  await expect(page.locator('#new-farm-session')).toHaveCount(0);await expect(page.locator('#new-farm-seed')).toBeEnabled();
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
  const state=JSON.parse(readSaveText((await(await download).path())!));
  expect(state.runtime.newFarm.provenance.options.seeds).toEqual({visual:37,simulation:37,bounded:37});
  expect(state.scenario.farm.calendar.year).toBe(2001);
});

test('each New Game suggests a new seed, keeps edits within setup, and leaves the active farm untouched on Cancel',async({page})=>{
  await page.addInitScript(()=>{
    const original=crypto.getRandomValues.bind(crypto);let seed=100;
    crypto.getRandomValues=(<T extends ArrayBufferView|null>(array:T):T=>{
      if(array instanceof Uint16Array&&array.length===1){array[0]=++seed;return array;}
      return original(array);
    });
  });
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await(await download).path())!));}
  async function open(){await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'New Game',exact:true}).click();await expect(page.locator('#region-map')).toBeVisible();}
  const before=await save();await open();const first=Number(await page.locator('#new-farm-seed').inputValue());expect(first).toBeGreaterThan(100);
  await page.locator('#new-farm-seed').fill('65535');await page.locator('[data-region="3,8"]').click();await expect(page.locator('#new-farm-seed')).toHaveValue('65535');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await save()).toEqual(before);
  await open();const second=Number(await page.locator('#new-farm-seed').inputValue());expect(second).toBeGreaterThan(first);expect(second).toBeLessThan(65535);
  await expect(page.locator('#new-farm-session')).toHaveCount(0);await expect(page.locator('#new-farm-seed')).toBeEnabled();
});
