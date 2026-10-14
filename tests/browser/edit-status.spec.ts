import {readSaveText} from '../support/save-file';
import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readScenario} from '../../src/formats/scenario';

test('Plant shows original status text and a deduplicated recent history without changing failed-field checkpoints',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
  const before=await save(),field=readScenario(readFileSync('../simfarm-dos/SCEN0.SSM')).fields[1];
  await expect(page.getByRole('button',{name:'Edit message history'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Edit message history'})).toHaveText('');
  await page.getByRole('button',{name:'PLANT',exact:true}).click();await page.locator('[data-field-tool="0"]').click();
  const status=page.getByRole('button',{name:'Edit message history'});await expect(status).toHaveText('Choose a location for your field. ($120)'); // tool cost follows its own selection message
  expect(await status.evaluate(el=>{const s=getComputedStyle(el),bar=getComputedStyle(el.parentElement!);return [s.paddingLeft,s.paddingRight,bar.borderTop,bar.borderBottom];})).toEqual(['8px','8px','1px solid rgb(0, 0, 0)','1px solid rgb(0, 0, 0)']);
  await status.hover();expect(await status.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(194, 194, 194)'); // no green hover
  await page.locator('#viewport').evaluate((el,p)=>el.scrollTo(Math.max(0,p.x-10)*16,Math.max(0,p.y-10)*16),{x:field.x,y:field.y});
  const r=(await page.locator('#world').boundingBox())!;for(let i=0;i<2;i++)await page.mouse.click(r.x+(field.x+2)*16+8,r.y+(field.y+2)*16+8);
  await expect(status).toHaveText('Cannot place field there.');await status.click();
  const history=page.getByRole('list',{name:'Recent Edit messages'});await expect(history.locator('li')).toHaveText(['Cannot place field there.','Choose a location for your field.']);
  expect(await history.evaluate(el=>{const s=getComputedStyle(el);return [s.padding,s.borderTopWidth,s.borderBottom,s.borderLeftWidth,s.borderRightWidth,getComputedStyle(el.querySelector('li')!).lineHeight];})).toEqual(['0px 8px','0px','1px solid rgb(0, 0, 0)','0px','0px','16px']);await page.screenshot({path:'artifacts/browser-edit-status.png'});
  await page.keyboard.press('Escape');await expect(history).toHaveCount(0);await expect(status).toBeFocused();await status.click();await history.click({position:{x:120,y:60}});await expect(history).toHaveCount(0);expect(await save()).toEqual(before);
  await page.locator('#load-farm-file').setInputFiles({name:'farm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await expect(status).toBeVisible();await expect(status).toHaveText('');
});

test('missing quick-message records fail before play',async({page})=>{
  const data=JSON.parse(readFileSync('public/assets/ui-content.json','utf8'));data.editStatuses.pop();
  await page.route('**/assets/ui-content.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});

test('message bar reserves space before any tool selection and never covers the first terrain row',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const status=page.getByRole('button',{name:'Edit message history'}),viewport=page.locator('#viewport');
  await expect(status).toBeVisible();await expect(status).toHaveText('');
  await viewport.evaluate(el=>el.scrollTo(0,0));
  const initial=(await viewport.boundingBox())!,bar=(await status.boundingBox())!;
  expect(initial.y).toBeGreaterThanOrEqual(bar.y+bar.height); // the bar never covers the first terrain row
  const firstRow=()=>page.evaluate(()=>{
    const r=document.querySelector('#viewport')!.getBoundingClientRect();
    return document.elementFromPoint(r.x+8,r.y+8)?.id;
  });
  expect(await firstRow()).toBe('world');
  await status.click();await expect(page.getByRole('list',{name:'Recent Edit messages'}).locator('li')).toHaveCount(0);
  await page.keyboard.press('Escape');
  for(const tool of ['Move object','View object','Fence']){
    await page.getByRole('button',{name:tool,exact:true}).click();
    expect(await viewport.boundingBox()).toMatchObject({x:initial.x,y:initial.y,width:initial.width});expect(await firstRow()).toBe('world');
  }
  await page.locator('#window-market').click();await page.locator('#window-bank').click();
  expect(await viewport.boundingBox()).toMatchObject({x:initial.x,y:initial.y,width:initial.width});await expect(status).toBeVisible();
});
