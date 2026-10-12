import {readSaveText} from '../support/save-file';
import {test,expect} from '@playwright/test';

test('palette and Spray selections show source messages, retain recent order across wrap and do not perform farm work',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
  const before=await save(),status=page.getByRole('button',{name:'Edit message history'}),messages:string[]=[];
  for(const [tool,text] of [
    ['Move object','Choose an object to move.'],['View object','Examine'],['Paved road','Paved Road'],['Dirt road','Dirt Road'],
    ['Fence','Fence'],['Gate','Fence Gate'],['Ditch','Irrigation Ditch'],['Valve','Irrigation Ditch Valve'],
    ['Hay','Livestock Feed'],['Trough','Water Trough'],['Trees','Trees - Windbreaks'],['Bulldoze','Bulldoze'],
  ]){
    await page.getByRole('button',{name:tool,exact:true}).click();await expect(status).toHaveText(text);messages.push(text);
  }
  for(const [tool,text] of [['Fertilize','Select field to fertilize.'],['Pesticide','Select field to spray with pesticide.'],['Herbicide','Select field to spray with herbicide.'],['Fungicide','Select field to spray with fungicide.']]){
    await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:tool,exact:true}).click();await expect(status).toHaveText(text);messages.push(text);
  }
  await page.getByRole('button',{name:'Spray',exact:true}).click();await page.getByRole('menuitem',{name:'Fungicide',exact:true}).click();
  await status.click();const history=page.getByRole('list',{name:'Recent Edit messages'});await expect(history.locator('li')).toHaveText(messages.slice(-10).reverse());
  await page.screenshot({path:'artifacts/browser-tool-status.png'});await page.keyboard.press('Escape');expect(await save()).toEqual(before);
});
