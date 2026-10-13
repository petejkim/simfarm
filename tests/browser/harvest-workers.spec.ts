import {readSaveText} from '../support/save-file';
import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readNativeSave} from '../../src/formats/native-save';
import {readScenario,worldPosition} from '../../src/formats/scenario';
import {readArchive} from '../../src/formats/archive';
import {readPalette,decodePlanar} from '../../src/formats/graphics';
import {GameSimulation} from '../support/game';
import {browserCrops} from '../support/crop-catalog';
import {reveal, speedItem } from '../support/workspace';
const source=(name:string)=>readFileSync(new URL('../../../simfarm-dos/'+name,import.meta.url));
const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(name:string)=>archive.find(entry=>entry.name===name)!.bytes;
const palette=readPalette(asset('simfarm.pal'));
const frames=[188,189].map(tile=>decodePlanar(asset('mskdtile.til').subarray(tile*128,(tile+1)*128),16,16,palette,7).rgba);
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'workers.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
function fixture(){
  const world=readScenario(source('SCEN0.SSM')),game=new GameSimulation(world,browserCrops).withAllCrops(browserCrops);
  game.dispatch({type:'set-disasters-enabled',enabled:false});game.dispatch({type:'harvest-field',fieldSlot:1});
  expect(game.getSnapshot().lastHarvestResult?.ok).toBe(true);game.dispatch({type:'set-paused',paused:false});
  for(let tick=0;tick<4096&&game.getSnapshot().scenario.fields[1].step!==13;tick++)game.tick(4000/(world.farm.dayDelayTicks+1));
  expect(game.getSnapshot().scenario.fields[1].step).toBe(13);game.dispatch({type:'set-paused',paused:true});return game;
}
function matchesFrame(pixels:number[],frame:number){
  const rgba=frames[frame];for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]&&rgba.slice(i,i+4).some((v,k)=>v!==pixels[i+k]))return false;
  return true;
}

test('harvest workers alternate both original frames, freeze on pause, reload unchanged and disappear after harvest',async({page})=>{
  const game=fixture(),snapshot=game.getSnapshot(),text=game.save(0);
  const index=snapshot.scenario.cells.findIndex(c=>(c.terrain&0x800)!==0&&(c.overlay&2047)===1036),position=worldPosition(index);
  await page.clock.install({time:new Date('1993-08-12T12:00:00Z')});await page.clock.pauseAt(new Date('1993-08-12T12:00:00Z'));
  await page.goto('/');await load(page,text);
  const pixels=()=>page.locator('#world').evaluate((canvas:HTMLCanvasElement,p)=>[...canvas.getContext('2d')!.getImageData(p.x*16,p.y*16,16,16).data],position);
  const initial=await pixels();expect(matchesFrame(initial,0)).toBe(true);expect(matchesFrame(initial,1)).toBe(false);
  await page.clock.runFor(600);expect(await pixels()).toEqual(initial);expect(await save(page)).toEqual(JSON.parse(text));
  await (await speedItem(page,'#play-pause')).click();await page.clock.runFor(288);
  const alternate=await pixels();expect(matchesFrame(alternate,1)).toBe(true);expect(alternate).not.toEqual(initial);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.runFor(300);expect(await pixels()).toEqual(alternate);
  await page.evaluate(()=>{delete (document as unknown as {hidden?:boolean}).hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.clock.runFor(16);expect(await pixels()).toEqual(alternate);
  await (await speedItem(page,'#play-pause')).click();const paused=await save(page);
  expect(readNativeSave(JSON.stringify(paused)).state.scenario.cells[index]).toEqual(snapshot.scenario.cells[index]);
  await page.clock.runFor(800);expect(await pixels()).toEqual(alternate);expect(await save(page)).toEqual(paused);
  await (await speedItem(page,'#play-pause')).click();await page.clock.runFor(256);
  expect(matchesFrame(await pixels(),0)).toBe(true);await (await speedItem(page,'#play-pause')).click();
  await reveal(page,'#viewport');await page.locator('#viewport').evaluate((el,p)=>el.scrollTo((p.x-3)*16,(p.y-3)*16),position);
  await page.screenshot({path:'artifacts/browser-harvest-workers.png'});
  await page.reload();await load(page,JSON.stringify(paused));expect(matchesFrame(await pixels(),0)).toBe(true);
  expect(await save(page)).toEqual(paused);
  for(let day=0;day<3;day++){await (await speedItem(page,'#next-day')).click();}
  const after=await save(page);expect(readNativeSave(JSON.stringify(after)).state.scenario.cells[index].terrain&0x800).toBe(0);
  const finished=await pixels();expect(matchesFrame(finished,0)).toBe(false);expect(matchesFrame(finished,1)).toBe(false);
});
