import { focusEdit } from '../support/workspace';
import {test,expect} from '@playwright/test';

test('opening windows after Market Value preserves the game viewport and map scroll',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#viewport').evaluate(el=>el.scrollTo(320,480));
  const position=()=>page.evaluate(()=>{
    const desktop=document.querySelector<HTMLElement>('.game-desktop')!,viewport=document.querySelector<HTMLElement>('#viewport')!;
    const rect=viewport.getBoundingClientRect();
    return {pageX:scrollX,pageY:scrollY,desktopX:desktop.scrollLeft,desktopY:desktop.scrollTop,
      mapX:viewport.scrollLeft,mapY:viewport.scrollTop,x:rect.x,y:rect.y,width:rect.width,height:rect.height};
  });
  const before=await position();
  await page.locator('#window-market').click();await expect(page.getByRole('dialog',{name:'Market Value',exact:true})).toBeVisible();
  expect(await position()).toEqual(before);
  for(const key of ['bank','sell','evaluation','balance','weather','buy','map','edit']){
    if(key==='edit')await focusEdit(page);else await page.locator(`#window-${key}`).click();expect(await position(),`After opening ${key}`).toEqual(before);
  }
});
