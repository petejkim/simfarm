import {test,expect} from '@playwright/test';

test('About restores source artwork, HTML credits, movement, cycling and close without registration',async({page})=>{
  await page.clock.install();await page.clock.pauseAt(new Date());
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const open=async()=>{await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'About SimFarm',exact:true}).click();};
  await open();const dialog=page.getByRole('dialog',{name:'ABOUT',exact:true});
  expect(await dialog.boundingBox()).toEqual({x:96,y:96,width:400,height:240});
  await expect(dialog.getByRole('img',{name:'SimFarm',exact:true})).toBeVisible();await expect(dialog.getByRole('heading')).toHaveCount(0);await expect(dialog).toContainText('Eric Albers');
  expect(await dialog.textContent()).not.toMatch(/registered|This copy/);
  const title=dialog.locator('.game-window-title');await title.focus();await page.keyboard.press('ArrowRight');
  expect((await dialog.boundingBox())!.x).toBe(106);
  await page.screenshot({path:'artifacts/browser-about.png'});
  await page.clock.fastForward(8000);await expect(dialog.locator('[data-credit-page="0"]')).toContainText('Michael Perry');
  await expect(dialog.locator('.about-logo')).toHaveCount(0);
  await page.screenshot({path:'artifacts/browser-about-credits.png'});
  // Every page stays inside the original credit rectangle and eventually loops.
  for(let i=0;i<30;i++){
    const credits=dialog.locator('.about-credits');
    expect(await credits.evaluate(el=>el.scrollWidth<=el.clientWidth&&el.scrollHeight<=el.clientHeight)).toBe(true);
    await page.clock.fastForward(6000);
    if(await dialog.locator('[data-credit-page="-1"]').count())break;
  }
  await expect(dialog).toContainText('Eric Albers');
  await dialog.getByRole('button',{name:'Close ABOUT',exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('#file-menu-button')).toBeFocused();
  await open();await expect(dialog).toContainText('Eric Albers');await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
