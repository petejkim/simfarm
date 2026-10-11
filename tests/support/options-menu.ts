import {expect,type Page} from '@playwright/test';
import {acknowledgeFinanceMessages} from './workspace';

export async function toggleOption(page:Page,name:string){
  await acknowledgeFinanceMessages(page);await page.locator('#options-menu-button').click();
  await page.getByRole('menuitemcheckbox',{name,exact:true}).click();
}
export async function expectOptionChecked(page:Page,name:string,checked:boolean){
  await acknowledgeFinanceMessages(page);await page.locator('#options-menu-button').click();
  await expect(page.getByRole('menuitemcheckbox',{name,exact:true})).toHaveAttribute('aria-checked',String(checked));
  await page.keyboard.press('Escape');
}
