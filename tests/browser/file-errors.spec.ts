import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return readSaveText((await(await pending).path())!);}
test('File Load reports failure visibly, keeps the farm intact, and supports dismissal and retry without Game files',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');const before=await save(page);
  await expect(page.locator('[data-window=session],#save-farm,#load-farm')).toHaveCount(0);
  async function load(buffer:Buffer){const pending=page.waitForEvent('filechooser');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Load from File...',exact:true}).click(); await page.locator('#replace-game-yes').click();await(await pending).setFiles({name:'farm.json',mimeType:'application/json',buffer});}
  await load(Buffer.from('{broken'));
  const error=page.getByRole('dialog',{name:'File error',exact:true});await expect(error).toBeVisible();await expect(page.locator('#file-error-text')).toContainText('Could not load farm:');
  await page.keyboard.press('Escape');await expect(error).toHaveCount(0);expect(await save(page)).toBe(before);
  await load(Buffer.from('{}'));await expect(error).toBeVisible();await page.locator('#file-error-ok').click();await expect(error).toHaveCount(0);
  await load(Buffer.from(before));await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await expect(error).toHaveCount(0);expect(await save(page)).toBe(before);
});
