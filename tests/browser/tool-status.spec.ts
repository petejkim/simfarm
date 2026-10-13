import {readSaveText} from '../support/save-file';
import {test,expect} from '@playwright/test';

test('palette and Spray selections show source messages, retain recent order across wrap and do not perform farm work',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
  const before=await save(),status=page.getByRole('button',{name:'Edit message history'}),messages:string[]=[];
  // The selected tool's cost (original Edit title, paint 0x20352) follows the current message; View/Move have none.
  // Costs are Scenario 1's "other goods" (288–351) and chemical (220–223) prices; Bulldoze is the source's fixed 25.
  for(const [tool,text,cost] of [
    ['Move object','Choose an object to move.',''],['View object','Examine',''],['Paved road','Paved Road',' ($30)'],['Dirt road','Dirt Road',' ($20)'],
    ['Fence','Fence',' ($50)'],['Gate','Fence Gate',' ($75)'],['Ditch','Irrigation Ditch',' ($80)'],['Valve','Irrigation Ditch Valve',' ($35)'],
    ['Hay','Livestock Feed',' ($100)'],['Trough','Water Trough',' ($15)'],['Trees','Trees - Windbreaks',' ($10)'],['Bulldoze','Bulldoze',' ($25)'],
  ]){
    await page.getByRole('button',{name:tool,exact:true}).click();await expect(status).toHaveText(text+cost);messages.push(text);
  }
  await page.getByRole('button',{name:'PLANT',exact:true}).click();await page.locator('[data-field-tool="0"]').click();
  await expect(status).toHaveText('Choose a location for your field. ($120)');messages.push('Choose a location for your field.');
  for(const [tool,text] of [['Fertilizer','Select field to fertilize.'],['Pesticide','Select field to spray with pesticide.'],['Herbicide','Select field to spray with herbicide.'],['Fungicide','Select field to spray with fungicide.']]){
    await page.getByRole('button',{name:'SPRAY',exact:true}).click();await page.getByRole('menuitem',{name:tool,exact:true}).click();await expect(status).toHaveText(text+' ($200)');messages.push(text);
  }
  await page.getByRole('button',{name:'SPRAY',exact:true}).click();await page.getByRole('menuitem',{name:'Fungicide',exact:true}).click();
  await status.click();const history=page.getByRole('list',{name:'Recent Edit messages'});await expect(history.locator('li')).toHaveText(messages.slice(-10).reverse());
  await page.screenshot({path:'artifacts/browser-tool-status.png'});await page.keyboard.press('Escape');expect(await save()).toEqual(before);
});
