import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readScenario} from '../../src/formats/scenario';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
import {TOWN_CHOICES,TOWN_INSTRUCTIONS} from '../../src/formats/town-choice';
function pending(){
  const scenario=readScenario(readFileSync('../simfarm-dos/SCEN4.SSM'));scenario.schedule.bytes.fill(0);
  Object.assign(scenario.farm.calendar,{day:6,week:3,month:11});
  const save=JSON.parse(new GameSimulation(scenario,browserCrops).withAllCrops(browserCrops).save(4));
  save.runtime.finances.town.townRevenue=50000;save.runtime.finances.town.recreationCount=0;
  const game=GameSimulation.load(JSON.stringify(save),browserCrops).simulation;game.dispatch({type:'advance-day'});
  expect(game.getSnapshot().pendingTown).not.toBeNull();return game.save(4);
}
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'town.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await download).path())!));}

test('town choice restores original picture geometry, actual captions and instructions, bevel, movement and pending save',async({page})=>{
  await start(page);const text=pending();await load(page,text);
  const win=page.getByRole('dialog',{name:'Town development',exact:true});expect(await win.boundingBox()).toEqual({x:96,y:96,width:368,height:224});
  expect(await page.locator('.town-caption').allTextContents()).toEqual(TOWN_CHOICES.map(c=>c.label));await expect(page.locator('.town-instructions')).toHaveText(TOWN_INSTRUCTIONS);
  expect(await page.locator('.town-instructions').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  // Source picture buttons (bitmap x, y32; 72×72 plus a 1px shadow) with faces cut from the bitmap inside the bevel.
  for(const c of TOWN_CHOICES){const button=page.locator(`#town-${c.choice}`);
    expect(await button.boundingBox()).toEqual({x:96+c.x,y:128,width:72,height:72});
    expect(await button.locator('.bevel-button-face').evaluate(el=>[(el as HTMLElement).style.backgroundImage.includes('town-choice.png'),(el as HTMLElement).style.backgroundPosition])).toEqual([true,`${-(c.x+3)}px -35px`]);}
  await expect(win.locator('img,canvas')).toHaveCount(0);
  const face=page.locator('#town-airport .bevel-button-face'),top=()=>face.evaluate(el=>getComputedStyle(el).borderTopColor);
  expect(await top()).toBe('rgb(255, 255, 255)');
  await page.mouse.move(320,160);await page.mouse.down();
  expect(await top()).toBe('rgb(130, 130, 130)'); // pressed: bevel colours swap
  await page.mouse.move(470,330);await page.mouse.up();await expect(win).toBeVisible();
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');expect(await win.boundingBox()).toMatchObject({x:106,y:97});
  await page.keyboard.press('Escape');await expect(win).toBeVisible();expect(await save(page)).toEqual(JSON.parse(text));
  await page.screenshot({path:'artifacts/browser-town-choice.png'});
});

test('all four source choices and explicit random decision resume the exact canonical annual/save state',async({page})=>{
  await start(page);const text=pending();
  for(const choice of [...TOWN_CHOICES.map(c=>c.choice),'timeout'] as const){
    await load(page,text);const game=GameSimulation.load(text,browserCrops).simulation;
    await page.locator(`#town-${choice}`).click();game.dispatch({type:'choose-town',choice});
    await expect(page.locator('#town-choice')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
});

test('pending town decisions do not expire under browser time and keyboard choice remains available after reload',async({page})=>{
  await start(page);const text=pending();await load(page,text);await page.clock.fastForward(60000);
  expect(await save(page)).toEqual(JSON.parse(text));await page.reload();await load(page,text);
  await page.locator('#town-commercial').focus();await page.keyboard.press('Enter');await expect(page.locator('#town-choice')).toHaveCount(0);
  const game=GameSimulation.load(text,browserCrops).simulation;game.dispatch({type:'choose-town',choice:'commercial'});expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});

test('a rejected random recreational district retains the paid reservation and consumed random draw through save/load',async({page})=>{
  await start(page);const checkpoint=JSON.parse(pending());checkpoint.runtime.finances.town.recreationCount=7;checkpoint.runtime.random.bounded=6;
  const text=JSON.stringify(checkpoint),game=GameSimulation.load(text,browserCrops).simulation;await load(page,text);
  await page.locator('#town-timeout').click();game.dispatch({type:'choose-town',choice:'timeout'});
  await expect(page.locator('#town-choice-error')).toContainText('cannot support');
  const retained=await save(page);expect(retained).toEqual(JSON.parse(game.save(4)));expect(retained.runtime.pendingTown).toEqual(checkpoint.runtime.pendingTown);expect(retained.runtime.random.bounded).not.toBe(6);
  await page.reload();await load(page,JSON.stringify(retained));await page.locator('#town-airport').click();game.dispatch({type:'choose-town',choice:'airport'});
  await expect(page.locator('#town-choice')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
