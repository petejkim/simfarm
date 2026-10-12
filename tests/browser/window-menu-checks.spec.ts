import {readSaveText} from '../support/save-file';
import { focusEdit } from '../support/workspace';
import {test,expect} from '@playwright/test';

/** Drop-down menus sit directly under their heading, at least as wide, with uniform item rows. */
async function expectAnchored(menu:import('@playwright/test').Locator){
  const id=await menu.getAttribute('id'),heading=menu.page().locator(`[aria-controls="${id}"]`);
  const h=(await heading.boundingBox())!,m=(await menu.boundingBox())!;
  expect([m.x,m.y]).toEqual([h.x,h.y+h.height]);expect(m.width).toBeGreaterThanOrEqual(h.width);
  const heights=await menu.locator('button').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));expect(new Set(heights).size).toBe(1);
}
test('Windows displays source geometry and live open checks, preserving permanent Edit and full saves',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await p).path())!));}
  const before=await save(),menu=page.getByRole('menu',{name:'Windows',exact:true});
  async function checks(open:string[]){
    await page.locator('#windows-menu-button').click();
    await expectAnchored(menu);
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
  await focusEdit(page);await checks(['Buy','Sell','Evaluation','Map','Weather','Balance Sheet','Bank','Market Value','Farm Expert']);await page.keyboard.press('Escape');expect(await save()).toEqual(before);
});
