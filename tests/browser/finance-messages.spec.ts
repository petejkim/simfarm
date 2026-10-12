import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {financeMessageFixture} from '../support/finance-messages';
import {FINANCE_MESSAGES,readFinanceMessage} from '../../src/formats/finance-message';
import type {FinanceNoticeId} from '../../src/simulation/events';
import {reveal} from '../support/workspace';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
const events=readFileSync('public/assets/raw/events.dat');
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'finance.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await download).path())!));}
async function message(page:Page,id:FinanceNoticeId){
  const win=page.locator('[data-window=finance-message]');await expect(win).toBeVisible();
  await expect(win.locator('[data-finance-notice]')).toHaveAttribute('data-finance-notice',String(id));
  await expect(page.locator('#finance-message-text')).toHaveText(readFinanceMessage(events,id));
  expect(await win.boundingBox()).toEqual({x:192,y:150,width:256,height:192});
  expect(await page.locator('#finance-message-text').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  expect(await win.locator('.message-portrait').boundingBox()).toEqual({x:264,y:174,width:112,height:64});
  expect(await page.locator('#finance-message-ok').boundingBox()).toEqual({x:296,y:306,width:48,height:24});
  const portrait=FINANCE_MESSAGES[id].portrait;
  expect(await win.locator('.message-portrait').evaluate(el=>(el as HTMLElement).style.backgroundPosition.split(' ').map(parseFloat))).toEqual([-(portrait%8)*112,-Math.floor(portrait/8)*64]);
  await page.locator('#finance-message-ok').click();
}

test('annual assessment and overdue warnings show the original text/portraits once and retain canonical saves',async({page})=>{
  await start(page);
  for(const [kind,id] of [['annual',159],['estimate',161],['tax-warning',162],['loan-new',166],['loan-warning',169]] as const){
    const game=financeMessageFixture(kind);await load(page,game.save(4));await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
    await message(page,id);await expect(page.locator('#finance-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    await page.reload();await load(page,game.save(4));await expect(page.locator('#finance-message-ok')).toHaveCount(0);
  }
});

test('paid and forced-sale notices follow original balance-before-tax order and reach the saved default decision',async({page})=>{
  await start(page);
  for(const [kind,ids] of [['tax-paid',[163]],['loan-paid',[170]],['both',[170,163]],['tax-sale',[36,165]],['loan-sale',[39,168]],['default',[39]]] as const){
    const game=financeMessageFixture(kind);await load(page,game.save(4));await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
    for(const id of ids)await message(page,id);
    await expect(page.locator('#finance-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    if(kind==='default'){await expect(page.getByRole('region',{name:'Financial default',exact:true})).toBeVisible();await page.locator('#default-exit').click();game.dispatch({type:'resolve-default',choice:'exit'});expect(await save(page)).toEqual(JSON.parse(game.save(4)));}
  }
});

test('financial popup uses original portrait pixels, blocks background input, moves, suspends time and supports keyboard acknowledgement',async({page})=>{
  await start(page);const game=financeMessageFixture('loan-new');await load(page,game.save(4));await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
  const win=page.locator('[data-window=finance-message]');await expect(win).toBeVisible();
  const portrait=PNG.sync.read(await win.locator('.message-portrait').screenshot()),atlas=PNG.sync.read(readFileSync('public/assets/buy-cards.png'));
  for(let y=0;y<64;y++)for(let x=0;x<112;x++)expect(Array.from(portrait.data.subarray((y*112+x)*4,(y*112+x+1)*4))).toEqual(Array.from(atlas.data.subarray(((y+576)*896+x+224)*4,((y+576)*896+x+225)*4)));
  expect(await win.evaluate(el=>(el as HTMLDialogElement).matches(':modal'))).toBe(true);
  const blockedDate=await page.locator('#farm-date').textContent(),next=(await page.locator('#next-day').boundingBox())!;
  await page.mouse.click(next.x+next.width/2,next.y+next.height/2);await expect(win).toBeVisible();await expect(page.locator('#farm-date')).toHaveText(blockedDate!);
  const title=win.locator('.game-window-title');await title.focus();await page.keyboard.press('ArrowRight');expect(await win.boundingBox()).toMatchObject({x:202,y:150});
  const date=await page.locator('#farm-date').textContent();await page.clock.fastForward(12000);await expect(page.locator('#farm-date')).toHaveText(date!);
  await page.screenshot({path:'artifacts/browser-finance-message.png'});
  await page.keyboard.press('Tab');await expect(page.locator('#finance-message-ok')).toBeFocused();await page.keyboard.press('Enter');
  await expect(win).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});await expect(win).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});

test('Escape acknowledges only the current message; the next queued notice starts at the original position',async({page})=>{
  await start(page);const game=financeMessageFixture('both');await load(page,game.save(4));await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
  const win=page.locator('[data-window=finance-message]');await expect(win.locator('[data-finance-notice]')).toHaveAttribute('data-finance-notice','170');
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');await message(page,163);
  const checkpoint=await save(page);expect(checkpoint).toEqual(JSON.parse(game.save(4)));
  const restored=GameSimulation.load(JSON.stringify(checkpoint),browserCrops).simulation;await page.reload();await load(page,restored.save(4));await expect(win).toHaveCount(0);
});

test('a running farm waits for acknowledgement and resumes without accumulated wall-clock time',async({page})=>{
  // Runs ~16 s of mocked frames; each simulated tick republishes and repaints the full map. Alone this takes
  // ~30 s (the default limit), so parallel load timed it out mid-run. Budget for that load.
  test.setTimeout(120_000);
  await start(page);const game=financeMessageFixture('loan-new');await load(page,game.save(4));
  await reveal(page,'#play-pause');await page.locator('#play-pause').click();await page.clock.runFor(4200);
  await expect(page.locator('#finance-message-ok')).toBeVisible();await expect(page.locator('#time-status')).toContainText('Running · 1 days advanced');
  const date=await page.locator('#farm-date').textContent();await page.clock.runFor(8000);await expect(page.locator('#farm-date')).toHaveText(date!);await expect(page.locator('#time-status')).toContainText('Running · 1 days advanced');
  await page.locator('#finance-message-ok').click();await page.clock.runFor(4016);await expect(page.locator('#time-status')).toContainText('Running · 2 days advanced');
});
