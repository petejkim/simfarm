import {test,expect} from '@playwright/test';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {readSaveText} from '../support/save-file';
test('Debug triggers original event dialogs/music without a time jump or duplicate Disasters entries',async({page})=>{
 await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
 await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing amain');await page.keyboard.press('Escape');
 const f=shopFixture();f.state.finances.town.recreationCount=1;f.state.finances.town.recreationCoordinates.set([72,72]);
 const game=f.load().withAllCrops(browserCrops);
 await page.locator('#load-farm-file').setInputFiles({name:'debug.json',mimeType:'application/json',buffer:Buffer.from(game.save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
 const date=await page.locator('#farm-date').textContent();
 await page.locator('#debug-menu-button').focus();await page.keyboard.press('ArrowDown');
 const menu=page.getByRole('menu',{name:'Debug',exact:true});
 expect(await menu.getByRole('menuitem').allTextContents()).toEqual(['Start rodeo','Start fair (carnival)','Advance event week','Start town expansion']);
 await expect(menu.getByRole('menuitem',{name:'Advance event week'})).toBeDisabled();
 await expect(menu.getByRole('menuitem',{name:'Start rodeo',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
 for(const [label,action,weeks] of [['Start rodeo','rodeo',2],['Start fair (carnival)','fair',3]] as const){
  await page.locator('#debug-menu-button').click();await page.getByRole('menuitem',{name:label,exact:true}).click();
  game.dispatch({type:'debug-town-event',action});
  await expect(page.locator('[data-window=town-event-message]')).toBeVisible();
  await expect(page.locator('#audio-status')).toContainText(`Playing ${action==='fair'?'carnival':'rodeo'}`);
  await page.locator('#town-event-0').click();game.dispatch({type:'resolve-town-event',accept:true});
  for(let i=0;i<weeks;i++){
   await page.locator('#debug-menu-button').click();await expect(page.getByRole('menuitem',{name:'Start rodeo',exact:true})).toBeDisabled();
   await page.getByRole('menuitem',{name:'Advance event week',exact:true}).click();game.dispatch({type:'debug-town-event',action:'advance-week'});
  }
  if(game.getSnapshot().townEvent.pending){await page.locator('#town-event-0').click();game.dispatch({type:'resolve-town-event',accept:true});}
  await expect(page.locator('#farm-date')).toHaveText(date!);
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();
  expect(JSON.parse(readSaveText((await(await pending).path())!))).toEqual(JSON.parse(game.save(4)));
 }
});
test('Debug explains missing prerequisites and enables only valid event controls',async({page})=>{
 await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
 const f=shopFixture();f.state.finances.town.recreationCount=0;
 await page.locator('#load-farm-file').setInputFiles({name:'no-recreation.json',mimeType:'application/json',buffer:Buffer.from(f.load().withAllCrops(browserCrops).save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await page.locator('#debug-menu-button').click();
 const menu=page.getByRole('menu',{name:'Debug',exact:true});
 for(const label of ['Start rodeo','Start fair (carnival)','Advance event week'])await expect(menu.getByRole('menuitem',{name:label,exact:true})).toBeDisabled();
 await expect(menu.getByRole('menuitem',{name:'Start fair (carnival)',exact:true})).toHaveAttribute('title',/recreation district/);
 await page.keyboard.press('Escape');
 f.state.finances.town.recreationCount=1;f.state.finances.town.recreationCoordinates.set([72,72]);f.state.scenario.farm.cash=999;
 await page.locator('#load-farm-file').setInputFiles({name:'poor.json',mimeType:'application/json',buffer:Buffer.from(f.load().withAllCrops(browserCrops).save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');await page.locator('#debug-menu-button').click();
 await expect(menu.getByRole('menuitem',{name:'Start rodeo',exact:true})).toBeDisabled();
 await expect(menu.getByRole('menuitem',{name:'Start fair (carnival)',exact:true})).toBeEnabled();
 await page.screenshot({path:'artifacts/browser-debug-menu.png'});
});

test('Debug opens the town expansion choice mid-year without the town fund, leaves saves untouched, and builds without a time jump',async({page})=>{
 const save=async()=>{const d=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await d).path())!));};
 await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
 const f=shopFixture();f.state.finances.town.expansionFunds=0;const game=f.load().withAllCrops(browserCrops);
 await page.locator('#load-farm-file').setInputFiles({name:'debug.json',mimeType:'application/json',buffer:Buffer.from(game.save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');const before=await save(),date=await page.locator('#farm-date').textContent();
 await page.locator('#debug-menu-button').click();await page.getByRole('menuitem',{name:'Start town expansion',exact:true}).click();game.dispatch({type:'debug-town-expansion'});
 const win=page.getByRole('dialog',{name:'Town development',exact:true});await expect(win).toBeVisible();await expect(page.locator('#farm-date')).toHaveText(date!);
 expect(await save()).toEqual(before); // the open debug choice is not saved
 await page.locator('#debug-menu-button').click();await expect(page.getByRole('menuitem',{name:'Start town expansion',exact:true})).toBeDisabled();await page.keyboard.press('Escape');
 await page.locator('#town-airport').click();game.dispatch({type:'choose-town',choice:'airport'});
 await expect(win).toBeHidden();await expect(page.locator('#farm-date')).toHaveText(date!);
 expect(await save()).toEqual(JSON.parse(game.save(4)));
});
