import { expect, type Page } from '@playwright/test';
import { reveal } from './workspace';
import { clickFarmTile } from './field-actions';

/** The original building catalog is ordered64..72, reset by its category button. */
export async function selectBuilding(page:Page,type:number){
  if(type<64||type>72)throw new Error(`Unknown building ${type}`);
  await reveal(page,'#viewport');
  await page.locator('#window-buy').click();
  const catalog=page.getByRole('region',{name:'Buy catalog'});
  await catalog.getByRole('button',{name:'Buildings',exact:true}).click();
  for(let i=64;i<type;i++)await catalog.getByRole('button',{name:'Next item'}).click();
  await page.locator('#catalog-buy').click();
  await catalog.getByRole('button',{name:'CLOSE',exact:true}).click();
}
export async function buyBuilding(page:Page,type:number,x:number,y:number){
  const cash=await page.locator('#farm-cash').textContent();
  await selectBuilding(page,type);await clickFarmTile(page,x,y);
  await expect(page.locator('#farm-cash')).not.toHaveText(cash!);
}
