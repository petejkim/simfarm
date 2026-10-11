import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {readArchive} from '../../src/formats/archive';
import {readPalette,decodePlanar} from '../../src/formats/graphics';
import {worldIndex} from '../../src/formats/scenario';
import {readNativeSave,writeNativeSave} from '../../src/formats/native-save';
import {reveal} from '../support/workspace';
const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url));
const entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')),palette=readPalette(entries.find(e=>e.name==='simfarm.pal')!.bytes);
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'market.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await p).path())!,'utf8'));}
async function pixelRegion(page:Page,x:number,y:number,width:number,height:number){return page.locator('.market-preview').evaluate((canvas:HTMLCanvasElement,p)=>Array.from(canvas.getContext('2d')!.getImageData(p.x,p.y,p.width,p.height).data),{x,y,width,height});}
async function mapClick(page:Page,x:number,y:number,button:'left'|'right'='left'){
  const zoom=Number(await page.locator('#zoom').inputValue());await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-20)*16*p.zoom,Math.max(0,p.y-15)*16*p.zoom),{x,y,zoom});
  const box=(await page.locator('#world').boundingBox())!;await page.mouse.click(box.x+(x+.5)*16*zoom,box.y+(y+.5)*16*zoom,{button});
}

test('original Market geometry, all24 crop badges/text and source chart pixels render without changing the farm',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const game=f.load().withAllCrops(browserCrops);
  const state=readNativeSave(game.save(4)).state,crop=browserCrops.find(c=>`${c.id}.crp`===state.scenario.cropFiles[0])!,base=crop.rawDefinition[34]|crop.rawDefinition[35]<<8;
  state.market.history[0]=Array.from({length:30},(_,i)=>Math.floor(base*(.5+i/29)));
  const saved=writeNativeSave(state,4);await page.goto('/');await load(page,saved);await page.locator('#window-market').click();
  const win=page.getByRole('dialog',{name:'Market Value',exact:true}),client=page.locator('.market-window'),d=(await page.locator('.game-desktop').boundingBox())!;
  expect(await client.boundingBox()).toEqual({x:d.x+144,y:d.y+128,width:320,height:208});
  for(const label of ['30 Week History','Crop','Price','Futures Owned','CLOSE'])await expect(client.getByText(label,{exact:true})).toBeVisible();
  // Independent reconstruction of the source graph at ordinary supplied prices.
  const expected:number[]=[];
  for(let y=20;y<160;y++)for(let x=24;x<=144;x++){
    const sample=Math.min(29,Math.floor((x-25)/4)),price=state.market.history[0][Math.max(0,sample)]!;
    const steps=16+(price>base?Math.floor((price-base)/(base>>>3)):-Math.floor((base-price)/(base>>>3))),top=159-steps*4;
    const color=y===92||y===93?1:(x-24)%4===0||(y-20)%4===0?14:y>=top&&x>24?3:12;
    expected.push(...palette[color],255);
  }
  expect(await pixelRegion(page,24,20,121,140)).toEqual(expected);
  const names=new Set<string>();
  for(let slot=0;slot<24;slot++){
    if(slot===16)await page.getByRole('button',{name:'Next market crops'}).click();
    await page.locator(`[data-market-crop="${slot}"]`).click();const file=state.scenario.cropFiles[slot],crop=browserCrops.find(c=>`${c.id}.crp`===file)!;
    await expect(page.locator('#market-crop-name')).toHaveText(crop.name);names.add(crop.name);
    const raw=source('CROPS/'+file.toUpperCase()),badge=new Uint8Array(32*32*4);
    for(let part=0;part<4;part++){const pixels=decodePlanar(raw.subarray(0x1200+part*128,0x1280+part*128),16,16,palette).rgba;
      for(let y=0;y<16;y++)badge.set(pixels.subarray(y*64,(y+1)*64),((Math.floor(part/2)*16+y)*32+(part%2)*16)*4);
    }
    for(let y=0;y<32;y++)for(let x=0;x<32;x++)if(x<2||y<2||x>=30||y>=30)badge.set([...palette[8],255],(y*32+x)*4);
    expect(await pixelRegion(page,176+slot%4*32,8+Math.floor(slot%16/4)*32,32,32)).toEqual(Array.from(badge));
  }
  expect(names.size).toBe(24);expect(await save(page)).toEqual(JSON.parse(saved));
  const title=win.locator('.game-window-title');await title.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');await page.locator('#window-market').click();
  expect((await client.boundingBox())!.x).toBe(d.x+154);await expect(page.locator('[data-market-crop="23"]')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:'artifacts/browser-market-window.png'});expect(await save(page)).toEqual(JSON.parse(saved));
});

test('Market retains unknown samples and separate trade/history prices, updates weekly and restores exact continuation',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;f.state.scenario.farm.calendar.day=6;
  const game=f.load().withAllCrops(browserCrops),state=readNativeSave(game.save(4)).state;
  state.market.history[0].fill(null,0,29);state.market.history[0][29]=1;
  const saved=writeNativeSave(state,4); // use the same canonical restore as the page
  const {GameSimulation}=await import('../support/game');const live=GameSimulation.load(saved,browserCrops).simulation;
  await page.goto('/');await load(page,saved);await page.locator('#windows-menu-button').click();await page.getByRole('menuitemcheckbox',{name:'Market Value',exact:true}).click();
  await expect(page.locator('#market-history td').first()).toHaveText('Not recorded');await expect(page.locator('#market-history td').last()).toHaveText('1');
  const def=state.scenario.cropDefinitions[0],crop=browserCrops.find(c=>`${c.id}.crp`===state.scenario.cropFiles[0])!,yieldWord=crop.rawDefinition[32]|crop.rawDefinition[33]<<8;
  await expect(page.locator('#market-price')).toHaveText(String((Math.floor(def.price/10)*yieldWord)&65535));
  const unknown=await pixelRegion(page,25,150,1,1);expect(unknown).toEqual([...palette[12],255]);
  expect(await save(page)).toEqual(JSON.parse(saved));
  await reveal(page,'#next-day');await page.locator('#next-day').click();live.dispatch({type:'advance-day'});await page.locator('#window-market').click();
  const next=live.getSnapshot();await expect(page.locator('#market-history td').last()).toHaveText(String(next.market.history[0][29]));
  await expect(page.locator('#market-price')).toHaveText(String((Math.floor(next.scenario.cropDefinitions[0].price/10)*yieldWord)&65535));
  expect(await save(page)).toEqual(JSON.parse(live.save(4)));await page.reload();await load(page,live.save(4));await page.locator('#window-market').click();
  await expect(page.locator('#market-history td').nth(28)).toHaveText('1');expect(await save(page)).toEqual(JSON.parse(live.save(4)));
});

test('town shop footprints open original routes by both buttons and zooms while preserving tools and Bulldoze bypass',async({page})=>{
  const f=shopFixture(),w=f.state.scenario;f.state.disasters.enabled=false;
  const routes=['market','sell','bank','buy','expert'];
  routes.forEach((_,i)=>{for(let x=0;x<3;x++)for(let y=0;y<3;y++){const c=w.cells[worldIndex(10+i*8+x,30+y)];c.terrain=320+i*3+x+y*40;c.overlay=0x4000;}});
  const game=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,game.save(4));
  for(const zoom of ['1','2']){
    await reveal(page,'#zoom');await page.locator('#zoom').selectOption(zoom);await page.locator('#window-edit').click();
    for(let i=0;i<routes.length;i++)for(let part=0;part<3;part++){
      await mapClick(page,10+i*8+part,30+part,part%2?'right':'left');await expect(page.locator(`[data-window="${routes[i]}"]`)).toBeVisible();await page.locator('#window-edit').click();
    }
  }
  await page.getByRole('button',{name:'Move object',exact:true}).click();await mapClick(page,10,30);await expect(page.locator('[data-window=market]')).toBeVisible();await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');
  await page.locator('#window-edit').click();await page.getByRole('button',{name:'Paved road',exact:true}).click();await mapClick(page,27,31);await expect(page.locator('[data-window=bank]')).toBeVisible();
  await page.locator('#window-edit').click();await page.getByRole('button',{name:'Bulldoze',exact:true}).click();await mapClick(page,10,30);await expect(page.locator('[data-window=market]')).toBeHidden();
  await mapClick(page,10,30,'right');await expect(page.locator('[data-window=market]')).toBeVisible();expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  const state=readNativeSave(game.save(4)).state;state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=writeNativeSave(state,4);await load(page,blocked);await mapClick(page,10,30,'right');await expect(page.locator('[data-window=market]')).toBeHidden();expect(await save(page)).toEqual(JSON.parse(blocked));
});

test('missing Market artwork reports an asset error before creating a farm',async({page})=>{
  await page.route('**/assets/market-window.png',route=>route.abort());await page.goto('/');await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('.loading')).toContainText('market-window.png');await expect(page.locator('#world')).toHaveCount(0);
});
