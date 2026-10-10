import { expect,type Page } from '@playwright/test';
export async function aircraftCatalog(page:Page){
  await page.locator('#window-buy').click();
  const catalog=page.getByRole('region',{name:'Buy catalog'});
  await catalog.getByRole('button',{name:'Machinery',exact:true}).click();
  await catalog.getByRole('button',{name:'Previous item'}).click();
  await expect(page.locator('#buy-description')).toContainText('Crop Duster');
}
