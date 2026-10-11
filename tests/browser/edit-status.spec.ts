import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readScenario} from '../../src/formats/scenario';

test('Plant shows original status text and a deduplicated recent history without changing failed-field checkpoints',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await(await pending).path())!,'utf8'));}
  const before=await save(),field=readScenario(readFileSync('../simfarm-dos/SCEN0.SSM')).fields[1];
  await expect(page.getByRole('button',{name:'Edit message history'})).toHaveCount(0);
  await page.getByRole('button',{name:'Plant',exact:true}).click();await page.locator('[data-field-tool="0"]').click();
  const status=page.getByRole('button',{name:'Edit message history'});await expect(status).toHaveText('Choose a location for your field.');
  expect(await status.boundingBox()).toMatchObject({x:48,y:64,height:16});
  await page.locator('#viewport').evaluate((el,p)=>el.scrollTo(Math.max(0,p.x-10)*16,Math.max(0,p.y-10)*16),{x:field.x,y:field.y});
  const r=(await page.locator('#world').boundingBox())!;for(let i=0;i<2;i++)await page.mouse.click(r.x+(field.x+2)*16+8,r.y+(field.y+2)*16+8);
  await expect(status).toHaveText('Cannot place field there.');await status.click();
  const history=page.getByRole('list',{name:'Recent Edit messages'});await expect(history.locator('li')).toHaveText(['Cannot place field there.','Choose a location for your field.']);
  expect(await history.boundingBox()).toMatchObject({x:48,y:64,height:96});await page.screenshot({path:'artifacts/browser-edit-status.png'});
  await page.keyboard.press('Escape');await expect(history).toHaveCount(0);await expect(status).toBeFocused();await status.click();await history.click({position:{x:120,y:60}});await expect(history).toHaveCount(0);expect(await save()).toEqual(before);
  await page.locator('#load-farm-file').setInputFiles({name:'farm.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await expect(status).toHaveCount(0);
});

test('missing quick-message records fail before play',async({page})=>{
  await page.route('**/assets/raw/qmessage.dat',r=>r.fulfill({status:200,body:Buffer.alloc(64)}));await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});
