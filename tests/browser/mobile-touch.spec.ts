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
    // The page is shown at 1.2× (index.html, user request), so bounds are the CSS viewport, not the device size.
    const inside=(key:string)=>expect(async()=>{
      const [width,height]=await page.evaluate(()=>[innerWidth,innerHeight]),box=(await page.locator(`[data-window="${key}"]`).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(width+0.5);expect(box.y+box.height).toBeLessThanOrEqual(height+0.5);
    }).toPass();
    await page.locator('#window-balance').tap();
    await expect(page.locator('[data-window=balance]')).toHaveAttribute('data-scale',/^0\.8/);await inside('balance');
    await page.locator('#window-bank').tap();await expect(page.locator('[data-window=bank]')).not.toHaveAttribute('data-scale');await inside('bank');
    await page.locator('#file-menu-button').tap();await page.getByRole('menuitem',{name:/New Game/}).tap();await page.getByRole('button',{name:'YES'}).tap();
    await expect(page.locator('[data-window=newgame]')).toHaveAttribute('data-scale',/^0\.6/);await inside('newgame');
    await page.screenshot({path:'artifacts/browser-mobile-newgame.png'});
    // Landscape: New Game is scaled by height instead and stays below the bars.
    await page.setViewportSize({width:844,height:390});
    await expect(page.locator('[data-window=newgame]')).toHaveAttribute('data-scale',/^0\.[4-8]/);await inside('newgame');
    await page.setViewportSize({width:1280,height:900});
    await expect(page.locator('[data-window=newgame]')).not.toHaveAttribute('data-scale');
    expect(await page.locator('[data-window=newgame]').evaluate(el=>getComputedStyle(el).transform)).toBe('none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
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
  test('portrait centres the palette below the terrain as two rows of launcher-sized tools with PLANT and SPRAY at the end',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const palette=page.getByRole('toolbar',{name:'Edit tools'}),box=async(name:string)=>(await palette.getByRole('button',{name,exact:true}).boundingBox())!;
    const near=(actual:number[],expected:number[])=>actual.forEach((value,i)=>expect(Math.abs(value-expected[i]),`[${i}] ${value} vs ${expected[i]}`).toBeLessThan(1));
    const strip=(await palette.boundingBox())!,terrain=(await page.locator('#viewport').boundingBox())!;
    expect(strip.y).toBeGreaterThanOrEqual(terrain.y+terrain.height);expect(Math.abs(strip.y+strip.height-(await page.locator('.game-desktop').boundingBox())!.height-(await page.locator('.game-desktop').boundingBox())!.y)).toBeLessThan(1.5);const desk=(await page.locator('.game-desktop').boundingBox())!;expect(Math.abs(strip.x+strip.width/2-(desk.x+desk.width/2))).toBeLessThan(1);
    // The strip is zoomed 4/3 so tool cells are as big as the 32px control-bar launchers.
    const launcher=(await page.locator('#window-buy').boundingBox())!;
    near([strip.width,strip.height],[193*4/3,49*4/3]);
    // Source pairs become columns: Move/View over each other, then Paved/Dirt … Trees/Bulldoze.
    const move=await box('Move object'),view=await box('View object'),paved=await box('Paved road'),bulldoze=await box('Bulldoze');
    near([move.width,move.height],[launcher.width,launcher.height]);
    near([view.x,view.y-move.y,paved.x-move.x,paved.y],[move.x,32,32,move.y]);near([bulldoze.x-move.x,bulldoze.y],[160,view.y]);
    const plant=await box('PLANT'),spray=await box('SPRAY');
    near([plant.x-move.x,plant.y,plant.width,plant.height,spray.x,spray.y],[192,move.y,64,32,plant.x,view.y]);
    // The strip is centred; the Plant menu opens centred just above it.
    await palette.getByRole('button',{name:'PLANT'}).tap();const menu=(await page.getByRole('menu',{name:'Plant Field'}).boundingBox())!;
    near([menu.y+menu.height],[strip.y]);expect(Math.abs(menu.x+menu.width/2-(strip.x+strip.width/2))).toBeLessThan(1);
    await page.screenshot({path:'artifacts/browser-mobile-portrait-palette.png'});
    // Landscape keeps the source vertical palette at the left.
    await page.keyboard.press('Escape');await page.setViewportSize({width:844,height:390});
    const side=(await palette.boundingBox())!;near([side.x,side.width],[0,49]);
    near([(await box('View object')).x-(await box('Move object')).x,(await box('Move object')).width],[24,24]);
  });
  test('portrait splits the control bar into centred rows of launchers, then forecast, readouts and pause',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const bar=(await page.getByRole('toolbar',{name:'Game toolbar'}).boundingBox())!,centre=bar.x+bar.width/2;
    const boxes=async(selector:string)=>Promise.all((await page.locator(selector).all()).map(async l=>(await l.boundingBox())!));
    const span=(list:{x:number;y:number;width:number;height:number}[])=>({left:Math.min(...list.map(b=>b.x)),right:Math.max(...list.map(b=>b.x+b.width)),
      top:Math.min(...list.map(b=>b.y)),bottom:Math.max(...list.map(b=>b.y+b.height))});
    const launchers=await boxes('.toolbar-launchers > button'),first=span(launchers);
    expect(launchers.length).toBe(9);expect(new Set(launchers.map(b=>Math.round(b.y))).size).toBe(1);
    expect(Math.abs((first.left+first.right)/2-centre)).toBeLessThan(1);
    const status=await boxes('.toolbar-forecast, .toolbar-readouts, .toolbar-pause'),second=span(status);
    expect(status.length).toBe(3);for(const b of status)expect(b.y).toBeGreaterThanOrEqual(first.bottom-0.5);
    expect(second.bottom).toBeLessThanOrEqual(bar.y+bar.height+0.5);expect(Math.abs((second.left+second.right)/2-centre)).toBeLessThan(1);
    await page.screenshot({path:'artifacts/browser-mobile-portrait-control-bar.png'});
  });
  test('the game stays fixed to the screen when the page is scrolled',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const before=(await page.locator('#app').boundingBox())!;
    await page.evaluate(()=>{document.body.style.minHeight='300vh';scrollTo(0,500);});
    await page.mouse.wheel(0,400);
    expect(await page.locator('#app').boundingBox()).toEqual(before);
    expect(await page.locator('#app').evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
  });
  test('the desktop keeps the palette strip and bars inside the bottom and side safe-area insets',async({page})=>{
    const session=await page.context().newCDPSession(page);
    await session.send('Emulation.setSafeAreaInsetsOverride' as never,{insets:{bottom:34,left:0,right:0,top:0}} as never);
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const strip=(await page.getByRole('toolbar',{name:'Edit tools'}).boundingBox())!,desk=(await page.locator('.game-desktop').boundingBox())!;
    // The strip ends the inset above the bottom of the desktop (in CSS px at the 1.2× page scale).
    const inset=await page.locator('.game-desktop').evaluate(el=>parseFloat(getComputedStyle(el).paddingBottom));
    expect(inset).toBeGreaterThan(0);expect(Math.abs(strip.y+strip.height-(desk.y+desk.height-inset))).toBeLessThan(1.5);
    await session.send('Emulation.setSafeAreaInsetsOverride' as never,{insets:{left:44,right:44,top:0,bottom:21}} as never);await page.setViewportSize({width:844,height:390});
    await expect.poll(async()=>(await page.getByRole('toolbar',{name:'Edit tools'}).boundingBox())!.x).toBeGreaterThan(0);
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
  expect(manifest).toMatchObject({name:'SimFarm',short_name:'SimFarm',display:'standalone',start_url:'./'});
  for(const icon of [...manifest.icons.map((i:{src:string;sizes:string})=>({src:'/'+i.src,size:Number(i.sizes.split('x')[0])})),{src:'/assets/apple-touch-icon.png',size:180}]){
    const response=await request.get(icon.src);expect(response.ok()).toBe(true);
    const png=PNG.sync.read(await response.body());expect([png.width,png.height]).toEqual([icon.size,icon.size]);
    // Opaque: launchers render transparency as black.
    for(let i=3;i<png.data.length;i+=4)if(png.data[i]!==255)throw new Error(`${icon.src} has transparent pixels`);
  }
  expect(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content')).toBe('yes');
  // iOS zooms the page into focused fields under 16px (map seed, loan amount) and the full-screen game has no way
  // to zoom back out; the page scale stays fixed and the game's own Zoom setting scales the terrain.
  // The fixed scale is 1.2 so controls are easier to tap (user request).
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('initial-scale=1.2, maximum-scale=1.2, user-scalable=no');
  // viewport-fit=cover exposes the bottom/side safe-area insets the desktop pads by. Content under the status bar is
  // blurred by iOS and takes no taps, so the status bar stays opaque.
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('viewport-fit=cover');
  expect(await page.locator('meta[name=apple-mobile-web-app-status-bar-style]').getAttribute('content')).toBe('default');
});

test.describe('pinch zoom',()=>{
  test.use({hasTouch:true,isMobile:true,deviceScaleFactor:3,viewport:{width:390,height:844}});
  test('two fingers zoom the terrain smoothly about their midpoint, keep the zoom they leave and never paint',async({page})=>{
    const f=shopFixture();f.state.disasters.enabled=false;const g=f.load().withAllCrops(browserCrops);await page.goto('/');await load(page,g.save(4));
    const session=await page.context().newCDPSession(page),viewport=page.locator('#viewport'),world=page.locator('#world');
    await viewport.evaluate(v=>v.scrollTo(400,400));
    const box=(await viewport.boundingBox())!,mid={x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
    /** The content point (in zoom-1 pixels) under the midpoint. */
    const under=()=>viewport.evaluate((v,m)=>{const r=v.getBoundingClientRect(),z=parseFloat(getComputedStyle(v.querySelector('canvas')!).width)/1536;
      return [(v.scrollLeft+m.x-r.left)/z,(v.scrollTop+m.y-r.top)/z];},mid);
    const pinch=async(from:number,to:number,end=true)=>{
      const points=(d:number)=>[{x:mid.x-d,y:mid.y,id:0},{x:mid.x+d,y:mid.y,id:1}];
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});
      for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/6)});
      if(end)await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    const before=await under();
    await pinch(40,80,false);
    // Mid-gesture: the canvas follows the fingers continuously and the midpoint's content stays put.
    expect(await world.evaluate(c=>parseFloat(getComputedStyle(c).width))).toBeCloseTo(3072,0);
    const during=await under();expect(Math.abs(during[0]-before[0])).toBeLessThan(1);expect(Math.abs(during[1]-before[1])).toBeLessThan(1);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await expect(page.locator('#zoom')).toHaveValue('2');
    const after=await under();expect(Math.abs(after[0]-before[0])).toBeLessThan(1);expect(Math.abs(after[1]-before[1])).toBeLessThan(1);
    // 2 x 0.7 = 1.4 stays 1.4, not snapped to device pixels (user request), and is listed as 140%.
    await pinch(100,70);
    await expect(page.locator('#zoom')).toHaveValue('1.4');
    expect(await page.locator('#zoom option:checked').textContent()).toBe('140%');
    expect(await world.evaluate(c=>c.getBoundingClientRect().width)).toBeCloseTo(1536*1.4,0);
    // A pinch that begins on the highlighted tile of a paint tool builds nothing.
    await page.getByRole('button',{name:'Dirt road',exact:true}).click();await expectPaletteAction(page,'Dirt road');
    const tile=await world.evaluate((c,m)=>{const r=c.getBoundingClientRect(),z=r.width/1536;return [Math.floor((m.x-40-r.left)/(16*z)),Math.floor((m.y-r.top)/(16*z))];},mid);
    const zoom=1.4,cell=(await world.boundingBox())!;
    const at={x:cell.x+(tile[0]+.5)*16*zoom,y:cell.y+(tile[1]+.5)*16*zoom};
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[at]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...at,id:0}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...at,id:0},{x:at.x+80,y:at.y,id:1}]});
    for(let i=1;i<=4;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:at.x-10*i,y:at.y,id:0},{x:at.x+80+10*i,y:at.y,id:1}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(await save(page)).toEqual(JSON.parse(g.save(4)));
    await session.detach();
  });
});
