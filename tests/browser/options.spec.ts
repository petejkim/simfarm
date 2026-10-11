import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
import {financeMessageFixture} from '../support/finance-messages';
import {openWindow,reveal,acknowledgeFinanceMessages} from '../support/workspace';
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function toggle(page:Page,name:string){await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name,exact:true}).click();}
async function save(page:Page){await acknowledgeFinanceMessages(page);const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await download).path())!,'utf8'));}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'options.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
const position=(page:Page)=>page.locator('#viewport').evaluate(el=>[el.scrollLeft,el.scrollTop]);

test('original eight-row Options dropdown has real text, source geometry, live checks and keyboard navigation',async({page})=>{
  await start(page);const before=await save(page);await page.locator('#options-menu-button').focus();await page.keyboard.press('ArrowDown');
  const menu=page.getByRole('menu',{name:'Options',exact:true}),items=menu.getByRole('menuitemcheckbox');
  expect(await menu.boundingBox()).toEqual({x:64,y:16,width:120,height:100});
  expect(await items.evaluateAll(els=>els.map(el=>[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')))).toEqual(['Music','Sound Effects','AutoBuy','AutoScroll','AutoDoze','AutoGoto','Messages','AutoLease']);
  expect(await items.evaluateAll(els=>els.map(el=>el.getAttribute('aria-checked')))).toEqual(['true','true','true','true','false','true','true','true']);
  await expect(items.nth(0)).toBeFocused();await page.keyboard.press('End');await expect(items.nth(7)).toBeFocused();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);await expect(page.locator('#options-menu-button')).toBeFocused();
  const after=await save(page);before.scenario.farm.autoBuySeeds=false;expect(after).toEqual(before);
  await page.locator('#options-menu-button').click();await page.screenshot({path:'artifacts/browser-options.png'});await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
  await page.locator('#options-menu-button').click();await page.locator('.edit-title').click({position:{x:600,y:8}});await expect(menu).toHaveCount(0);
});

test('all farm preferences survive downloads and reloads with unchanged canonical simulation',async({page})=>{
  await start(page);const before=await save(page),game=GameSimulation.load(JSON.stringify(before),browserCrops).simulation;
  const pairs=[['AutoBuy','autoBuySeeds'],['AutoScroll','autoScroll'],['AutoDoze','autoClear'],['AutoGoto','autoGoto'],['Messages','messages'],['AutoLease','autoRent']] as const;
  for(const [name,option] of pairs){await toggle(page,name);game.dispatch({type:'set-option',option,enabled:!game.getSnapshot().scenario.farm[option]});}
  const changed=await save(page);expect(changed).toEqual(JSON.parse(game.save(0)));await load(page,JSON.stringify(changed));expect(await save(page)).toEqual(changed);
  await page.locator('#options-menu-button').click();for(const [name,key] of pairs)await expect(page.getByRole('menuitemcheckbox',{name,exact:true})).toHaveAttribute('aria-checked',String(changed.scenario.farm[key]));
});

test('AutoScroll moves two source tiles at the viewport edge, stops when disabled and preserves manual navigation',async({page})=>{
  await start(page);await page.locator('#viewport').evaluate(el=>el.scrollTo(96,96));const b=(await page.locator('#viewport').boundingBox())!;
  await page.mouse.move(b.x+b.width-6,b.y+180);await page.clock.runFor(240);expect(await position(page)).toEqual([128,96]);
  await toggle(page,'AutoScroll');await page.mouse.move(b.x+b.width-6,b.y+180);const stopped=await position(page);await page.clock.runFor(500);expect(await position(page)).toEqual(stopped);
  await page.mouse.move(b.x+200,b.y+200);await page.locator('#viewport').focus();await page.keyboard.press('ArrowLeft');expect((await position(page))[0]).toBe(stopped[0]-64);
  await toggle(page,'AutoScroll');await page.mouse.move(b.x+1,b.y+1);await page.clock.runFor(500);expect(await position(page)).toEqual([0,32]);
  await page.mouse.move(300,8);const left=await position(page);await page.clock.runFor(500);expect(await position(page)).toEqual(left);
});

test('AutoGoto centers a newly started disaster while disabling it keeps the map in place',async({page})=>{
  await start(page);const initial=await save(page);
  for(const enabled of [false,true]){
    const data=structuredClone(initial);data.scenario.farm.autoGoto=enabled;await load(page,JSON.stringify(data));
    await page.locator('#viewport').evaluate(el=>el.scrollTo(40,50));await reveal(page,'#start-tornado');await page.locator('#start-tornado').click();
    const saved=await save(page),p=saved.runtime.disasters.tornado;
    const expected=await page.locator('#viewport').evaluate((el,p)=>[Math.max(0,Math.min(el.scrollWidth-el.clientWidth,p.x*16-el.clientWidth/2)),Math.max(0,Math.min(el.scrollHeight-el.clientHeight,p.y*16-el.clientHeight/2))],p);
    expect(await position(page)).toEqual(enabled?expected:[40,50]);
  }
});

test('Messages off suppresses optional auction warnings but retains mandatory debt results',async({page})=>{
  await start(page);const game=financeMessageFixture('loan-sale');await load(page,game.save(4));await toggle(page,'Messages');game.dispatch({type:'set-option',option:'messages',enabled:false});
  await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
  await expect(page.locator('[data-finance-notice]')).toHaveAttribute('data-finance-notice','168');await page.locator('#finance-message-ok').click();await expect(page.locator('#finance-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});

test('Music starts genfarm MIDI, sound toggles independently and advanced audio stays accessible',async({page})=>{
  await start(page);const requests:string[]=[];page.on('request',r=>{if(r.url().includes('genfarm'))requests.push(r.url());});
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing genfarm');expect(requests.length).toBeGreaterThan(0);
await expect(page.getByRole('menuitemcheckbox',{name:'Music',exact:true})).toBeChecked();await expect(page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true})).toBeChecked();await page.keyboard.press('Escape');
  await openWindow(page,'options');await expect(page.locator('#music')).toHaveValue('genfarm');await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','true');
  await toggle(page,'Music');await expect(page.locator('#audio-status')).toHaveText('Music off');await toggle(page,'Sound Effects');await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed','false');
});


test('Options persist across browser reloads while explicit checkpoints retain their gameplay settings',async({page})=>{
  await start(page);const original=await save(page);
  const names=['Music','Sound Effects','AutoBuy','AutoScroll','AutoDoze','AutoGoto','Messages','AutoLease'];
  for(const name of names)await toggle(page,name);
  const changed=await save(page);
  await page.reload();await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();
  const checks=page.getByRole('menu',{name:'Options'}).getByRole('menuitemcheckbox');
  expect(await checks.evaluateAll(els=>els.map(el=>el.getAttribute('aria-checked')))).toEqual(['false','false','false','false','true','false','false','false']);
  await page.keyboard.press('Escape');expect(await save(page)).toEqual(changed);
  await load(page,JSON.stringify(original));expect(await save(page)).toEqual(original);
  await page.locator('#options-menu-button').click();await expect(page.getByRole('menuitemcheckbox',{name:'Music',exact:true})).not.toBeChecked();await expect(page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true})).not.toBeChecked();
});

test('invalid or unavailable preference storage leaves defaults and usable controls',async({page})=>{
  await page.addInitScript(()=>{localStorage.setItem('simfarm.options.v1','{"music":"false","sound":false,"autoScroll":null,"untrusted":true}');});
  await start(page);await page.locator('#options-menu-button').click();await expect(page.getByRole('menuitemcheckbox',{name:'Music',exact:true})).toBeChecked();await expect(page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true})).not.toBeChecked();await expect(page.getByRole('menuitemcheckbox',{name:'AutoScroll',exact:true})).toBeChecked();await page.keyboard.press('Escape');
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage blocked');};});
  await toggle(page,'Music');await expect(page.locator('#audio-status')).toHaveText('Music off');
  await toggle(page,'AutoScroll');await page.locator('#options-menu-button').click();await expect(page.getByRole('menuitemcheckbox',{name:'AutoScroll',exact:true})).not.toBeChecked();
});


test('pointer and keyboard share one highlighted menu item',async({page})=>{
  await start(page);
  for(const title of ['File','Options','Windows','Disasters']){
    await page.locator('#'+title.toLowerCase()+'-menu-button').click();
    const menu=page.getByRole('menu',{name:title,exact:true}),items=menu.locator('button:not(:disabled)');
    const highlighted=()=>items.evaluateAll(els=>els.map((e,i)=>getComputedStyle(e).backgroundColor==='rgb(0, 0, 0)'?i:-1).filter(i=>i>=0));
    await expect(items.nth(0)).toBeFocused();expect(await highlighted()).toEqual([0]);
    await items.nth(2).hover();await expect(items.nth(2)).toBeFocused();expect(await highlighted()).toEqual([2]);
    await page.keyboard.press('ArrowDown');await expect(items.nth(3)).toBeFocused();expect(await highlighted()).toEqual([3]);
    const b=(await items.nth(2).boundingBox())!;await page.mouse.move(b.x+4,b.y+4);await expect(items.nth(2)).toBeFocused();expect(await highlighted()).toEqual([2]);
    await page.keyboard.press('Escape');
  }
});
