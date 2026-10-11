import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {disasterFixture} from '../support/disasters';
import {financeMessageFixture} from '../support/finance-messages';
import {browserCrops} from '../support/crop-catalog';
import {GameSimulation} from '../support/game';
import {reveal,openWindow,acknowledgeFinanceMessages} from '../support/workspace';
const names=['Tornado','Locusts','Drought','Flood','Frost','Windstorm','Disable'];
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'disasters.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){await acknowledgeFinanceMessages(page);const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await download).path())!,'utf8'));}
async function choose(page:Page,name:string){await acknowledgeFinanceMessages(page);await page.locator('#disasters-menu-button').click();await page.getByRole('menuitemcheckbox',{name,exact:true}).click();}
async function checks(page:Page,expected:boolean[]){await page.locator('#disasters-menu-button').click();for(let i=0;i<7;i++)await expect(page.getByRole('menuitemcheckbox',{name:names[i],exact:true})).toHaveAttribute('aria-checked',String(expected[i]));await page.keyboard.press('Escape');}

test('Disasters opens the seven original real-text rows at source scale, with keyboard controls and live Disable state',async({page})=>{
  await start(page);const before=await save(page);await page.locator('#disasters-menu-button').focus();await page.keyboard.press('ArrowDown');
  const menu=page.getByRole('menu',{name:'Disasters',exact:true}),items=menu.getByRole('menuitemcheckbox');
  expect(await menu.boundingBox()).toEqual({x:288,y:16,width:104,height:88});
  expect(await items.evaluateAll(els=>els.map(el=>[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')))).toEqual(names);
  await expect(items.first()).toBeFocused();await page.keyboard.press('End');await expect(items.last()).toBeFocused();await page.keyboard.press('Enter');await expect(menu).toHaveCount(0);await expect(page.locator('#disasters-menu-button')).toBeFocused();
  const after=await save(page);before.runtime.disasters.enabled=false;expect(after).toEqual(before);await checks(page,[false,false,false,false,false,false,true]);
  await page.locator('#disasters-menu-button').click();await page.screenshot({path:'artifacts/browser-disaster-menu.png'});await page.locator('.original-control-bar').click({position:{x:600,y:8}});await expect(menu).toHaveCount(0);
  await expect(page.locator('[data-window=disasters]')).toBeHidden();await openWindow(page,'disasters');await expect(page.locator('#disasters-panel')).toBeVisible();
});

test('each source menu choice starts its actual disaster from Disable, restores the correct checks and saves canonical effects',async({page})=>{
  await start(page);const f=disasterFixture();f.state.disasters.enabled=false;
  const base=f.load().withAllCrops(browserCrops).save(4),actions=['tornado','swarm','drought','flood','frost','wind'] as const;
  for(const [i,action] of actions.entries()){
    await load(page,base);const game=GameSimulation.load(base,browserCrops).simulation;
    await choose(page,names[i]);game.dispatch({type:'disaster-menu',action});expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    await checks(page,actions.map((_,j)=>i===j).concat(false));const checkpoint=await save(page);await load(page,JSON.stringify(checkpoint));expect(await save(page)).toEqual(checkpoint);
  }
});

test('Disable does not cancel an active swarm; its damage continues and checked events are not stop switches',async({page})=>{
  await start(page);const f=disasterFixture(),game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));
  await choose(page,'Locusts');game.dispatch({type:'disaster-menu',action:'swarm'});await choose(page,'Disable');game.dispatch({type:'disaster-menu',action:'disable'});
  await checks(page,[false,true,false,false,false,false,true]);await choose(page,'Locusts');game.dispatch({type:'disaster-menu',action:'swarm'});await expect(page.locator('#map-interaction-result')).toHaveText('That disaster is already active.');
  await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  const field=game.getSnapshot().scenario.fields[1];expect(field.bytes[18]|field.bytes[19]<<8).toBeGreaterThan(0);
});

test('failed locust choices leave Disable checked without phantom events, and naturally ended events clear their checks',async({page})=>{
  await start(page);const f=disasterFixture();f.state.disasters.enabled=false;for(const field of f.state.scenario.fields)field.bytes[7]&=~1;
  const game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));const before=await save(page);await choose(page,'Locusts');await expect(page.locator('#map-interaction-result')).toHaveText('Create a field before starting locusts.');expect(await save(page)).toEqual(before);await checks(page,[false,false,false,false,false,false,true]);
  const end=disasterFixture();end.state.disasters.flags=16;end.state.disasters.enabled=false;end.state.weather.temperatureAnomaly=0;const ending=end.load().withAllCrops(browserCrops);await load(page,ending.save(4));
  await checks(page,[false,false,false,false,true,false,true]);await reveal(page,'#next-day');await page.locator('#next-day').click();ending.dispatch({type:'advance-day'});await checks(page,[false,false,false,false,false,false,true]);expect(await save(page)).toEqual(JSON.parse(ending.save(4)));
});

test('pending financial decisions disable every disaster action while the popup remains keyboard dismissible',async({page})=>{
  await start(page);const game=financeMessageFixture('default');game.dispatch({type:'advance-day'});await load(page,game.save(4));
  const before=await save(page);await page.locator('#disasters-menu-button').click();const menu=page.getByRole('menu',{name:'Disasters',exact:true});
  await expect(menu).toBeFocused();for(const name of names)await expect(menu.getByRole('menuitemcheckbox',{name,exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(page.locator('#disasters-menu-button')).toBeFocused();expect(await save(page)).toEqual(before);
});
