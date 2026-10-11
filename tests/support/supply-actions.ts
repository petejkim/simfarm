import { type Page } from '@playwright/test';
import { reveal } from './workspace';

export async function browseSupply(page:Page,type:number){
  await reveal(page,'#viewport');await page.locator('#window-buy').click();
  const catalog=page.getByRole('region',{name:'Buy catalog'});
  await catalog.getByRole('button',{name:type>=220?'Chemicals':'Seeds',exact:true}).click();
  const count=type-(type>=220?220:192);
  if(count<0||count>=(type>=220?4:24))throw new Error('Unknown supply');
  for(let i=0;i<count;i++)await catalog.getByRole('button',{name:'Next item'}).click();
}
export async function selectSupply(page:Page,type:number){
  await browseSupply(page,type);await page.locator('#catalog-buy').click();
  await page.getByRole('region',{name:'Buy catalog'}).getByRole('button',{name:'CLOSE',exact:true}).click();
}
