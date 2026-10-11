import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../../src/formats/archive';
import {decodePlanar,readPalette} from '../../src/formats/graphics';
import {weatherWindowView,WEATHER_SKIES} from '../../src/simulation/weather-view';
import {WEATHER_LABELS} from '../../src/formats/weather-window';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {openWindow,reveal} from '../support/workspace';
const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'weather.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await pending).path())!,'utf8'));}
async function open(page:Page){const panel=page.getByRole('region',{name:'Weather conditions'});if(await panel.isVisible())await panel.focus();else await page.locator('#window-weather').click();await expect(page.getByRole('region',{name:'Weather conditions'})).toBeFocused();}
async function pixels(page:Page,x:number,y:number,w:number,h:number){return page.locator('.weather-preview').evaluate((c:HTMLCanvasElement,r)=>Array.from(c.getContext('2d')!.getImageData(...r).data),[x,y,w,h] as [number,number,number,number]);}
function fixture(){const f=shopFixture();f.state.disasters.enabled=false;Object.assign(f.state.scenario.farm.calendar,{month:8,week:3,day:5,season:2});
  Object.assign(f.state.weather,{current:4,displayTemperature:81,precipitationDays:100,wind:18,precipitationYear:2,forecast:[0,1,2,3,4,0,1],nextForecast:[4,3,2,1,0,4,3]});
  f.state.scenario.farm.precipitationDays=100;f.state.scenario.climate.precipitation.fill(3);return f;}

test('Weather restores source geometry, full actual-text values, scenes, gauges and forecasts; title movement and browsing preserve saves',async({page})=>{
  const game=fixture().load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));const before=await save(page),edit=await page.locator('#viewport').boundingBox();await open(page);
  const win=page.getByRole('dialog',{name:'Weather',exact:true}),client=page.getByRole('region',{name:'Weather conditions',exact:true});
  expect(await win.boundingBox()).toEqual({x:160,y:128,width:336,height:208});expect(await client.boundingBox()).toEqual({x:160,y:144,width:336,height:192});
  const labels=client.locator('.weather-label');expect(await labels.count()).toBe(WEATHER_LABELS.length);
  for(let i=0;i<WEATHER_LABELS.length;i++){const l=WEATHER_LABELS[i];await expect(labels.nth(i)).toHaveText(l.text);expect(await labels.nth(i).boundingBox()).toEqual({x:160+l.x,y:144+l.y,width:l.width,height:l.height});}
  for(const [id,text] of [['weather-calendar','Week 4 of Sep'],['weather-season-countdown','10 Weeks Till'],['weather-fahrenheit','81'],['weather-celsius','24'],['weather-average-rain','36'],['weather-rain','25'],['weather-wind','18 Mph'],['weather-evaporation','Average']])await expect(page.locator('#'+id)).toHaveText(text);
  expect(await pixels(page,112,48,112,32)).toEqual(Array.from(decodePlanar(asset('wethsky.btl').subarray(22+3*1794,22+3*1794+1792),112,32,palette).rgba));
  expect(await pixels(page,112,80,112,32)).toEqual(Array.from(decodePlanar(asset('wethgrnd.btl').subarray(22+2*1794,22+2*1794+1792),112,32,palette).rgba));
  expect(await pixels(page,24,104,48,24)).toEqual(Array.from(decodePlanar(asset('fldgrph.til').subarray(17*576,18*576),48,24,palette).rgba));
  expect(await pixels(page,272,104,32,32)).toEqual(Array.from(decodePlanar(asset('wethvane.til').subarray(0,512),32,32,palette).rgba));
  for(const [i,code] of [0,1,4,3,2].entries())expect(await pixels(page,112+i*24,136,16,16)).toEqual(Array.from(decodePlanar(asset('ega16til.til').subarray((204+code)*128,(205+code)*128),16,16,palette).rgba));
  for(const [x,bottom,height,color] of [[72,80,27,3],[248,91,25,6]]){
    const data=await pixels(page,x,36,8,bottom-36);for(let y=36;y<bottom;y++)for(let xx=0;xx<8;xx++)expect(data.slice(((y-36)*8+xx)*4,((y-36)*8+xx+1)*4)).toEqual([...palette[y>=bottom-height?color:15],255]);
  }
  await page.screenshot({path:'artifacts/browser-weather-window.png'});
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');
  expect(await win.boundingBox()).toMatchObject({x:170,y:129});await page.keyboard.press('Escape');await expect(win).toBeHidden();await open(page);expect(await win.boundingBox()).toMatchObject({x:170,y:129});
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
    expect(await pixels(page,112,48,112,32)).toEqual(Array.from(decodePlanar(asset('wethsky.btl').subarray(22+sourceSky*1794,22+sourceSky*1794+1792),112,32,palette).rgba));
    expect(await pixels(page,112,80,112,32)).toEqual(Array.from(decodePlanar(asset('wethgrnd.btl').subarray(22+season*1794,22+season*1794+1792),112,32,palette).rgba));
    for(const [x,tile] of [[16,200+season],[304,200+((season+1)&3)]])expect(await pixels(page,x,5,16,16)).toEqual(Array.from(decodePlanar(asset('ega16til.til').subarray(tile*128,(tile+1)*128),16,16,palette).rgba));
    if(sky===4)expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  }
  const f=fixture(),game=f.load().withAllCrops(browserCrops);await load(page,game.save(4));
  for(let day=0;day<9;day++){
    await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});await open(page);
    const s=game.getSnapshot(),v=weatherWindowView(s.scenario.farm.calendar,s.weather,s.scenario.climate);
    await expect(page.locator('#weather-fahrenheit')).toHaveText(String(v.fahrenheit));await expect(page.locator('#weather-calendar')).toHaveText(v.calendar);
    await expect(page.getByRole('list',{name:'Five day forecast'})).toContainText(v.forecast.map((code,i)=>`${i===0?'Today':`Day ${i+1}`}: ${WEATHER_SKIES[code]}`).join(''));
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));
    if(day===4)await load(page,JSON.stringify(await save(page)));
  }
});

test('Weather animation stays presentation-only, pauses and closes cleanly while Speed keeps native pacing',async({page})=>{
  await start(page);const game=fixture().load().withAllCrops(browserCrops);await load(page,game.save(4));await open(page);
  const initial=await pixels(page,272,104,32,32);await page.clock.runFor(1200);expect(await pixels(page,272,104,32,32)).toEqual(initial);expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await reveal(page,'#play-pause');await page.locator('#play-pause').click();await open(page);await page.clock.runFor(300);
  expect(await pixels(page,272,104,32,32)).not.toEqual(initial);
  await reveal(page,'#play-pause');await page.locator('#play-pause').click();await open(page);
  const stopped=await pixels(page,272,104,32,32),before=await save(page);await page.clock.runFor(2000);expect(await pixels(page,272,104,32,32)).toEqual(stopped);expect(await save(page)).toEqual(before);
  await page.getByRole('button',{name:'Close Weather',exact:true}).click();await expect(page.getByRole('dialog',{name:'Weather',exact:true})).toBeHidden();
  await openWindow(page,'speed');await expect(page.getByRole('dialog',{name:'Speed',exact:true})).toBeVisible();await expect(page.locator('#simulation-speed-value')).toHaveText('1×');await expect(page.locator('#simulation-speed-value')).toHaveAttribute('title','At 1×, one full game day takes four real seconds.');
  await expect(page.locator('#next-day')).toBeEnabled();await expect(page.locator('#play-pause')).toHaveText('Play');
});

test('missing Weather assets fail before creating a farm',async({page})=>{
  for(const name of ['weather-window.png','weather-sky.png','weather-ground.png','weather-vane.png']){
    await page.route('**/assets/'+name,r=>r.abort());await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('.loading')).toContainText(name);await expect(page.locator('#world')).toHaveCount(0);await page.unroute('**/assets/'+name);
  }
});
