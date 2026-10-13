import {test,expect} from '@playwright/test';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {readSaveText} from '../support/save-file';
import {clickFarmTile} from '../support/field-actions';
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
 expect(await menu.getByRole('menuitem').allTextContents()).toEqual(['Start rodeo','Start fair (carnival)','Advance event week','Start town expansion','Grow town districts','Create crop circles','Show toxic-land warning','Place type 6 machine','Cheat: LLAMA','Cheat: FUND','Cheat: CORN']);
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
 // Grow town districts: one original level for every unfinished district, same date, same saved result as the simulation.
 await page.locator('#debug-menu-button').click();await page.getByRole('menuitem',{name:'Grow town districts',exact:true}).click();game.dispatch({type:'debug-town-grow'});
 await expect(page.locator('#farm-date')).toHaveText(date!);expect(await save()).toEqual(JSON.parse(game.save(4)));
});

test('Debug places the catalog-omitted type 6 machine through the ordinary machinery purchase',async({page})=>{
 await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
 const game=shopFixture().load().withAllCrops(browserCrops);
 await page.locator('#load-farm-file').setInputFiles({name:'type6.json',mimeType:'application/json',buffer:Buffer.from(game.save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
 await page.locator('#debug-menu-button').click();await page.getByRole('menuitem',{name:'Place type 6 machine',exact:true}).click();
 await clickFarmTile(page,20,20);game.dispatch({type:'buy-equipment',equipmentType:6,x:20,y:20});
 const result=game.getSnapshot().lastEquipmentPurchaseResult;expect(result?.ok&&result.price).toBe(250);
 await expect(page.locator('#farm-cash')).toHaveText(`$${game.getSnapshot().scenario.farm.cash.toLocaleString('en-US')}`);
 const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();
 const saved=JSON.parse(readSaveText((await(await pending).path())!));expect(saved).toEqual(JSON.parse(game.save(4)));
 expect(game.getSnapshot().scenario.equipment.filter(e=>e.active&&e.type===6).map(e=>[e.x,e.y])).toEqual([[20,20]]);
});

test('Debug cheats show the original LLAMA and FUND popups and add the original $10,000 amounts',async({page})=>{
 await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
 const game=shopFixture().load().withAllCrops(browserCrops);
 await page.locator('#load-farm-file').setInputFiles({name:'cheats.json',mimeType:'application/json',buffer:Buffer.from(game.save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
 const cheat=async(code:'LLAMA'|'FUND'|'CORN')=>{await page.locator('#debug-menu-button').click();await page.getByRole('menuitem',{name:`Cheat: ${code}`,exact:true}).click();game.dispatch({type:'debug-cheat',code});};
 await cheat('LLAMA');
 const win=page.locator('[data-window=cheat-message]');
 await expect(page.locator('#cheat-message-text')).toHaveText('"The Llama is a quadruped" - Will Wright');
 expect(await win.locator('.message-portrait').evaluate(el=>(el as HTMLElement).style.backgroundPosition)).toBe(`${-(25%8)*112}px ${-Math.floor(25/8)*64}px`); // llama card
 await win.screenshot({path:'artifacts/browser-llama-cheat.png'});await page.locator('#cheat-message-ok').click();await expect(win).toHaveCount(0);
 const cashBeforeFund=game.getSnapshot().scenario.farm.cash;await cheat('FUND');expect(game.getSnapshot().scenario.farm.cash).toBe(cashBeforeFund-10000);
 await expect(page.locator('#cheat-message-text')).toHaveText('You just donated $10000 to the town. The mayor and his new car thank you!');
 await page.locator('#cheat-message-ok').click();
 await cheat('CORN');await expect(win).toHaveCount(0);
 await expect(page.locator('#farm-cash')).toHaveText(`$${game.getSnapshot().scenario.farm.cash.toLocaleString('en-US')}`);
 const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();
 expect(JSON.parse(readSaveText((await(await pending).path())!))).toEqual(JSON.parse(game.save(4)));
 // SF-180 native correction: the donation costs $10,000, so FUND is unavailable below that.
 const poor=shopFixture();poor.state.scenario.farm.cash=9999;
 await page.locator('#load-farm-file').setInputFiles({name:'poor.json',mimeType:'application/json',buffer:Buffer.from(poor.load().withAllCrops(browserCrops).save(4))});
 await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
 await page.locator('#debug-menu-button').click();
 await expect(page.getByRole('menuitem',{name:'Cheat: FUND',exact:true})).toBeDisabled();
 await expect(page.getByRole('menuitem',{name:'Cheat: CORN',exact:true})).toBeEnabled();
});
