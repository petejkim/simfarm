import { cropBadgeTile } from '../../src/formats/crop-slots';
import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../../src/formats/archive';
import {decodePlanar,readPalette} from '../../src/formats/graphics';
import {evaluationWindowView,EVALUATION_TOPICS,EVALUATION_PROBLEMS} from '../../src/simulation/evaluation-view';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {openWindow,reveal} from '../support/workspace';
const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
async function start(page:Page){await page.clock.install({time:new Date('1993-04-05T12:00:00Z')});await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'evaluation.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await pending).path())!));}
async function open(page:Page){const panel=page.getByRole('region',{name:'Farm evaluation'});if(await panel.isVisible())await panel.focus();else await page.locator('#window-evaluation').click();await expect(page.getByRole('region',{name:'Farm evaluation'})).toBeFocused();}
/** Atlas positions of the 16×16 tile sprites inside a badge (source tiles 539.. and crop badges). */
const tilePositions=(tiles:number[])=>tiles.map(t=>`${-(t%32*16)}px ${-Math.floor(t/32)*16}px`);
async function badgeTiles(item:import('@playwright/test').Locator){return item.locator('.sprite').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundPosition));}
function fixture(){const f=shopFixture();f.state.disasters.enabled=false;
  f.state.scenario.climate.precipitation.fill(7);f.state.scenario.climate.temperature=f.state.scenario.climate.temperature.map((_,i)=>i%2?60:40);
  for(let i=1;i<=8;i++){f.state.scenario.fields[i].bytes[7]|=1;f.state.scenario.fields[i].bytes[54]=1<<(i-1);}
  f.state.finances.statistics.words=[2,0,65535,0,3,0,0,0,0,0,0,4,0,2];return f;}

test('Evaluation restores source geometry, gauges, problems, all24 suggested crop pictures and actual text without changing saves',async({page})=>{
  const game=fixture().load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));const before=await save(page),edit=await page.locator('#viewport').boundingBox();await open(page);
  const win=page.getByRole('dialog',{name:'Evaluation',exact:true}),client=page.getByRole('region',{name:'Farm evaluation',exact:true});
  // Shared frame around a 336×184 client of components; no background bitmap or canvas.
  expect(await win.boundingBox()).toEqual({x:128,y:128,width:352,height:208});expect(await client.boundingBox()).toEqual({x:136,y:144,width:336,height:184});
  await expect(client.locator('img,canvas')).toHaveCount(0);
  expect(await client.locator('.evaluation-topic').allTextContents()).toEqual([...EVALUATION_TOPICS]);
  expect(await client.locator('.evaluation-label').allTextContents()).toEqual(['Low','High','Problems','Suggested Crops']);
  expect(await client.getByRole('button',{name:'CLOSE',exact:true}).boundingBox()).toEqual({x:416,y:296,width:48,height:24});
  for(const [i,width] of [40,80,36,10,10].entries()){
    const meter=client.getByRole('meter',{name:EVALUATION_TOPICS[i],exact:true});await expect(meter).toHaveAttribute('aria-valuenow',String(width));
    const color=palette[i<3?8:3];expect(await meter.locator('span').evaluate(el=>[el.getBoundingClientRect().width,getComputedStyle(el).backgroundColor])).toEqual([width,`rgb(${color.join(', ')})`]);
  }
  const problemList=client.getByRole('list',{name:'Field problems'});expect(await problemList.locator('li').allTextContents()).toEqual([...EVALUATION_PROBLEMS]);
  for(let i=0;i<8;i++)expect(await badgeTiles(problemList.locator('li').nth(i))).toEqual(tilePositions([0,1,2,3].map(p=>539+(16+i)*4+p)));
  await page.screenshot({path:'artifacts/browser-evaluation-window.png'});
  for(let batch=0;batch<3;batch++){
    const items=client.getByRole('list',{name:'Suggested crops'}).locator('li');await expect(items).toHaveCount(8);
    for(let i=0;i<8;i++){
      const slot=batch*8+i,crop=browserCrops.find(c=>`${c.id}.crp`===game.getSnapshot().scenario.cropFiles[slot])!,raw=source('CROPS/'+crop.id.toUpperCase()+'.CRP');
      await expect(items.nth(i)).toHaveText(crop.name);await expect(items.nth(i)).toHaveAttribute('data-evaluation-crop',String(slot));
      expect(await badgeTiles(items.nth(i))).toEqual(tilePositions([0,1,2,3].map(p=>cropBadgeTile(slot,p))));void raw;
    }
    if(batch<2)await client.getByRole('button',{name:'Next suggested crops'}).click();
  }
  await expect(client.getByRole('button',{name:'Next suggested crops'})).toBeDisabled();await client.getByRole('button',{name:'Previous suggested crops'}).click();
  await win.locator('.game-window-title').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+ArrowDown');expect(await win.boundingBox()).toMatchObject({x:138,y:129});
  await client.getByRole('button',{name:'CLOSE',exact:true}).click();await expect(win).toBeHidden();await open(page);expect(await win.boundingBox()).toMatchObject({x:138,y:129});
  await expect(client.locator('.evaluation-pages>span')).toHaveText('2/3');expect(await page.locator('#viewport').boundingBox()).toEqual(edit);expect(await save(page)).toEqual(before);
  await openWindow(page,'balance');await expect(page.getByRole('dialog',{name:'Balance Sheet',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'Farm balance sheet',exact:true})).toBeFocused();
});

test('Evaluation follows season/year rollover, clears resolved problems and suggestions, and preserves exact simulation continuation',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;Object.assign(f.state.scenario.farm.calendar,{month:11,week:3,day:6,season:3});f.state.weather.precipitationYear=4;
  f.state.scenario.climate.precipitation.fill(0);const game=f.load().withAllCrops(browserCrops);await start(page);await load(page,game.save(4));
  for(let day=0;day<9;day++){
    await open(page);const s=game.getSnapshot(),v=evaluationWindowView(s,browserCrops),client=page.getByRole('region',{name:'Farm evaluation'});
    await expect(client.getByRole('list',{name:'Suggested crops'}).locator('li')).toHaveCount(v.suggestions.length);await expect(client.locator('.evaluation-pages')).toHaveCount(0);
    await expect(client.getByRole('list',{name:'Field problems'}).locator('li')).toHaveCount(0);await expect(client.getByRole('meter',{name:'Soil Quality',exact:true})).toHaveAttribute('aria-valuenow','80');
    expect(await badgeTiles(client.locator('.evaluation-season-icon'))).toEqual(tilePositions([200+v.season]));
    expect(await save(page)).toEqual(JSON.parse(game.save(4)));if(day===4)await load(page,JSON.stringify(await save(page)));
    await reveal(page,'#next-day');await page.locator('#next-day').click();game.dispatch({type:'advance-day'});
    if(game.getSnapshot().pendingTown){await reveal(page,'#town-residential');await page.locator('#town-residential').click();game.dispatch({type:'choose-town',choice:'residential'});}
  }
  // Replacing a populated farm removes all old icons and uses live status, not cached annual counters.
  await load(page,fixture().load().withAllCrops(browserCrops).save(4));await open(page);await expect(page.locator('[data-evaluation-crop]')).toHaveCount(8);
  await load(page,game.save(4));await open(page);await expect(page.locator('.evaluation-panel .sprite')).toHaveCount(0);
  await page.getByRole('dialog',{name:'Evaluation',exact:true}).locator('.game-window-title').focus();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'Evaluation',exact:true})).toBeHidden();
});
