import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {readArchive} from '../../src/formats/archive';
import {readPalette} from '../../src/formats/graphics';
import {worldIndex,type Scenario} from '../../src/formats/scenario';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {readSaveText} from '../support/save-file';
const source=(name:string)=>readFileSync(new URL('../../../simfarm-dos/'+name,import.meta.url));
const archive=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
const asset=(name:string)=>archive.find(a=>a.name===name)!.bytes;
interface Rect{x:number;y:number;width:number;height:number}
// Independent source bitplane reads, including original transparent index7.
function indexAt(bytes:Uint8Array,tile:number,x:number,y:number){
  const offset=tile*128+y*2+(x>>3),bit=128>>(x&7);
  return [0,1,2,3].reduce((index,plane)=>index|((bytes[offset+plane*32]&bit)?1<<plane:0),0);
}
function expected(world:Scenario,region:Rect,paletteName:string,footprint?:Rect){
  const palette=readPalette(asset(paletteName)),normal=readPalette(asset('simfarm.pal')),pixels:number[]=[];
  for(let y=region.y;y<region.y+region.height;y++)for(let x=region.x;x<region.x+region.width;x++){
    const cell=world.cells[worldIndex(x>>4,y>>4)],tile=cell.terrain&2047;
    const event=tile>=483&&tile<518;
    let index=indexAt(asset(event?'twnevent.til':'ega16til.til'),event?tile-483:tile,x&15,y&15),colors=palette;
    if(cell.terrain&0x800){
      const overlay=indexAt(asset('mskdtile.til'),(cell.overlay&2047)-848,x&15,y&15);
      if(overlay!==7){index=overlay;colors=normal;}
    }
    if(footprint){
      const l=footprint.x*16,t=footprint.y*16,r=(footprint.x+footprint.width)*16-1,b=(footprint.y+footprint.height)*16-1;
      const horizontal=x>=l&&x<=r&&(y===t||y===t-1||y===b||y===b-1);
      const vertical=y>=t&&y<=b&&(x===l||x===l-1||x===r||x===r-1);
      if(horizontal!==vertical)index^=15;
    }
    pixels.push(...colors[index],255);
  }
  return pixels;
}
async function pixels(page:Page,r:Rect){return page.locator('#world').evaluate((c:HTMLCanvasElement,r)=>Array.from(c.getContext('2d')!.getImageData(r.x,r.y,r.width,r.height).data),r);}
async function hover(page:Page,x:number,y:number){
  await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-10)*16,Math.max(0,p.y-10)*16),{x,y});
  const r=(await page.locator('#world').boundingBox())!;await page.mouse.move(r.x+x*16+8,r.y+y*16+8);
}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readSaveText((await(await pending).path())!));}
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'outline.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}

test('Plant outline matches source XOR pixels across weather, masked objects, recreation tiles, movement and clipping',async({page})=>{
  await page.clock.install({time:new Date('1993-01-01')});await page.clock.pauseAt(new Date('1993-01-01'));
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const f=shopFixture();f.state.paused=true;f.state.scenario.farm.autoScroll=false;
  for(let x=8;x<23;x++)for(let y=18;y<33;y++){
    const cell=f.state.scenario.cells[worldIndex(x,y)];
    cell.terrain=[15,170,483,484][(x+y)%4];
    if((x+y)%3===0){cell.terrain|=0x800;cell.overlay=848+(x+y)%200;}
  }
  const region={x:9*16,y:19*16,width:192,height:176};
  for(const [current,temperature,palette] of [[0,70,'simfarm.pal'],[3,70,'rainpal.pal'],[3,20,'frostpal.pal']] as const){
    Object.assign(f.state.weather,{current,temperature});const game=f.load().withAllCrops(browserCrops),text=game.save(4),world=game.getSnapshot().scenario;
    await load(page,text);
    await page.getByRole('button',{name:'Plant',exact:true}).click();await page.locator('[data-field-tool="0"]').click();
    for(const [x,y] of [[10,20],[12,21]]){
      await hover(page,x,y);
      expect(await pixels(page,region),`${palette} at ${x},${y}`).toEqual(expected(world,region,palette,{x,y,width:8,height:8}));
    }
    await page.keyboard.press('Escape');expect(await pixels(page,region)).toEqual(expected(world,region,palette));
    // The footprint extends beyond the map; only the surviving source edges draw.
    await page.getByRole('button',{name:'Plant',exact:true}).click();await page.locator('[data-field-tool="0"]').click();
    await hover(page,95,95);const edge={x:94*16,y:94*16,width:32,height:32};
    expect(await pixels(page,edge)).toEqual(expected(world,edge,palette,{x:95,y:95,width:8,height:8}));
    await hover(page,0,0);const origin={x:0,y:0,width:144,height:144};
    expect(await pixels(page,origin)).toEqual(expected(world,origin,palette,{x:0,y:0,width:8,height:8}));
    await page.keyboard.press('Escape');expect(await save(page)).toEqual(JSON.parse(text));
  }
});

test('Buy uses the definition footprint, retains an unfilled border after rejection, and erases it on cancellation',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const f=shopFixture();f.state.paused=true;f.state.scenario.farm.autoScroll=false;
  Object.assign(f.state.weather,{current:0,temperature:70});
  // A visible masked obstruction ensures the click rejects without changing the farm.
  Object.assign(f.state.scenario.cells[worldIndex(10,20)],{terrain:15|0x800,overlay:848|0x800});
  const game=f.load().withAllCrops(browserCrops),text=game.save(4),world=game.getSnapshot().scenario;
  await load(page,text);await page.locator('#window-buy').click();await page.getByRole('button',{name:'Machinery',exact:true}).click();await page.locator('#catalog-buy').click();await page.getByRole('button',{name:'Close Buy',exact:true}).click();
  const d=world.equipmentDefinitions[0],footprint={x:10,y:20,width:d.width,height:d.height};
  const region={x:9*16,y:19*16,width:(d.width+2)*16,height:(d.height+2)*16};
  await hover(page,10,20);expect(await pixels(page,region)).toEqual(expected(world,region,'simfarm.pal',footprint));
  await page.mouse.down();await page.mouse.up();await expect(page.locator('#buy-result')).not.toHaveText('Tractor purchased.');
  expect(await pixels(page,region)).toEqual(expected(world,region,'simfarm.pal',footprint));
  await page.screenshot({path:'artifacts/browser-placement-outline.png'});
  // Cancel restores the native selected-tile highlight, so leaving the tool is
  // checked against a reload of the unchanged checkpoint instead of ignoring it.
  await page.keyboard.press('Escape');expect(await save(page)).toEqual(JSON.parse(text));
  await load(page,text);expect(await pixels(page,region)).toEqual(expected(world,region,'simfarm.pal'));
});
