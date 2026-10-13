import {readSaveText} from '../support/save-file';
import {test,expect,type Page,type CDPSession} from '@playwright/test';
import {PNG} from 'pngjs';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {worldIndex} from '../../src/formats/scenario';
import {reveal,expectPaletteAction} from '../support/workspace';

async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'touch.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await p).path())!));}
async function coords(page:Page,x:number,y:number){const r=(await page.locator('#world').boundingBox())!;return {x:r.x+(x+.5)*16,y:r.y+(y+.5)*16};}
async function touch(session:CDPSession,points:{x:number;y:number}[],holdMs=0){
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
  for(const point of points.slice(1))await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
  if(holdMs)await new Promise(resolve=>setTimeout(resolve,holdMs));
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
const tap=async(page:Page,session:CDPSession,x:number,y:number)=>touch(session,[await coords(page,x,y)]);
const tilePixels=(page:Page,x:number,y:number)=>page.locator('#world').evaluate((c:HTMLCanvasElement,p)=>Array.from(c.getContext('2d')!.getImageData(p.x*16,p.y*16,16,16).data),{x,y});

test.describe('phone screen',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
  test('oversized windows scale to fit the screen and return to 1x when there is room',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    // Resizes refit through a ResizeObserver, so the bounds are polled.
    const inside=(key:string,width:number,height:number)=>expect(async()=>{
      const box=(await page.locator(`[data-window="${key}"]`).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width+0.5);expect(box.y+box.height).toBeLessThanOrEqual(height+0.5);
    }).toPass();
    await page.locator('#window-balance').tap();
    await expect(page.locator('[data-window=balance]')).toHaveAttribute('data-scale',/^0\.9/);await inside('balance',390,844);
    await page.locator('#window-bank').tap();await expect(page.locator('[data-window=bank]')).not.toHaveAttribute('data-scale');await inside('bank',390,844);
    await page.locator('#file-menu-button').tap();await page.getByRole('menuitem',{name:/New Game/}).tap();await page.getByRole('button',{name:'YES'}).tap();
    await expect(page.locator('[data-window=newgame]')).toHaveAttribute('data-scale',/^0\.8/);await inside('newgame',390,844);
    await page.screenshot({path:'artifacts/browser-mobile-newgame.png'});
    // Landscape: New Game is scaled by height instead and stays below the bars.
    await page.setViewportSize({width:844,height:390});
    await expect(page.locator('[data-window=newgame]')).toHaveAttribute('data-scale',/^0\.[6-8]/);await inside('newgame',844,390);
    await page.setViewportSize({width:1280,height:900});
    await expect(page.locator('[data-window=newgame]')).not.toHaveAttribute('data-scale');
    expect(await page.locator('[data-window=newgame]').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(1280);
  });
  test('a scaled Map window still locates the tapped overview tile',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    await page.setViewportSize({width:390,height:260});
    await page.locator('#window-map').tap();const map=page.locator('[data-window=map]');
    await expect(map).toHaveAttribute('data-scale',/^0\./);
    const scale=Number(await map.getAttribute('data-scale')),canvas=(await map.locator('canvas').first().boundingBox())!;
    await page.mouse.click(canvas.x+40.5*2*scale,canvas.y+20.5*2*scale);
    const viewport=page.locator('#viewport');
    // Locate centres the Edit view on the tile one view right of and below it: the scroll origin is that tile.
    await expect.poll(()=>viewport.evaluate(v=>[v.scrollLeft,v.scrollTop])).toEqual([40*16,20*16]);
  });
});

test('touch Buy placement highlights on the first tap and buys on a second tap of the same tile',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
  await reveal(page,'#viewport');await page.locator('#window-buy').click();
  const catalog=page.getByRole('region',{name:'Buy catalog'});await catalog.getByRole('button',{name:'Machinery',exact:true}).click();
  await page.locator('#catalog-buy').click();await catalog.getByRole('button',{name:'CLOSE',exact:true}).click();
  await page.locator('#viewport').evaluate(v=>v.scrollTo(0,0));
  const session=await page.context().newCDPSession(page),plain=await tilePixels(page,12,12);
  await tap(page,session,10,10);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tap(page,session,12,12);await expect.poll(()=>tilePixels(page,12,12)).not.toEqual(plain);
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await tap(page,session,12,12);g.dispatch({type:'buy-equipment',equipmentType:0,x:12,y:12});
  await expect.poll(()=>save(page)).toEqual(JSON.parse(g.save(4)));
  await session.detach();
});

test('touch paint tools pan the map from unhighlighted tiles and paint after a confirming tap; a long press toggles a gate',async({page})=>{
  const f=shopFixture();f.state.disasters.enabled=false;f.state.scenario.cells[worldIndex(14,24)].terrain=0x8000|188;
  const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
  const session=await page.context().newCDPSession(page),viewport=page.locator('#viewport');
  await viewport.evaluate(v=>v.scrollTo(0,0));
  // View object: a long press is the right button.
  await touch(session,[await coords(page,14,24)],700);g.dispatch({type:'network',tool:'open-gate',x:14,y:24});
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await page.getByRole('button',{name:'Dirt road',exact:true}).click();await expectPaletteAction(page,'Dirt road');
  await tap(page,session,25,25);expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  // Dragging from any other tile pans instead of painting.
  const from=await coords(page,30,30);
  await touch(session,[from,{x:from.x-40,y:from.y-30},{x:from.x-80,y:from.y-60}]);
  await expect.poll(()=>viewport.evaluate(v=>[v.scrollLeft,v.scrollTop])).toEqual([80,60]);
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  // The highlight stayed on tile 25,25 while the map moved; pressing it paints and dragging continues the road.
  const a=await coords(page,25,25),b=await coords(page,27,25);
  await touch(session,[a,{x:(a.x+b.x)/2,y:a.y},b]);
  for(const x of [25,26,27])g.dispatch({type:'network',tool:'road-161',x,y:25});
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await session.detach();
});

test('the installable web app manifest and home-screen icons are served',async({page,request})=>{
  await page.goto('/');
  expect(await page.locator('link[rel=manifest]').getAttribute('href')).toBe('/manifest.webmanifest');
  const manifest=await (await request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({name:'SimFarm',short_name:'SimFarm',display:'fullscreen',start_url:'./'});
  for(const icon of [...manifest.icons.map((i:{src:string;sizes:string})=>({src:'/'+i.src,size:Number(i.sizes.split('x')[0])})),{src:'/assets/apple-touch-icon.png',size:180}]){
    const response=await request.get(icon.src);expect(response.ok()).toBe(true);
    const png=PNG.sync.read(await response.body());expect([png.width,png.height]).toEqual([icon.size,icon.size]);
    // Opaque: launchers render transparency as black.
    for(let i=3;i<png.data.length;i+=4)if(png.data[i]!==255)throw new Error(`${icon.src} has transparent pixels`);
  }
  expect(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content')).toBe('yes');
});
