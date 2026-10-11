import { expect, type Page } from '@playwright/test';
import { reveal } from './workspace';

/** Select a tile without changing the active original map tool. */
export async function clickFarmTile(page:Page,x:number,y:number){
  const size=16*Number(await page.locator('#zoom').inputValue());
  await page.locator('#viewport').evaluate((el,p)=>el.scrollTo(Math.max(0,p.x-3)*p.size,Math.max(0,p.y-3)*p.size),{x,y,size});
  const rect=(await page.locator('#world').boundingBox())!;
  await page.mouse.click(rect.x+x*size+size/2,rect.y+y*size+size/2);
}
export async function selectPlant(page:Page,cropSlot=0){
  await reveal(page,'#viewport');
  await page.getByRole('button',{name:'Plant',exact:true}).click();
  await page.locator(`[data-field-tool="${cropSlot}"]`).click();
}
export async function plantField(page:Page,x:number,y:number,cropSlot=0){
  await selectPlant(page,cropSlot);await clickFarmTile(page,x,y);
}
export async function setAutoDoze(page:Page,enabled:boolean){
  await page.locator('#options-menu-button').click();
  const option=page.getByRole('menuitemcheckbox',{name:'AutoDoze',exact:true});
  if(await option.getAttribute('aria-checked')!==String(enabled))await option.click();
  else await page.keyboard.press('Escape');
}
export async function selectProperty(page:Page,x:number,y:number){
  const window=page.getByRole('dialog',{name:'Map',exact:true});
  if(!await window.isVisible())await page.locator('#window-map').click();
  else await window.locator('.game-window-title').focus();
  const property=window.getByRole('button',{name:'Property',exact:true});
  if(await property.getAttribute('aria-pressed')!=='true')await property.click();
  await window.locator('.overview-viewport canvas').click({position:{x:x*16+8,y:y*16+8}});
}
export async function buyPlot(page:Page,x:number,y:number){
  await selectProperty(page,x,y);await expect(page.locator('#map-land-action')).toHaveText('BUY');
  await page.locator('#map-land-action').click();
  await expect(page.locator('#map-land-result')).toContainText(`Bought plot at ${x*8}, ${y*8}`);
}
