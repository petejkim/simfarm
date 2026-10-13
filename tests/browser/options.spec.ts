import {readSaveText} from '../support/save-file';
import {expectOptionChecked} from '../support/options-menu';
import { chooseDisaster } from '../support/disaster-menu';
import {test,expect,type Page} from '@playwright/test';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
import {financeMessageFixture} from '../support/finance-messages';
import {openWindow,reveal,acknowledgeFinanceMessages, speedItem } from '../support/workspace';
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function toggle(page:Page,name:string){await page.locator('#options-menu-button').click();await page.getByRole('menuitemcheckbox',{name,exact:true}).click();}
async function save(page:Page){await acknowledgeFinanceMessages(page);const download=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await download).path())!));}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'options.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
const position=(page:Page)=>page.locator('#viewport').evaluate(el=>[el.scrollLeft,el.scrollTop]);

/** Drop-down menus sit directly under their heading, at least as wide, with uniform item rows. */
async function expectAnchored(menu:import('@playwright/test').Locator){
  const id=await menu.getAttribute('id'),heading=menu.page().locator(`[aria-controls="${id}"]`);
  const h=(await heading.boundingBox())!,m=(await menu.boundingBox())!;
  expect([m.x,m.y]).toEqual([h.x,h.y+h.height]);expect(m.width).toBeGreaterThanOrEqual(h.width);
  const heights=await menu.locator('button').evaluateAll(els=>els.map(e=>e.getBoundingClientRect().height));expect(new Set(heights).size).toBe(1);
}
test('original Options plus native click toggle has real text, source geometry, live checks and keyboard navigation',async({page})=>{
  await start(page);const before=await save(page);await page.locator('#options-menu-button').focus();await page.keyboard.press('ArrowDown');
  const menu=page.getByRole('menu',{name:'Options',exact:true}),items=menu.getByRole('menuitemcheckbox');
  await expectAnchored(menu);
  expect(await items.evaluateAll(els=>els.map(el=>[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')))).toEqual(['Music','Sound Effects','Button Click Sounds','AutoBuy','AutoScroll','AutoDoze','AutoGoto','AutoLease','Messages']);
  expect(await menu.locator('> *').evaluateAll(es=>es.map(e=>e.getAttribute('role')==='separator'?'-':e.textContent!.replace('✓','')))).toEqual(['Music','Sound Effects','Button Click Sounds','-','AutoBuy','AutoScroll','AutoDoze','AutoGoto','AutoLease','-','Messages','-','Settings…']);
  expect(await items.evaluateAll(els=>els.map(el=>el.getAttribute('aria-checked')))).toEqual(['true','true','true','true','true','false','true','true','true']);
  await expect(items.nth(0)).toBeFocused();await page.keyboard.press('End');await expect(menu.getByRole('menuitem',{name:'Settings…',exact:true})).toBeFocused();await page.keyboard.press('Home');for(let i=0;i<3;i++)await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter'); // AutoBuy
  await expect(menu).toHaveCount(0);await expect(page.locator('#options-menu-button')).toBeFocused();
  const after=await save(page);before.scenario.farm.autoBuySeeds=false;expect(after).toEqual(before);
  await page.locator('#options-menu-button').click();await page.screenshot({path:'artifacts/browser-options.png'});await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
  await page.locator('#options-menu-button').click();await page.locator('.original-control-bar').click({position:{x:600,y:8}});await expect(menu).toHaveCount(0);
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
  // Left and top use the same 16px band as right and bottom, not just the outermost pixel.
  await page.locator('#viewport').evaluate(el=>el.scrollTo(160,160));
  await page.mouse.move(b.x+12,b.y+200);await page.clock.runFor(240);expect(await position(page)).toEqual([128,160]);
  await page.mouse.move(b.x+200,b.y+12);await page.clock.runFor(240);expect(await position(page)).toEqual([128,128]);
  await page.mouse.move(b.x+200,b.y+200);const centre=await position(page);await page.clock.runFor(500);expect(await position(page)).toEqual(centre);
  await page.mouse.move(300,8);const left=await position(page);await page.clock.runFor(500);expect(await position(page)).toEqual(left);
});

test('AutoGoto centers a newly started disaster while disabling it keeps the map in place',async({page})=>{
  await start(page);const initial=await save(page);
  for(const enabled of [false,true]){
    const data=structuredClone(initial);data.scenario.farm.autoGoto=enabled;await load(page,JSON.stringify(data));
    await page.locator('#viewport').evaluate(el=>el.scrollTo(40,50));await chooseDisaster(page,'tornado');
    const saved=await save(page),p=saved.runtime.disasters.tornado;
    const expected=await page.locator('#viewport').evaluate((el,p)=>[Math.max(0,Math.min(el.scrollWidth-el.clientWidth,p.x*16-el.clientWidth/2)),Math.max(0,Math.min(el.scrollHeight-el.clientHeight,p.y*16-el.clientHeight/2))],p);
    // Scroll offsets are whole pixels; an odd viewport size makes the exact centre a half pixel.
    const actual=await position(page);(enabled?expected:[40,50]).forEach((v,i)=>expect(Math.abs(actual[i]-v)).toBeLessThanOrEqual(0.5));
  }
});

test('Messages off suppresses optional auction warnings but retains mandatory debt results',async({page})=>{
  await start(page);const game=financeMessageFixture('loan-sale');await load(page,game.save(4));await toggle(page,'Messages');game.dispatch({type:'set-option',option:'messages',enabled:false});
  await (await speedItem(page,'#next-day')).click();game.dispatch({type:'advance-day'});
  await expect(page.locator('[data-finance-notice]')).toHaveAttribute('data-finance-notice','168');await page.locator('#finance-message-ok').click();await expect(page.locator('#finance-message-ok')).toHaveCount(0);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});

test('Music starts amain MIDI, sound toggles independently and advanced audio stays accessible',async({page})=>{
  await start(page);const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('.mid'))requests.push(r.url());});
  await page.locator('#options-menu-button').click();await expect(page.locator('#audio-status')).toContainText('Playing amain');expect(requests.map(url=>url.split('/').pop())).toEqual(['amain.mid']);
await expect(page.getByRole('menuitemcheckbox',{name:'Music',exact:true})).toBeChecked();await expect(page.getByRole('menuitemcheckbox',{name:'Sound Effects',exact:true})).toBeChecked();await page.keyboard.press('Escape');
  await openWindow(page,'options');await expect(page.locator('#music')).toHaveValue('amain');await expectOptionChecked(page,'Sound Effects',true);
  await toggle(page,'Music');await expect(page.locator('#audio-status')).toHaveText('Music off');await toggle(page,'Music');await expect(page.locator('#audio-status')).toContainText('Playing genfarm');await toggle(page,'Sound Effects');await expectOptionChecked(page,'Sound Effects',false);
});


test('Options persist across browser reloads while explicit checkpoints retain their gameplay settings',async({page})=>{
  await start(page);const original=await save(page);
  const names=['Music','Sound Effects','AutoBuy','AutoScroll','AutoDoze','AutoGoto','Messages','AutoLease'];
  for(const name of names)await toggle(page,name);
  const changed=await save(page);
  await page.reload();await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.locator('#options-menu-button').click();
  const checks=page.getByRole('menu',{name:'Options'}).getByRole('menuitemcheckbox');
  expect(await checks.evaluateAll(els=>els.map(el=>el.getAttribute('aria-checked')))).toEqual(['false','false','true','false','false','true','false','false','false']);
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

test('Settings opens from Options, keeps native view/audio controls together and leaves the farm unchanged',async({page})=>{
  await start(page);const before=await save(page),viewport=page.locator('#viewport'),initial=(await viewport.boundingBox())!;
  await page.locator('#options-menu-button').click();
  const entry=page.getByRole('menuitem',{name:'Settings…',exact:true});
  await expect(entry).not.toHaveAttribute('aria-checked');await entry.focus();await page.keyboard.press('Enter');
  const dialog=page.getByRole('dialog',{name:'Settings',exact:true});await expect(dialog).toBeVisible();
  await expect(dialog.locator('#audio-status')).toBeHidden();await expect(dialog.locator('#volume')).toBeVisible();await expect(dialog.locator('#volume')).toHaveValue('80');
  await dialog.locator('#zoom').selectOption('2');await expect(page.locator('#world')).toHaveCSS('width','3072px');
  await dialog.locator('#volume').fill('40');await dialog.locator('#music').selectOption('ffarm');
  await expect(dialog.locator('#audio-status')).toContainText('Playing ffarm');
  expect(await viewport.boundingBox()).toEqual(initial);expect(await save(page)).toEqual(before);
  await dialog.locator('.game-window-title').focus();await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
  await openWindow(page,'options');await expect(dialog.locator('#volume')).toHaveValue('40');await expect(dialog.locator('#zoom')).toHaveValue('2');
  await expect(page.getByRole('dialog',{name:'Preservation progress',exact:true})).toHaveCount(0);
  await page.screenshot({path:'artifacts/browser-settings.png'});
});

test('first enable after a muted startup still plays amain before the Options genfarm track',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('simfarm.options.v1',JSON.stringify({music:false})));
  const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('.mid'))requests.push(r.url().split('/').pop()!);});
  await start(page);await page.locator('#options-menu-button').click();
  await expect(page.locator('#audio-status')).toHaveText('Music off');expect(requests).toEqual([]);
  await page.getByRole('menuitemcheckbox',{name:'Music',exact:true}).click();
  await expect(page.locator('#audio-status')).toContainText('Playing amain');expect(requests).toEqual(['amain.mid']);
});

test('Settings adjusts and remembers separate music and sound volumes without an idle music notice',async({page})=>{
  await page.addInitScript(()=>{
    const Base=window.AudioContext,gains:GainNode[]=[];Object.assign(window,{volumeGains:gains});
    window.AudioContext=class extends Base{constructor(options?:AudioContextOptions){super(options);const make=this.createGain.bind(this);this.createGain=()=>{const g=make();gains.push(g);return g;};}};
  });
  await start(page);
  // Before the first gesture nothing is playing; no notice says so, and the status line is not displayed at all.
  await expect(page.locator('#audio-status')).toHaveText('');await expect(page.getByText(/starts on interaction/)).toHaveCount(0);
  await openWindow(page,'options');const dialog=page.getByRole('dialog',{name:'Settings',exact:true});
  await expect(dialog.locator('#volume')).toHaveAccessibleName('Music volume');await expect(dialog.locator('#sound-volume')).toHaveAccessibleName('Sound volume');
  await expect(dialog.locator('#volume')).toHaveValue('80');await expect(dialog.locator('#sound-volume')).toHaveValue('100'); // defaults
  await dialog.locator('#volume').fill('25');await dialog.locator('#sound-volume').fill('40');
  const gains=()=>page.evaluate(()=>(window as unknown as {volumeGains:GainNode[]}).volumeGains.map(g=>Math.round(g.gain.value*1000)/1000));
  // Music master follows its slider; each effect voice (game sounds and button clicks) scales the original 0.75 mix level.
  await dialog.locator('.game-window-title').click();
  await expect.poll(async()=>(await gains()).filter(g=>g===0.25||g===0.3).sort()).toEqual([0.25,0.3,0.3]);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('simfarm.options.v1')!))).toMatchObject({musicVolume:25,soundVolume:40});
  await page.reload();await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await openWindow(page,'options');await expect(dialog.locator('#volume')).toHaveValue('25');await expect(dialog.locator('#sound-volume')).toHaveValue('40');
  await expect.poll(async()=>(await gains()).filter(g=>g===0.25||g===0.3).sort()).toEqual([0.25,0.3,0.3]);
  await page.screenshot({path:'artifacts/browser-settings-volumes.png'});
});
