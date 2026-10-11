import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

test('Windows displays source geometry and live open checks, preserving permanent Edit and full saves',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await(await p).path())!,'utf8'));}
  const before=await save(),menu=page.getByRole('menu',{name:'Windows',exact:true});
  async function checks(open:string[]){
    await page.locator('#windows-menu-button').click();
    expect(await menu.boundingBox()).toEqual({x:208,y:16,width:120,height:128});
    for(const label of ['Buy','Sell','Evaluation','Map','Weather','Balance Sheet','Bank','Edit','Market Value','Farm Expert'])await expect(menu.getByRole('menuitemcheckbox',{name:label,exact:true})).toHaveAttribute('aria-checked',String(label==='Edit'||open.includes(label)));
  }
  await checks([]);await page.keyboard.press('Escape');
  await page.locator('#window-buy').click();await page.locator('#window-bank').click();await checks(['Buy','Bank']);
  await page.screenshot({path:'artifacts/browser-window-menu-checks.png'});
  await menu.getByRole('menuitemcheckbox',{name:'Buy',exact:true}).click();await expect(page.locator('[data-window=buy]')).toBeHidden();await expect(page.locator('[data-window=bank]')).toBeVisible();
  await checks(['Bank']);await page.keyboard.press('Escape');await page.getByRole('button',{name:'Close Bank',exact:true}).click();
  await checks([]);await menu.getByRole('menuitemcheckbox',{name:'Edit',exact:true}).click();await expect(page.locator('#viewport')).toBeVisible();
  // All original menu entries retain independent checks, not merely the front one.
  for(const label of ['Buy','Sell','Evaluation','Map','Weather','Balance Sheet','Bank','Market Value','Farm Expert']){
    await page.locator('#windows-menu-button').click();await menu.getByRole('menuitemcheckbox',{name:label,exact:true}).click();
  }
  await checks(['Buy','Sell','Evaluation','Map','Weather','Balance Sheet','Bank','Market Value','Farm Expert']);await page.keyboard.press('Escape');
  await page.locator('#window-edit').click();await checks([]);await page.keyboard.press('Escape');expect(await save()).toEqual(before);
});
