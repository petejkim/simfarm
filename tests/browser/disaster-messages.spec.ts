import {readSaveText} from '../support/save-file';
import { chooseDisaster } from '../support/disaster-menu';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {disasterFixture} from '../support/disasters';
import {browserCrops} from '../support/crop-catalog';
import {DISASTER_MESSAGES,readDisasterMessage} from '../../src/formats/disaster-message';
import type {DisasterNoticeId} from '../../src/simulation/events';
import {financeMessageFixture} from '../support/finance-messages';
import {readNativeSave,writeNativeSave} from '../../src/formats/native-save';
import {GameSimulation} from '../support/game';
import {reveal, speedItem } from '../support/workspace';
const events=readFileSync('public/assets/raw/events.dat');
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'disaster.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
async function message(page:Page,id:DisasterNoticeId){
  const win=page.locator('[data-window=disaster-message]');await expect(win.locator('[data-disaster-notice]')).toHaveAttribute('data-disaster-notice',id);
  const lines=readDisasterMessage(events,id),rendered=page.locator('#disaster-message-text .message-line');
  await expect(rendered).toHaveText(lines.map(l=>l.text));
  expect(await rendered.evaluateAll(es=>es.map(e=>getComputedStyle(e).textAlign))).toEqual(lines.map(l=>l.centered?'center':'start'));
  await expect(page.locator('#disaster-message-text')).not.toContainText('`');await expect(page.locator('#disaster-message-text')).not.toContainText('~');
  expect(await page.locator('#disaster-message-text').evaluate(el=>el.scrollHeight<=el.clientHeight)).toBe(true);
  const portrait=DISASTER_MESSAGES[id].portrait,actual=PNG.sync.read(await win.locator('.message-portrait').screenshot()),atlas=PNG.sync.read(readFileSync('public/assets/buy-cards.png'));
  for(let y=0;y<64;y++)expect(actual.data.subarray(y*112*4,(y+1)*112*4)).toEqual(atlas.data.subarray(((Math.floor(portrait/8)*64+y)*896+portrait%8*112)*4,((Math.floor(portrait/8)*64+y)*896+portrait%8*112+112)*4));
  return win;
}

test('all six original menu starts restore original text and portrait pixels, honor Messages, and preserve canonical checkpoints',async({page})=>{
  await start(page);
  for(const enabled of [true,false])for(const kind of ['frost','wind','tornado','drought','flood','swarm'] as const){
    const f=disasterFixture();f.state.scenario.fields[1].bytes[14]=1;f.state.scenario.farm.messages=enabled;
    const game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));
    await chooseDisaster(page,kind);game.dispatch({type:'disaster-menu',action:kind});
    if(enabled||DISASTER_MESSAGES[kind].mandatory){const win=await message(page,kind);if(kind==='flood')await win.screenshot({path:'artifacts/browser-disaster-flood-message.png'});await page.keyboard.press('Escape');}
    await expect(page.locator('#disaster-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    await load(page,game.save(4));await expect(page.locator('#disaster-message-ok')).toHaveCount(0);
  }
});

test('all four natural endings show source records once and honor disabled Messages',async({page})=>{
  await start(page);
  for(const enabled of [true,false])for(const kind of ['wind','tornado','drought','flood'] as const){
    const f=disasterFixture();f.state.scenario.farm.messages=enabled;f.state.disasters.enabled=false;
    f.state.disasters.flags={wind:8,tornado:1,drought:2,flood:4}[kind];f.state.scenario.farm.calendar.day=6;
    f.state.scenario.farm.animationTicks=3000;f.state.weather.soilMoisture=5;f.state.waterDisasters.counter=9;
    const game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));await (await speedItem(page,'#next-day')).click();game.dispatch({type:'advance-day'});
    if(enabled){await message(page,`${kind}-ended`);await page.locator('#disaster-message-ok').click();}
    await expect(page.locator('#disaster-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
});

test('disaster Message moves, blocks input, waits during a running farm and resumes without catch-up',async({page})=>{
  await start(page);const f=disasterFixture();f.state.disasters.enabled=false;f.state.disasters.flags=8;f.state.scenario.farm.calendar.day=6;
  const game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));await (await speedItem(page,'#play-pause')).click();await page.clock.runFor(4200);
  const win=await message(page,'wind-ended');expect(await win.evaluate(el=>(el as HTMLDialogElement).matches(':modal'))).toBe(true);
  const date=await page.locator('#farm-date').textContent();await page.clock.runFor(8000);await expect(page.locator('#farm-date')).toHaveText(date!);
  const next=(await page.locator('#speed-menu-button').boundingBox())!;await page.mouse.click(next.x+next.width/2,next.y+next.height/2);await expect(page.locator('#original-speed-menu')).toHaveCount(0);await expect(win).toBeVisible();await expect(page.locator('#farm-date')).toHaveText(date!);
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  await page.screenshot({path:'artifacts/browser-disaster-message.png'});await page.keyboard.press('Tab');await expect(page.locator('#disaster-message-ok')).toBeFocused();await page.keyboard.press('Enter');await expect(win).toHaveCount(0);
  await page.clock.runFor(4016);await expect(page.locator('#time-status')).toContainText('Running · 2 days advanced');
});


test('disaster and financial notices share publication order and acknowledge independently',async({page})=>{
  await start(page);const state=readNativeSave(financeMessageFixture('loan-new').save(4)).state;
  state.disasters.flags=8;state.disasters.enabled=false;state.scenario.climate.wind.fill(5);state.weather.windAnomaly=0;
  const game=GameSimulation.load(writeNativeSave(state,4),browserCrops).simulation;
  await load(page,game.save(4));await (await speedItem(page,'#next-day')).click();game.dispatch({type:'advance-day'});
  await message(page,'wind-ended');await expect(page.locator('#finance-message-ok')).toHaveCount(0);await page.keyboard.press('Escape');
  await expect(page.locator('[data-finance-notice]')).toHaveAttribute('data-finance-notice','166');await page.locator('#finance-message-ok').click();
  await expect(page.locator('#disaster-message-ok,#finance-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
