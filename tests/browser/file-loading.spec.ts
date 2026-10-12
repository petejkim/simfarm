import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readScenario} from '../../src/formats/scenario';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
async function save(page:Page){
  const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Save',exact:true}).click();
  return readSaveText((await(await pending).path())!);
}
async function load(page:Page,text:string){
  const picker=page.waitForEvent('filechooser');await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'Load Game',exact:true}).click();
  await(await picker).setFiles({name:'farm.simfarm.json',mimeType:'application/json',buffer:Buffer.from(text)});
}
for(const cancel of ['button','Escape','close'] as const)test(`File Load ${cancel} cancels pending assets and late completion cannot replace a newer farm`,async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const before=await save(page);
  const source=readFileSync(new URL('../../../simfarm-dos/SCEN4.SSM',import.meta.url));
  const replacement=new GameSimulation(readScenario(source),browserCrops).withAllCrops(browserCrops).save(4);
  let release!:()=>void,seen!:()=>void,finished!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve),requested=new Promise<void>(resolve=>seen=resolve),settled=new Promise<void>(resolve=>finished=resolve);
  await page.route('**/assets/scenario4.tiles.png',async route=>{
    seen();await gate;
    try{if(cancel==='Escape')await route.fulfill({status:404,body:'Late failure'});else await route.continue();}
    catch{/* The browser may already have cancelled the network request. */}
    finally{finished();}
  });
  try{
    await load(page,replacement);await requested;
    const dialog=page.getByRole('dialog',{name:'Loading game',exact:true});
    await expect(dialog).toBeVisible();await expect(page.locator('#file-menu-button')).toBeDisabled();
    if(cancel==='button')await dialog.getByRole('button',{name:'Cancel loading',exact:true}).click();
    else if(cancel==='Escape'){await dialog.locator('.game-window-title').focus();await page.keyboard.press('Escape');}
    else await dialog.locator('.game-window-title>button').click();
    await expect(dialog).toHaveCount(0);await expect(page.locator('#save-status')).toHaveText('Loading cancelled.');
    expect(await save(page)).toBe(before);
    await load(page,before);await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
    release();await settled;await page.unroute('**/assets/scenario4.tiles.png');
    expect(await save(page)).toBe(before);await expect(page.getByRole('dialog',{name:'File error',exact:true})).toHaveCount(0);
    await load(page,replacement);await expect(page.locator('#map-status')).toContainText('Scenario 5');
    expect(await save(page)).toBe(replacement);await expect(dialog).toHaveCount(0);
  }finally{release();}
});
