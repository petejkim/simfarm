import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {GameSimulation} from '../support/game';
import {writeNativeSave} from '../../src/formats/native-save';
import {worldIndex} from '../../src/formats/scenario';
import {MAP_MODES} from '../../src/formats/map-window';
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'map.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function plot(page:Page,x:number,y:number){await page.locator('.overview-viewport canvas').click({position:{x:x*16+8,y:y*16+8}});}

test('original Map has all source overlays, HTML help and titles, source geometry and usable Edit navigation without changing saved state',async({page})=>{
  await start(page);const before=await save(page);await page.locator('#window-map').click();
  const panel=page.getByRole('region',{name:'Farm overview'}),canvas=panel.locator('.overview-viewport canvas');
  // Shared frame around a 272×232 client of components; the map is the only canvas besides the legend gradient.
  await expect(panel.locator('img')).toHaveCount(0);
  expect(await panel.locator('.overview-mode.bevel-button').count()).toBe(8);
  expect(await panel.getByRole('button',{name:'Weeds',exact:true}).locator('.bevel-button-face').evaluate(el=>getComputedStyle(el).backgroundPosition)).toBe('-43px -6px');
  await expect(panel.locator('.overview-mode-name')).toHaveText('Overhead');
  const frames=new Set<string>();for(const name of MAP_MODES.slice(1)){
    await panel.getByRole('button',{name,exact:true}).click();await expect(panel.locator('.overview-mode-name')).toHaveText(name);
    frames.add(await canvas.evaluate((el:HTMLCanvasElement)=>el.toDataURL()));
  }
  expect(frames.size).toBeGreaterThan(4);
  await panel.getByRole('button',{name:'Field Profit',exact:true}).click();await expect(panel.locator('.overview-mode-name')).toHaveText('Overhead');
  await panel.getByRole('button',{name:'Map help'}).click();await expect(page.getByRole('note',{name:'Map legend'})).toContainText('PROPERTY');
  await panel.getByRole('button',{name:'Map help'}).click();await expect(page.getByRole('note',{name:'Map legend'})).toHaveCount(0);
  await canvas.click({position:{x:16,y:24}});
  await expect.poll(()=>page.locator('#viewport').evaluate(el=>[el.scrollLeft,el.scrollTop])).toEqual([128,192]);
  await expect.poll(()=>page.locator('.overview-edit-outline').evaluate(el=>[parseFloat((el as HTMLElement).style.marginLeft),parseFloat((el as HTMLElement).style.marginTop)])).toEqual([16,24]); // outline offset within the map's grid cell
  await panel.getByRole('button',{name:'Property',exact:true}).click();await plot(page,11,11);await canvas.press('ArrowRight');await canvas.press('ArrowDown');
  await page.screenshot({path:'artifacts/browser-map-property.png'});
  const window=page.getByRole('dialog',{name:'Map',exact:true});await window.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  await panel.getByRole('button',{name:'CLOSE',exact:true}).click();await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Map',exact:true}).click();
  expect(await save(page)).toEqual(before);
});

test('Map buys and sells the selected plot, protects home/fields, rejects other owners and persists canonical ledgers',async({page})=>{
  const {state}=shopFixture();state.scenario.regionalConditions.fill(0);
  for(const [x,y] of [[0,0],[2,2]])state.scenario.regionalConditions[(x*12+y)*7+1]=1;
  state.scenario.regionalConditions[(3*12+3)*7+1]=2;
  state.finances.accounts.homeRegionX=0;state.finances.accounts.homeRegionY=0;
  state.scenario.cells[worldIndex(23,23)].overlay|=0x1000;
  const game=GameSimulation.load(writeNativeSave(state,4),browserCrops).simulation.withAllCrops(browserCrops),initial=game.save(4);
  await start(page);await load(page,initial);await page.locator('#window-map').click();await page.getByRole('button',{name:'Property',exact:true}).click();
  await plot(page,0,0);await page.locator('#map-land-action').click();await expect(page.locator('#map-land-action')).toHaveText('SELL'); // home plot cannot be sold
  await plot(page,2,2);await page.locator('#map-land-action').click();await expect(page.locator('#map-land-action')).toHaveText('SELL'); // fields block the sale
  await plot(page,3,3);await expect(page.locator('#map-land-action')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(initial));
  await plot(page,1,1);await expect(page.locator('#map-land-action')).toHaveText('BUY');
  await page.locator('#map-land-action').click();game.dispatch({type:'buy-land',regionX:1,regionY:1});
  await expect(page.locator('#map-land-action')).toHaveText('SELL');
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.locator('#map-land-action').click();game.dispatch({type:'sell-land',regionX:1,regionY:1});
  await expect(page.locator('#map-land-action')).toHaveText('BUY');expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.reload();await load(page,game.save(4));await page.locator('#window-map').click();await page.getByRole('button',{name:'Property',exact:true}).click();await plot(page,1,1);
  await expect(page.locator('#map-land-action')).toHaveText('BUY');
});

test('Map handles insufficient cash and missing original artwork',async({page})=>{
  const {state}=shopFixture();state.scenario.regionalConditions.fill(0);state.scenario.farm.cash=1;
  await start(page);await load(page,writeNativeSave(state,4));await page.locator('#window-map').click();await page.getByRole('button',{name:'Property',exact:true}).click();
  await expect(page.locator('#map-land-action')).toBeDisabled();
  await page.route('**/assets/map-window.png',r=>r.abort());await page.reload();await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#world')).toHaveCount(0);
});
