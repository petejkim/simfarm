import { expect, type Page } from '@playwright/test';
import { openWindow } from './workspace';
/** Original category and scrollbar navigation also cover animals and owned machinery. */
export async function selectAssetSale(page:Page,category:'Livestock'|'Machinery',slot:number){
  await openWindow(page,'sell');const catalog=page.getByRole('region',{name:'Sell catalog'});
  await catalog.getByRole('button',{name:category,exact:true}).click();
  for(let i=0;i<1024;i++){
    const selected=catalog.getByRole('option',{selected:true});
    if(await selected.count()&&Number(await selected.getAttribute('data-slot'))===slot)return;
    const next=catalog.getByRole('button',{name:'Next item'});await expect(next).toBeEnabled();await next.click();
  }
  throw new Error('Sale asset missing');
}
/** Browse the actual three-row catalog rather than assuming all lots are rendered. */
export async function saleOffers(page: Page): Promise<string[]> {
  await openWindow(page,'sell');
  const catalog=page.getByRole('region',{name:'Sell catalog'});
  await catalog.getByRole('button',{name:'Harvest',exact:true}).click();
  const offers:string[]=[];
  if(await page.locator('#catalog-sell').isDisabled())return offers;
  for(let i=0;i<1024;i++){
    offers.push((await page.locator('#catalog-sell').getAttribute('aria-label'))!);
    const next=catalog.getByRole('button',{name:'Next item'});if(await next.isDisabled())return offers;await next.click();
  }
  throw new Error('Sell catalog did not terminate');
}
export async function selectSaleOffer(page: Page, match:(label:string)=>boolean) {
  await openWindow(page,'sell');const catalog=page.getByRole('region',{name:'Sell catalog'});
  await catalog.getByRole('button',{name:'Harvest',exact:true}).click();
  for(let i=0;i<1024;i++){
    if(match((await page.locator('#catalog-sell').getAttribute('aria-label'))!))return;
    const next=catalog.getByRole('button',{name:'Next item'});await expect(next).toBeEnabled();await next.click();
  }
  throw new Error('Sale item missing');
}
