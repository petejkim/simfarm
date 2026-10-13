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
  // A click centres the Edit view on the clicked tile (user request), clamped to the farm's edges.
  const viewport=page.locator('#viewport'),centre=()=>viewport.evaluate(el=>[(el.scrollLeft+el.clientWidth/2)/16,(el.scrollTop+el.clientHeight/2)/16].map(v=>Math.round(v*10)/10));
  await canvas.click({position:{x:90,y:110}});
  await expect.poll(centre).toEqual([45.5,55.5]);
  const scroll=await viewport.evaluate(el=>[el.scrollLeft,el.scrollTop]);
  await expect.poll(()=>page.locator('.overview-edit-outline').evaluate(el=>[parseFloat((el as HTMLElement).style.marginLeft),parseFloat((el as HTMLElement).style.marginTop)])).toEqual([scroll[0]/8,scroll[1]/8]); // outline offset within the map's grid cell
  // Dragging keeps the view centred under the pointer.
  const box=(await canvas.boundingBox())!;await page.mouse.move(box.x+90,box.y+110);await page.mouse.down();await page.mouse.move(box.x+100,box.y+90,{steps:3});await page.mouse.up();
  await expect.poll(centre).toEqual([50.5,45.5]);
  // Corners clamp the view to the farm.
  await canvas.click({position:{x:1,y:1}});await expect.poll(()=>viewport.evaluate(el=>[el.scrollLeft,el.scrollTop])).toEqual([0,0]);
  await canvas.click({position:{x:191,y:191}});
  await expect.poll(()=>viewport.evaluate(el=>[el.scrollWidth-el.clientWidth-el.scrollLeft,el.scrollHeight-el.clientHeight-el.scrollTop].map(Math.round))).toEqual([0,0]);
  // Arrow keys move the centre one tile.
  await canvas.click({position:{x:90,y:110}});await expect.poll(centre).toEqual([45.5,55.5]);
  await canvas.press('ArrowRight');await expect.poll(centre).toEqual([46.5,55.5]);
  await panel.getByRole('button',{name:'Property',exact:true}).click();await plot(page,11,11);await canvas.press('ArrowRight');await canvas.press('ArrowDown');
  await page.screenshot({path:'artifacts/browser-map-property.png'});
  const window=page.getByRole('dialog',{name:'Map',exact:true});await window.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');
  await panel.getByRole('button',{name:'CLOSE',exact:true}).click();await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Map',exact:true}).click();
  expect(await save(page)).toEqual(before);
});

test('a closed Map ignores terrain scrolling and shows the current view when opened',async({page})=>{
  // A running clock, so scroll events and frames are delivered.
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const outline=page.locator('.overview-edit-outline'),viewport=page.locator('#viewport');
  await outline.evaluate(el=>{const w=window as unknown as {changes:number};w.changes=0;new MutationObserver(()=>w.changes++).observe(el,{attributes:true});});
  for(const at of [[100,80],[300,240],[520,410]])await viewport.evaluate((v,[x,y])=>v.scrollTo(x,y),at);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  expect(await page.evaluate(()=>(window as unknown as {changes:number}).changes)).toBe(0);
  await page.locator('#window-map').click();
  const scroll=await viewport.evaluate(v=>[v.scrollLeft,v.scrollTop]);
  await expect.poll(()=>outline.evaluate(el=>[parseFloat((el as HTMLElement).style.marginLeft),parseFloat((el as HTMLElement).style.marginTop)])).toEqual([scroll[0]/8,scroll[1]/8]);
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

test('an arrow key moves one tile from the current Edit view even before its scroll event arrives',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');await page.locator('#window-map').click();
  const canvas=page.getByRole('region',{name:'Farm overview'}).locator('.overview-viewport canvas'),viewport=page.locator('#viewport');
  const centre=()=>viewport.evaluate(el=>[(el.scrollLeft+el.clientWidth/2)/16,(el.scrollTop+el.clientHeight/2)/16]);
  await canvas.click({position:{x:180,y:180}});await expect.poll(async()=>(await centre())[0]).toBeGreaterThan(50); // the tracked view is bottom-right
  // Scroll the terrain and press ArrowRight in one task, so the scroll event (delivered with the next frame) has not run.
  const moved=await page.evaluate(()=>{
    const viewport=document.getElementById('viewport')!,map=document.querySelector('.overview-viewport canvas')!;
    viewport.scrollTo(160,160); // well inside the farm, so one more tile is not clamped
    const from=[(viewport.scrollLeft+viewport.clientWidth/2)/16,(viewport.scrollTop+viewport.clientHeight/2)/16];
    map.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));return from;
  });
  await expect.poll(centre).toEqual([moved[0]+1,moved[1]]);
});
