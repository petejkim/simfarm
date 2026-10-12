import {readSaveText} from '../support/save-file';
import { focusEdit } from '../support/workspace';
import {test,expect} from '@playwright/test';

test('independent windows retain positions and controls, raise on interaction and close without closing their neighbors',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await(await p).path())!));}
  const before=await save();await page.locator('#window-buy').click();const buy=page.locator('[data-window=buy]'),bank=page.locator('[data-window=bank]');
  const title=buy.locator('.game-window-title');await title.focus();for(let i=0;i<20;i++)await page.keyboard.press('ArrowRight');
  const position=await buy.boundingBox();await buy.getByRole('button',{name:'Machinery',exact:true}).click();
  await page.locator('#window-bank').click();await expect(buy).toBeVisible();await expect(bank).toBeVisible();
  await expect(bank).toHaveAttribute('data-front','true');await expect(buy).toHaveAttribute('data-front','false');
  expect(await title.evaluate(e=>getComputedStyle(e).backgroundImage)).toContain('window-title-inactive.png');
  await title.click({position:{x:230,y:8}});await expect(buy).toHaveAttribute('data-front','true');await expect(bank).toHaveAttribute('data-front','false');
  expect(await buy.boundingBox()).toEqual(position);await expect(page.locator('#buy-description')).toContainText('Tractor');
  await page.screenshot({path:'artifacts/browser-window-stacking.png'});
  await buy.getByRole('button',{name:'CLOSE',exact:true}).click();await expect(buy).toBeHidden();await expect(bank).toBeVisible();await expect(bank).toHaveAttribute('data-front','true');
  await page.keyboard.press('Escape');await expect(bank).toBeHidden();expect(await save()).toEqual(before);
});

test('original launchers toggle only their own window and Edit remains permanent',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#window-buy').click();await page.locator('#window-bank').click();
  await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Buy',exact:true}).click();
  await expect(page.locator('[data-window=buy]')).toBeHidden();await expect(page.locator('[data-window=bank]')).toBeVisible();
  await page.locator('#window-bank').click();await expect(page.locator('[data-window=bank]')).toBeHidden();
  await page.locator('#window-buy').click();await page.locator('#window-map').click();
  await focusEdit(page);await expect(page.locator('.game-window:visible')).toHaveCount(2);await expect(page.locator('#viewport')).toBeVisible();
  await focusEdit(page);await expect(page.locator('#viewport')).toBeVisible();
});


test('toolbar raises background windows without resetting controls, then toggles the front closed',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await(await p).path())!));}
  const before=await save();
  const buy=page.locator('[data-window=buy]'),bank=page.locator('[data-window=bank]');
  await page.locator('#window-buy').click();await buy.getByRole('button',{name:'Machinery',exact:true}).click();
  await buy.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  const position=await buy.boundingBox();
  await page.locator('#window-bank').click();
  for(let i=0;i<2;i++){
    await page.locator('#window-buy').click();await expect(buy).toHaveAttribute('data-front','true');await expect(bank).toBeVisible();
    await expect(page.locator('#buy-description')).toContainText('Tractor');expect(await buy.boundingBox()).toEqual(position);
    await page.locator('#window-bank').click();await expect(bank).toHaveAttribute('data-front','true');await expect(buy).toBeVisible();
  }
  await page.screenshot({path:'artifacts/browser-toolbar-raise.png'});
  await page.locator('#window-bank').click();await expect(bank).toBeHidden();await expect(buy).toHaveAttribute('data-front','true');
  await page.locator('#window-buy').click();await expect(buy).toBeHidden();expect(await save()).toEqual(before);
});

test('the map stays behind floating windows without a title or stack entry, and Edit preserves them',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  async function save(){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await(await p).path())!));}
  const before=await save(),map=page.locator('#viewport'),mapBox=await map.boundingBox();
  expect(mapBox!.y).toBe(64);await expect(page.locator('.edit-title,[data-window=edit]')).toHaveCount(0);
  const buy=page.locator('[data-window=buy]'),bank=page.locator('[data-window=bank]');
  await page.locator('#window-buy').click();await buy.getByRole('button',{name:'Machinery',exact:true}).click();
  await buy.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');const position=await buy.boundingBox();
  await page.locator('#window-bank').click();
  for(const route of ['keyboard','menu'] as const){
    if(route==='keyboard')await map.focus();
    else {await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Edit',exact:true}).click();}
    await expect(buy).toBeVisible();await expect(bank).toBeVisible();await expect(map).toBeFocused();
    expect(await map.boundingBox()).toEqual(mapBox);expect(await buy.boundingBox()).toEqual(position);
    await expect(page.locator('#buy-description')).toContainText('Tractor');
    const r=(await bank.boundingBox())!;
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('[data-window]')?.getAttribute('data-window'),{x:r.x+r.width/2,y:r.y+8})).toBe('bank');
    await page.locator('#windows-menu-button').click();
    for(const name of ['Buy','Bank','Edit'])await expect(page.getByRole('menuitemcheckbox',{name,exact:true})).toHaveAttribute('aria-checked','true');
    await page.keyboard.press('Escape');await page.locator('#window-buy').click();await expect(buy).toHaveAttribute('data-front','true');
    await page.locator('#window-bank').click();await expect(bank).toHaveAttribute('data-front','true');
  }
  await page.screenshot({path:'artifacts/browser-permanent-map.png'});
  expect(await save()).toEqual(before);
  await page.locator('#load-farm-file').setInputFiles({name:'map.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(before))});
  await expect(page.locator('#save-status')).toHaveText('Farm loaded.');
  await expect(buy).toBeHidden();await expect(bank).toBeHidden();
  await page.locator('#windows-menu-button').click();await expect(page.getByRole('menuitemcheckbox',{name:'Buy',exact:true})).toHaveAttribute('aria-checked','false');
});

test('palette popups remain usable over open windows while the map stays behind them',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#window-bank').click();const bank=page.locator('[data-window=bank]');
  await bank.locator('.game-window-title').focus();
  for(let i=0;i<13;i++)await page.keyboard.press('ArrowLeft');
  for(let i=0;i<4;i++)await page.keyboard.press('ArrowUp');
  for(const name of ['Plant','Spray']){
    await page.getByRole('button',{name,exact:true}).click();
    const item=page.getByRole('menuitem').first(),box=(await item.boundingBox())!;
    expect(await item.evaluate((e,p)=>e.contains(document.elementFromPoint(p.x+p.width/2,p.y+p.height/2)),box)).toBe(true);
    await item.click();await expect(bank).toBeVisible();await expect(page.locator('.field-tool-menu')).toHaveCount(0);
  }
});
