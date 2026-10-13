import {readSaveText} from '../support/save-file';
import { declineTownEventDialogs } from '../support/town-event-dialogs';
import { declineTownEvents } from '../support/town-events';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../../src/formats/archive';
import {decodePlanar,readPalette} from '../../src/formats/graphics';

import {weatherWindowView,WEATHER_SKIES} from '../../src/simulation/weather-view';
import {WEATHER_LABELS} from '../../src/formats/weather-window';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {openWindow,reveal, focusEdit , speedItem } from '../support/workspace';
const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'weather.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}
async function open(page:Page){const panel=page.getByRole('region',{name:'Weather conditions'});if(await panel.isVisible())await panel.focus();else await page.locator('#window-weather').click();await expect(page.getByRole('region',{name:'Weather conditions'})).toBeFocused();}
/** A sprite's image file name (or data URL) and atlas offset from its inline style. */
function sprite(l:Locator){return l.evaluate((e:HTMLElement)=>({image:e.style.backgroundImage.replace(/^url\("?(?:.*\/)?([^/"]+)"?\)$/,'$1'),position:e.style.backgroundPosition}));}
const at=(x:number,y:number)=>`${-x}px ${-y}px`,tileAt=(t:number)=>at(t%32*16,Math.floor(t/32)*16);
async function tiles(l:Locator){return l.locator('.sprite').evaluateAll(es=>es.map(e=>(e as HTMLElement).style.backgroundPosition));}
function fixture(){const f=shopFixture();f.state.disasters.enabled=false;Object.assign(f.state.scenario.farm.calendar,{month:8,week:3,day:5,season:2});
  Object.assign(f.state.weather,{current:4,displayTemperature:81,precipitationDays:100,wind:18,precipitationYear:2,forecast:[0,1,2,3,4,0,1],nextForecast:[4,3,2,1,0,4,3]});
  f.state.scenario.farm.precipitationDays=100;f.state.scenario.climate.precipitation.fill(3);return f;}

test('Weather restores source geometry, full actual-text values, scenes, gauges and forecasts; title movement and browsing preserve saves',async({page})=>{
  const game=fixture().load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));const before=await save(page),edit=await page.locator('#viewport').boundingBox();await open(page);
  const win=page.getByRole('dialog',{name:'Weather',exact:true}),client=page.getByRole('region',{name:'Weather conditions',exact:true});
  await expect(client.locator('img,canvas')).toHaveCount(0);
  // Every lettering rectangle erased from the bitmap is real text.
  expect((await client.locator('.weather-label').allTextContents()).sort()).toEqual(WEATHER_LABELS.map(l=>l.text).sort());
  for(const [id,text] of [['weather-calendar','Week 4 of Sep'],['weather-season-countdown','10 Weeks Till'],['weather-fahrenheit','81'],['weather-celsius','24'],['weather-average-rain','36'],['weather-rain','25'],['weather-wind','18 Mph'],['weather-evaporation','Average']])await expect(page.locator('#'+id)).toHaveText(text);
  // Scenes stay at their source client positions (source 112,48 and 112,80 less the 8px frame).
  expect(await sprite(client.locator('.weather-sky'))).toEqual({image:'weather-sky.png',position:at(3*112,0)});
  expect(await sprite(client.locator('.weather-ground'))).toEqual({image:'weather-ground.png',position:at(2*112,0)});
  expect(await sprite(client.locator('.weather-needle'))).toEqual({image:'field-gauges.png',position:at(17*48,0)});
  expect(await sprite(client.locator('.weather-vane'))).toEqual({image:'weather-vane.png',position:at(0,0)});
  expect(await tiles(client.locator('.weather-forecast'))).toEqual([0,1,4,3,2].map(code=>tileAt(204+code)));
  // Column fills: white tracks of source height with palette 3/6 levels; the two tubes sit 8px nearer the centre.
  for(const [name,x,height,level,color] of [['temperature',56,44,27,3],['rain',248,55,25,6]] as const){
    const track=client.locator(`.weather-${name}-column`),fill=track.locator('span');
    expect(await track.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(`rgb(${palette[15].join(', ')})`);
    expect(await fill.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(`rgb(${palette[color].join(', ')})`);
  }
  await page.screenshot({path:'artifacts/browser-weather-window.png'});
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Escape');await expect(win).toBeHidden();await open(page);
  expect(await page.locator('#viewport').boundingBox()).toEqual(edit);expect(await save(page)).toEqual(before);
});

test('Weather follows all seasons and sky types, cross-week forecasts, signed extremes and exact daily/save continuation',async({page})=>{
  await start(page);
  for(let season=0;season<4;season++)for(let sky=0;sky<5;sky++){
    const f=fixture();f.state.scenario.farm.calendar.season=season;f.state.weather.current=sky;
    f.state.weather.displayTemperature=[-128,32,100,127][season];f.state.weather.precipitationDays=f.state.scenario.farm.precipitationDays=[0,220,32767,32768][season];
    const game=f.load().withAllCrops(browserCrops),s=game.getSnapshot(),view=weatherWindowView(s.scenario.farm.calendar,s.weather,s.scenario.climate);await load(page,game.save(4));await open(page);
    await expect(page.locator('#weather-fahrenheit')).toHaveText(String(view.fahrenheit));await expect(page.locator('#weather-rain')).toHaveText(String(view.rain));await expect(page.locator('#weather-summary')).toContainText(WEATHER_SKIES[sky]);
    const sourceSky=sky===4?3:sky;
    expect((await sprite(page.locator('.weather-sky'))).position).toBe(at(sourceSky*112,0));
    expect((await sprite(page.locator('.weather-ground'))).position).toBe(at(season*112,0));
    expect(await tiles(page.locator('.weather-header'))).toEqual([tileAt(200+season),tileAt(200+((season+1)&3))]);
    if(sky===4)expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  const f=fixture(),game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));
  for(let day=0;day<9;day++){
    await (await speedItem(page,'#next-day')).click();game.dispatch({type:'advance-day'});await declineTownEventDialogs(page);declineTownEvents(game);await open(page);
    const s=game.getSnapshot(),v=weatherWindowView(s.scenario.farm.calendar,s.weather,s.scenario.climate);
    await expect(page.locator('#weather-fahrenheit')).toHaveText(String(v.fahrenheit));await expect(page.locator('#weather-calendar')).toHaveText(v.calendar);
    await expect(page.getByRole('list',{name:'Five day forecast'})).toContainText(v.forecast.map((code,i)=>`${i===0?'Today':`Day ${i+1}`}: ${WEATHER_SKIES[code]}`).join(''));
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    if(day===4)await load(page,JSON.stringify(await save(page)));
  }
});

test('Weather animation stays presentation-only, pauses and closes cleanly while Speed keeps native pacing',async({page})=>{
  await start(page);const game=fixture().load().withAllCrops(browserCrops);await load(page,game.save(4));await open(page);
  const initial=(await sprite(page.locator('.weather-vane'))).position;await page.clock.runFor(1200);expect((await sprite(page.locator('.weather-vane'))).position).toEqual(initial);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await (await speedItem(page,'#play-pause')).click();await open(page);await page.clock.runFor(300);
  expect((await sprite(page.locator('.weather-vane'))).position).not.toEqual(initial);
  await (await speedItem(page,'#play-pause')).click();await open(page);
  const stopped=(await sprite(page.locator('.weather-vane'))).position,before=await save(page);await page.clock.runFor(2000);expect((await sprite(page.locator('.weather-vane'))).position).toEqual(stopped);expect(await save(page)).toEqual(before);
  await page.getByRole('button',{name:'Close Weather',exact:true}).click();await expect(page.getByRole('dialog',{name:'Weather',exact:true})).toBeHidden();
  await openWindow(page,'speed');await expect(page.getByRole('menuitemcheckbox',{name:'Normal (1x)',exact:true})).toHaveAttribute('aria-checked','true');
  await expect((await speedItem(page,'#next-day'))).toBeEnabled();await expect((await speedItem(page,'#play-pause'))).toHaveText('Resume');
});

test('missing Weather assets fail before creating a farm',async({page})=>{
  for(const name of ['weather-window.png','weather-sky.png','weather-ground.png','weather-vane.png']){
    await page.route('**/assets/'+name,r=>r.abort());await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('.loading')).toContainText(name);await expect(page.locator('#world')).toHaveCount(0);await page.unroute('**/assets/'+name);
  }
});


test('toolbar shows three original weather icons across week boundaries and updates after advancing a day',async({page})=>{
  const f=fixture();f.state.scenario.farm.calendar.day=6;
  const game=f.load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));const before=await save(page);
  const icons=page.locator('.toolbar-weather');
  async function check(codes:number[]){
    expect(await icons.locator('.sprite').evaluateAll(es=>es.map(e=>(e as HTMLElement).style.backgroundPosition))).toEqual(codes.map(code=>tileAt(204+code)));
  }
  await expect(icons).toHaveAttribute('aria-label','Today: Partly cloudy; Tomorrow: Snow; Day 3: Rain');await check([1,4,3]);
  expect(await save(page)).toEqual(before);
  await (await speedItem(page,'#next-day')).click();await declineTownEventDialogs(page);await check([4,3,2]);
  await expect(icons).toHaveAttribute('aria-label','Today: Snow; Tomorrow: Rain; Day 3: Cloudy');
  await focusEdit(page);await page.screenshot({path:'artifacts/browser-toolbar-weather.png'});
});


test('terrain uses original rain/frost colors and restores dry artwork without modifying the farm',async({page})=>{
  await start(page);
  for(const [current,temperature,name] of [[3,40,'rainpal.pal'],[4,31,'frostpal.pal'],[4,32,'rainpal.pal'],[0,20,'simfarm.pal']] as const){
    const f=fixture();Object.assign(f.state.weather,{current,temperature});
    const game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));
    const before=await save(page);
    const pixels=await page.locator('#world').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(0,0,16,16).data));
    expect(pixels).toEqual(Array.from(decodePlanar(asset('ega16til.til').subarray(15*128,16*128),16,16,readPalette(asset(name))).rgba));
    expect(await save(page)).toEqual(before);
    if(name==='frostpal.pal')await page.screenshot({path:'artifacts/browser-terrain-frost.png'});
  }
  const f=fixture();Object.assign(f.state.weather,{current:3,temperature:40,forecast:[3,0,0,0,0,0,0]});f.state.scenario.farm.calendar.day=0;
  await load(page,f.load().withAllCrops(browserCrops).save(4));
  await (await speedItem(page,'#next-day')).click();
  const pixels=await page.locator('#world').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(0,0,16,16).data));
  expect(pixels).toEqual(Array.from(decodePlanar(asset('ega16til.til').subarray(15*128,16*128),16,16,palette).rgba));
});


test('prolonged dry climate reaches the original cracked-soil artwork in the live terrain',async({page})=>{
  const f=fixture();Object.assign(f.state.weather,{current:0,soilMoisture:12,moistureBalance:0,wind:15,temperature:100,windAnomaly:0,temperatureAnomaly:0,forecast:Array(7).fill(0),nextForecast:Array(7).fill(0)});
  f.state.scenario.farm.messages=false;
  Object.assign(f.state.scenario.farm.calendar,{day:0,week:0,month:5});
  f.state.scenario.climate.precipitation.fill(0);f.state.scenario.climate.temperature.fill(100);f.state.scenario.climate.wind.fill(15);
  for(const cell of f.state.scenario.cells){cell.terrain=27;cell.attribute=0;}
  const game=f.load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));
  const pixels=()=>page.locator('#world').evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext('2d')!.getImageData(0,0,16,16).data));
  const original=(tile:number)=>Array.from(decodePlanar(asset('ega16til.til').subarray(tile*128,(tile+1)*128),16,16,palette).rgba);
  expect(await pixels()).toEqual(original(27));
  for(let day=0;day<28;day++){await (await speedItem(page,'#next-day')).click();game.dispatch({type:'advance-day'});}
  expect(game.getSnapshot().weather.soilMoisture).toBe(0);expect(game.getSnapshot().scenario.cells[0].terrain&2047).toBe(15);
  expect(await pixels()).toEqual(original(15));expect(await pixels()).not.toEqual(original(27));
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await focusEdit(page);await page.screenshot({path:'artifacts/browser-drought-cracked-soil.png'});
});
