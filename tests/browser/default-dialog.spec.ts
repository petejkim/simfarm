import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {financeMessageFixture} from '../support/finance-messages';
import {reveal,openWindow} from '../support/workspace';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
function fixture(){const game=financeMessageFixture('default');game.dispatch({type:'advance-day'});expect(game.getSnapshot().finances.defaultDecision?.status).toBe('pending');return game;}
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'default.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await (await download).path())!));}

test('default restores original Message, portrait and YES/NO geometry, truthful real text, movement and a saved pending decision',async({page})=>{
  await start(page);const game=fixture(),text=game.save(4);await load(page,text);
  const win=page.locator('[data-window=default]');await expect(win).toBeVisible();expect(await win.boundingBox()).toEqual({x:192,y:150,width:256,height:192});
  await expect(page.getByRole('region',{name:'Financial default',exact:true})).toBeVisible();
  await expect(page.locator('#default-message-text')).toHaveText('You cannot pay your debts. Your homestead remains yours. Would you like to start a new game?');
  expect(await page.locator('#default-message-text').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  expect(await page.locator('#default-restart').boundingBox()).toEqual({x:232,y:306,width:48,height:24});expect(await page.locator('#default-exit').boundingBox()).toEqual({x:360,y:306,width:48,height:24});
  await expect(page.locator('#default-restart')).toHaveText('YES');await expect(page.locator('#default-exit')).toHaveText('NO');
  const picture=PNG.sync.read(await win.locator('.message-portrait').screenshot()),atlas=PNG.sync.read(readFileSync('public/assets/buy-cards.png'));
  for(let y=0;y<64;y++)for(let x=0;x<112;x++)expect(Array.from(picture.data.subarray((y*112+x)*4,(y*112+x+1)*4))).toEqual(Array.from(atlas.data.subarray(((y+576)*896+x+224)*4,((y+576)*896+x+225)*4)));
  await expect(page.locator('[data-window=bank]')).toBeHidden();const edit=await page.locator('#viewport').boundingBox(),title=win.locator('.game-window-title');
  await title.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');expect(await win.boundingBox()).toMatchObject({x:202,y:151});
  await page.keyboard.press('Escape');await expect(win).toBeVisible();expect(await page.locator('#viewport').boundingBox()).toEqual(edit);
  await openWindow(page,'bank');await expect(page.locator('#borrow-loan')).toBeDisabled();await reveal(page,'#next-day');await expect(page.locator('#next-day')).toBeDisabled();
  await page.clock.fastForward(12000);expect(await save(page)).toEqual(JSON.parse(text));
  await page.screenshot({path:'artifacts/browser-default-dialog.png'});
  await page.reload();await load(page,text);expect(await win.boundingBox()).toMatchObject({x:192,y:150});await expect(page.locator('#default-restart')).toBeVisible();
});

test('NO preserves debt and protected homestead, focuses the native new-game bridge, and loads the exact terminal state',async({page})=>{
  await start(page);const game=fixture(),before=JSON.parse(game.save(4));await load(page,game.save(4));
  await page.locator('#default-exit').focus();await page.keyboard.press('Enter');game.dispatch({type:'resolve-default',choice:'exit'});
  await expect(page.getByRole('region',{name:'Farm session ended',exact:true})).toBeVisible();await expect(page.locator('#default-new-game')).toBeFocused();await expect(page.locator('#default-restart')).toHaveCount(0);
  const after=await save(page);expect(after).toEqual(JSON.parse(game.save(4)));expect(after.runtime.finances.defaultDecision).toEqual({status:'exit',originalExitCode:1});
  expect(after.runtime.finances.debt).toEqual(before.runtime.finances.debt);expect(after.scenario).toEqual(before.scenario);
  await page.reload();await load(page,JSON.stringify(after));await expect(page.locator('#default-new-game')).toBeVisible();
  await page.locator('#default-new-game').click();await expect(page.locator('[data-window=default]')).toHaveCount(0);await expect(page.locator('.new-farm-panel')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('region',{name:'Farm session ended',exact:true})).toBeVisible();expect(await save(page)).toEqual(after);
  const viable=financeMessageFixture('loan-paid');await load(page,viable.save(4));await expect(page.locator('[data-window=default]')).toHaveCount(0);await reveal(page,'#next-day');await expect(page.locator('#next-day')).toBeEnabled();
});

test('YES persists restart without marking debt paid; cancellation retains the frozen farm and a new farm replaces it only after Play',async({page})=>{
  await start(page);const game=fixture();await load(page,game.save(4));await page.locator('#default-restart').click();game.dispatch({type:'resolve-default',choice:'restart'});
  await expect(page.locator('[data-window=default]')).toHaveCount(0);await expect(page.locator('.new-farm-panel')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();const ended=await save(page);expect(ended).toEqual(JSON.parse(game.save(4)));expect(ended.runtime.finances.defaultDecision).toEqual({status:'restart',originalExitCode:2});
  const restored=GameSimulation.load(JSON.stringify(ended),browserCrops).simulation;await page.reload();await load(page,restored.save(4));await expect(page.locator('#default-new-game')).toBeVisible();
  await page.locator('#default-new-game').click();await page.locator('#region-design').click();await expect(page.locator('#play-farm')).toBeVisible();
  await expect(page.locator('#next-day')).toBeDisabled();await page.locator('#play-farm').click();await expect(page.locator('#map-status')).toHaveText('Generated farm · original terrain');await expect(page.locator('[data-window=default]')).toHaveCount(0);
  await reveal(page,'#next-day');await expect(page.locator('#next-day')).toBeEnabled();
});

test('actual foreclosure shows its informational warning before the terminal YES/NO dialog',async({page})=>{
  await start(page);const game=financeMessageFixture('default');await load(page,game.save(4));await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
  await expect(page.locator('[data-finance-notice]')).toHaveAttribute('data-finance-notice','39');await expect(page.locator('[data-window=default]')).toHaveCount(0);
  await page.locator('#finance-message-ok').click();await expect(page.locator('#default-restart')).toBeVisible();expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
