import {test,expect} from '@playwright/test';

const origin='http://127.0.0.1:5190',scenario1={name:'simfarm.startup.v1',value:'scenario-1'};
test.describe('touch screen',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin,localStorage:[scenario1]}]}});
  test('the farmer says mobile support is in progress once, holds time until OK and suggests the Home Screen',async({page})=>{
    await page.goto('/');await expect(page.locator('#world')).toBeVisible();
    const dialog=page.locator('[data-window="touch-notice"]');await expect(dialog).toBeVisible();
    await expect(page.locator('#touch-notice-text')).toHaveText('Mobile support is still a work in progress, so some things may be hard to use on a touch screen. For the best experience, add SimFarm to your Home Screen to play in full screen.');
    // The farmer card (75, thumbs up) from the original Buy cards.
    await expect(dialog.locator('.message-portrait')).toHaveCSS('background-position','-336px -576px');
    // Game time is held while it is open, even with the clock running (resumed behind the modal; 1× is a day per 4s).
    await page.locator('#toolbar-pause').evaluate((button:HTMLButtonElement)=>button.click());
    const status=page.locator('#time-status');await expect(status).toContainText('Running');const held=await status.textContent();
    await page.waitForTimeout(4500);expect(await status.textContent()).toBe(held);
    await page.locator('#touch-notice-ok').tap();await expect(dialog).toHaveCount(0);
    await expect(status).not.toHaveText(held!,{timeout:10_000}); // time runs again after OK
    await page.reload();await expect(page.locator('#world')).toBeVisible();await page.waitForTimeout(300);await expect(dialog).toHaveCount(0);
  });
});
test.describe('mouse screen',()=>{
  test.use({storageState:{cookies:[],origins:[{origin,localStorage:[scenario1]}]}});
  test('desktop browsers never see the touch notice',async({page})=>{
    await page.goto('/');await expect(page.locator('#world')).toBeVisible();await page.waitForTimeout(300);
    await expect(page.locator('[data-window="touch-notice"]')).toHaveCount(0);
  });
});
