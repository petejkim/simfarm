import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {aircraftFixture} from '../support/aircraft';
import {browserCrops} from '../support/crop-catalog';
import {purchaseAircraft} from '../../src/simulation/aircraft';
import {readArchive} from '../../src/formats/archive';
import {decodePlanar,readPalette} from '../../src/formats/graphics';
import {readNativeSave,writeNativeSave} from '../../src/formats/native-save';
import {openWindow,reveal} from '../support/workspace';
import {AIRCRAFT_CONTROLS} from '../../src/formats/aircraft-window';
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'aircraft.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const pending=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save',exact:true}).click();return JSON.parse(readFileSync((await (await pending).path())!,'utf8'));}
async function mapClick(page:Page,x:number,y:number,button:'left'|'right'='left'){
  const zoom=Number(await page.locator('#zoom').inputValue());
  await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-20)*16*p.zoom,Math.max(0,p.y-15)*16*p.zoom),{x,y,zoom});
  const r=(await page.locator('#world').boundingBox())!;
  await page.mouse.click(r.x+(x+.5)*16*zoom,r.y+(y+.5)*16*zoom,{button});
}
function fixture(){const f=aircraftFixture();f.state.disasters.enabled=false;expect(purchaseAircraft(f.state.scenario,f.state.finances).ok).toBe(true);return f;}

test('AIRPLANE source layout, gauges and real text stay1x, move independently and leave saves unchanged',async({page})=>{
  const f=fixture(),e=f.state.scenario.equipment[1],v=new DataView(e.bytes.buffer,e.bytes.byteOffset,e.bytes.byteLength);v.setUint16(20,255,true);v.setUint16(32,104,true);e.bytes[17]=52;
  const game=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,game.save(4));await mapClick(page,21,22);
  const win=page.getByRole('dialog',{name:'AIRPLANE',exact:true}),client=page.locator('.aircraft-window');await expect(win).toBeVisible();
  const b=(await client.boundingBox())!,desktop=(await page.locator('.game-desktop').boundingBox())!;
  expect(b).toMatchObject({x:desktop.x+192,y:desktop.y+176,width:256,height:176});
  expect(await win.locator('.game-window-title').textContent()).toBe('AIRPLANE');
  for(const label of ['Gas','Spray','Damage','FLY!','CLOSE'])await expect(client.getByText(label,{exact:true})).toBeVisible();
  const controls=client.locator('button');expect(await controls.count()).toBe(8);
  for(let i=0;i<8;i++){const c=AIRCRAFT_CONTROLS[i];expect(await controls.nth(i).boundingBox()).toMatchObject({x:b.x+c.x,y:b.y+c.y,width:c.width,height:c.height});}
  const source=(n:string)=>readFileSync(new URL('../../../simfarm-dos/'+n,import.meta.url)),entries=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA'));
  const asset=(n:string)=>entries.find(e=>e.name===n)!.bytes,palette=readPalette(asset('simfarm.pal'));
  for(const [i,frame] of [14,12,1].entries()){
    const actual=PNG.sync.read(await page.locator('.aircraft-gauge').nth(i).screenshot());
    const expected=decodePlanar(asset('fldgrph.til').subarray(frame*576,(frame+1)*576),48,24,palette);
    expect(Array.from(actual.data)).toEqual(Array.from(expected.rgba));
  }
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  const title=win.locator('.game-window-title');await title.focus();await page.keyboard.press('ArrowRight');expect((await client.boundingBox())!.x).toBe(b.x+10);
  await client.getByRole('button',{name:'CLOSE',exact:true}).click();await mapClick(page,22,23,'right');expect((await client.boundingBox())!.x).toBe(b.x+10);
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.screenshot({path:'artifacts/browser-aircraft-window.png'});
});

test('all four parked tiles select the right plane with primary and secondary input at both zooms; construction entry preserves the primary Bulldoze bypass',async({page})=>{
  const f=fixture(),w=f.state.scenario;w.regionalConditions[(2*12+2)*7]&=~0x20;expect(purchaseAircraft(w,f.state.finances).ok).toBe(true);
  const game=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,game.save(4));
  for(const zoom of ['1','2']){
    await reveal(page,'#zoom');await page.locator('#zoom').selectOption(zoom);await page.locator('#window-edit').click();
    for(const [slot,x,y] of [[1,21,22],[1,22,22],[2,19,23],[2,20,23]]){
      await mapClick(page,x,y,slot===1?'left':'right');await expect(page.locator('#aircraft-selection')).toHaveValue(String(slot));
      await page.locator('.aircraft-window').getByRole('button',{name:'CLOSE',exact:true}).click();
    }
  }
  await page.getByRole('button',{name:'Move object',exact:true}).click();await mapClick(page,21,23);await expect(page.getByRole('dialog',{name:'AIRPLANE',exact:true})).toBeVisible();await expect(page.locator('.map-panel')).toHaveAttribute('data-object-move','pick');
  await page.locator('.aircraft-window').getByRole('button',{name:'CLOSE',exact:true}).click();
  await page.getByRole('button',{name:'Paved road',exact:true}).click();await mapClick(page,22,22);await expect(page.getByRole('dialog',{name:'AIRPLANE',exact:true})).toBeVisible();
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));
  await page.locator('.aircraft-window').getByRole('button',{name:'CLOSE',exact:true}).click();
  await page.getByRole('button',{name:'Bulldoze',exact:true}).click();await mapClick(page,21,22);await expect(page.getByRole('dialog',{name:'AIRPLANE',exact:true})).toBeHidden();
  expect(await save(page)).toEqual(JSON.parse(game.save(4))); // machinery is not a bulldoze target
  const state=readNativeSave(game.save(4)).state;state.finances.defaultDecision={status:'pending',originalExitCode:0};const blocked=writeNativeSave(state,4);
  await load(page,blocked);await mapClick(page,21,22,'right');await expect(page.getByRole('dialog',{name:'AIRPLANE',exact:true})).toBeHidden();expect(await save(page)).toEqual(JSON.parse(blocked));
});

test('chemical icon order and full-width payload price match paid service across two aircraft and saved selection',async({page})=>{
  const f=fixture(),w=f.state.scenario;w.regionalConditions[(2*12+2)*7]&=~0x20;expect(purchaseAircraft(w,f.state.finances).ok).toBe(true);w.chemicalDefinitions[1].price=2580;
  const game=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,game.save(4));await openWindow(page,'aircraft');
  await page.locator('#aircraft-selection').selectOption('1'); // Map entry selects the clicked plane; this case services slot1 first.
  await expect(page.locator('#aircraft-load-price')).toHaveText('65790');await expect(page.locator('#aircraft-load')).toHaveAccessibleName('Load chemicals · $65,790');
  await page.locator('#aircraft-load').click();game.dispatch({type:'service-aircraft',slot:1,action:{kind:'load'}});await expect(page.locator('#aircraft-service-result')).toHaveText('Service completed for $65,790.');
  for(const type of [222,223,221]){
    await page.locator(`[data-aircraft-chemical="${type}"]`).click();game.dispatch({type:'service-aircraft',slot:1,action:{kind:'chemical',chemicalType:type}});
    await expect(page.locator(`[data-aircraft-chemical="${type}"]`)).toHaveAttribute('aria-pressed','true');
  }
  await page.locator('#aircraft-selection').selectOption('2');await page.locator('[data-aircraft-chemical="223"]').click();game.dispatch({type:'service-aircraft',slot:2,action:{kind:'chemical',chemicalType:223}});
  await page.locator('#aircraft-selection').selectOption('1');await expect(page.locator('[data-aircraft-chemical="223"]')).toHaveAttribute('aria-pressed','true');
  expect(await save(page)).toEqual(JSON.parse(game.save(4)));await page.reload();await load(page,game.save(4));await openWindow(page,'aircraft');await expect(page.locator('[data-aircraft-chemical="223"]')).toHaveAttribute('aria-pressed','true');expect(await save(page)).toEqual(JSON.parse(game.save(4)));
});
