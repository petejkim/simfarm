import {expect,type Page} from '@playwright/test';
import {acknowledgeFinanceMessages} from './workspace';
import type {DisasterMenuAction} from '../../src/simulation/disaster-menu';
const names:Record<DisasterMenuAction,string>={tornado:'Tornado',swarm:'Locusts',drought:'Drought',flood:'Flood',frost:'Frost',wind:'Windstorm',disable:'Disable'};
export async function chooseDisaster(page:Page,action:DisasterMenuAction){
  await acknowledgeFinanceMessages(page);await page.locator('#disasters-menu-button').click();
  await page.getByRole('menuitemcheckbox',{name:names[action],exact:true}).click();
}
export async function setDisastersEnabled(page:Page,enabled:boolean){
  await acknowledgeFinanceMessages(page);await page.locator('#disasters-menu-button').click();
  const item=page.getByRole('menuitemcheckbox',{name:'Disable',exact:true});
  if((await item.getAttribute('aria-checked')==='true')===enabled)await item.click();
  else await page.keyboard.press('Escape');
}
export async function expectDisasterChecked(page:Page,action:DisasterMenuAction,checked=true){
  await acknowledgeFinanceMessages(page);await page.locator('#disasters-menu-button').click();
  await expect(page.getByRole('menuitemcheckbox',{name:names[action],exact:true})).toHaveAttribute('aria-checked',String(checked));
  await page.keyboard.press('Escape');
}
