import {readSaveText} from '../support/save-file';
import {test,expect,type Page,type CDPSession} from '@playwright/test';
import {PNG} from 'pngjs';
import {shopFixture} from '../support/livestock';
import {browserCrops} from '../support/crop-catalog';
import {worldIndex} from '../../src/formats/scenario';
import {reveal,expectPaletteAction,expectNoHorizontalOverflow} from '../support/workspace';

/** Touch screens zoom #app 1.2× (style.css); boxes are screen px, CSS lengths and scroll positions layout px. */
const Z=1.2;
async function load(page:Page,text:string){await page.locator('#load-farm-file').setInputFiles({name:'touch.json',mimeType:'application/json',buffer:Buffer.from(text)});await expect(page.locator('#save-status')).toHaveText('Farm loaded.');}
async function save(page:Page){const p=page.waitForEvent('download');await page.locator('#file-menu-button').click();await page.getByRole('menuitem',{name:'Save to File...',exact:true}).click();return JSON.parse(readSaveText((await (await p).path())!));}
async function coords(page:Page,x:number,y:number){const r=(await page.locator('#world').boundingBox())!;return {x:r.x+(x+.5)*16*Z,y:r.y+(y+.5)*16*Z};}
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
    await expectNoHorizontalOverflow(page);
  });
  test('a scaled Map window still locates the tapped overview tile',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    await page.setViewportSize({width:390,height:260});
    await page.locator('#window-map').tap();const map=page.locator('[data-window=map]');
    await expect(map).toHaveAttribute('data-scale',/^0\./);
    const scale=Number(await map.getAttribute('data-scale')),canvas=(await map.locator('canvas').first().boundingBox())!;
    await page.mouse.click(canvas.x+40.5*2*scale*Z,canvas.y+20.5*2*scale*Z);
    const viewport=page.locator('#viewport');
    // The tapped tile becomes the centre of the Edit view.
    await expect.poll(()=>viewport.evaluate(v=>[(v.scrollLeft+v.clientWidth/2)/16,(v.scrollTop+v.clientHeight/2)/16].map(c=>Math.round(c*10)/10))).toEqual([40.5,20.5]);
  });
  test('portrait centres the palette below the terrain as two rows of launcher-sized tools with PLANT and SPRAY at the end',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const palette=page.getByRole('toolbar',{name:'Edit tools'}),box=async(name:string)=>(await palette.getByRole('button',{name,exact:true}).boundingBox())!;
    const near=(actual:number[],expected:number[])=>actual.forEach((value,i)=>expect(Math.abs(value-expected[i]),`[${i}] ${value} vs ${expected[i]}`).toBeLessThan(1));
    const strip=(await palette.boundingBox())!,terrain=(await page.locator('#viewport').boundingBox())!;
    // No top band in portrait.
    expect(Math.abs((await page.getByRole('navigation',{name:'Original game menus'}).boundingBox())!.y-(await page.locator('.game-desktop').boundingBox())!.y)).toBeLessThan(1);
    expect(strip.y).toBeGreaterThanOrEqual(terrain.y+terrain.height);expect(Math.abs(strip.y+strip.height-(await page.locator('.game-desktop').boundingBox())!.height-(await page.locator('.game-desktop').boundingBox())!.y)).toBeLessThan(1.5);const desk=(await page.locator('.game-desktop').boundingBox())!;expect(Math.abs(strip.x+strip.width/2-(desk.x+desk.width/2))).toBeLessThan(1);
    // The strip is zoomed 4/3 so tool cells are as big as the 32px control-bar launchers.
    const launcher=(await page.locator('#window-buy').boundingBox())!;
    near([strip.width,strip.height],[193*4/3*Z,49*4/3*Z]);
    // Source pairs become columns: Move/View over each other, then Paved/Dirt … Trees/Bulldoze.
    const move=await box('Move object'),view=await box('View object'),paved=await box('Paved road'),bulldoze=await box('Bulldoze');
    near([move.width,move.height],[launcher.width,launcher.height]);
    near([view.x,view.y-move.y,paved.x-move.x,paved.y],[move.x,32*Z,32*Z,move.y]);near([bulldoze.x-move.x,bulldoze.y],[160*Z,view.y]);
    const plant=await box('PLANT'),spray=await box('SPRAY');
    near([plant.x-move.x,plant.y,plant.width,plant.height,spray.x,spray.y],[192*Z,move.y,64*Z,32*Z,plant.x,view.y]);
    // The Plant menu opens just above the strip, over its button (FieldToolMenu placement is covered below).
    await palette.getByRole('button',{name:'PLANT'}).tap();const menu=(await page.getByRole('menu',{name:'Plant Field'}).boundingBox())!;
    near([menu.y+menu.height],[strip.y]);expect(menu.x).toBeLessThanOrEqual(plant.x+plant.width);expect(menu.x+menu.width).toBeGreaterThanOrEqual(plant.x);
    await page.screenshot({path:'artifacts/browser-mobile-portrait-palette.png'});
    // Landscape keeps the source vertical palette at the left of the terrain, right of the menu column.
    await page.keyboard.press('Escape');await page.setViewportSize({width:844,height:390});
    const nav=(await page.getByRole('navigation',{name:'Original game menus'}).boundingBox())!;
    const side=(await palette.boundingBox())!;near([side.x,side.width],[nav.x+nav.width,49*Z]);
    near([(await box('View object')).x-(await box('Move object')).x,(await box('Move object')).width],[24*Z,24*Z]);
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
    // Menu headings as tall as the 32px launchers, in one row; items 28px.
    const headings=await boxes('.original-menu-heading');
    for(const h of headings){expect(Math.abs(h.height-launchers[0].height)).toBeLessThan(1);expect(Math.abs(h.y-headings[0].y)).toBeLessThan(1);}
    await page.locator('#windows-menu-button').tap();
    expect(Math.abs((await page.locator('.original-menu-popup [role^=menuitem]').first().boundingBox())!.height-launchers[0].height*28/32)).toBeLessThan(1);
    await page.locator('#windows-menu-button').tap();
    await page.screenshot({path:'artifacts/browser-mobile-portrait-control-bar.png'});
  });
  test('landscape stacks the menus in a full-height left column beside the control bar and terrain',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    await page.setViewportSize({width:844,height:390});
    const desk=(await page.locator('.game-desktop').boundingBox())!,nav=(await page.getByRole('navigation',{name:'Original game menus'}).boundingBox())!;
    const bar=(await page.getByRole('toolbar',{name:'Game toolbar'}).boundingBox())!,workspace=(await page.locator('.edit-workspace').boundingBox())!;
    // A 16px top band in the page colour (the menu bar's) keeps the top row off the screen edge.
    expect(Math.abs(nav.x-desk.x)).toBeLessThan(1);expect(Math.abs(nav.y-desk.y-16*Z)).toBeLessThan(1);expect(Math.abs(nav.height-(desk.height-16*Z))).toBeLessThan(1);
    const colour=(selector:string)=>page.locator(selector).evaluate(el=>getComputedStyle(el).backgroundColor);
    expect([await colour('.game-desktop'),await colour('.original-menu-bar'),await colour('#app')]).toEqual(Array(3).fill('rgb(85, 85, 85)'));
    expect(Math.abs(bar.x-(nav.x+nav.width))).toBeLessThan(1);expect(bar.y).toBeLessThan(nav.y+1);expect(Math.abs(workspace.x-bar.x)).toBeLessThan(1);expect(Math.abs(workspace.y-(bar.y+bar.height))).toBeLessThan(1);
    // Headings stack top to bottom at the column's left edge.
    const headings=await Promise.all(['file','options','speed','windows'].map(async id=>(await page.locator(`#${id}-menu-button`).boundingBox())!));
    for(const [i,h] of headings.entries()){expect(Math.abs(h.x-nav.x)).toBeLessThan(1);if(i)expect(h.y).toBeGreaterThanOrEqual(headings[i-1].y+headings[i-1].height-0.5);}
    // A menu opens to the right of the column and stays on screen.
    // Headings and items are taller for tapping.
    for(const h of headings)expect(Math.round(h.height)).toBe(Math.round(32*Z));
    // A menu that fits opens to the right of its heading, level with it.
    await page.locator('#file-menu-button').tap();const file=(await page.locator('.original-menu-popup').boundingBox())!;
    expect(Math.abs(file.x-(nav.x+nav.width))).toBeLessThan(1.5);expect(Math.abs(file.y-headings[0].y)).toBeLessThan(1.5);
    await page.locator('#file-menu-button').tap();
    // Windows (nine items) would run off the 325px-high screen beside its heading, so it moves up just enough.
    await page.locator('#windows-menu-button').tap();const popup=(await page.locator('.original-menu-popup').boundingBox())!;
    expect(Math.abs(popup.x-(nav.x+nav.width))).toBeLessThan(1.5);expect(popup.y).toBeLessThan(headings[3].y);
    expect(popup.y+popup.height).toBeLessThanOrEqual(desk.y+desk.height+0.5);
    expect(Math.round((await page.locator('.original-menu-popup [role^=menuitem]').first().boundingBox())!.height)).toBe(Math.round(28*Z));
    await page.screenshot({path:'artifacts/browser-mobile-landscape-menu.png'});
    // The lowest heading's long menu moves up only far enough to fit between the band and the screen bottom.
    await page.locator('#windows-menu-button').tap();await page.locator('#debug-menu-button').tap();
    const debug=(await page.locator('.original-menu-popup').boundingBox())!,debugHeading=(await page.locator('#debug-menu-button').boundingBox())!;
    expect(debug.y).toBeLessThan(debugHeading.y);expect(debug.y).toBeGreaterThanOrEqual(nav.y-0.5);expect(debug.y+debug.height).toBeLessThanOrEqual(desk.y+desk.height+0.5);
    await page.screenshot({path:'artifacts/browser-mobile-landscape-debug-menu.png'});
    // Windows keep clear of the menu column.
    await page.locator('#windows-menu-button').tap();await page.locator('#window-bank').tap();
    await expect.poll(async()=>(await page.locator('[data-window=bank]').boundingBox())!.x).toBeGreaterThanOrEqual(nav.x+nav.width-0.5);
    await page.locator('[data-window=bank] .game-window-title').dragTo(page.locator('#viewport'),{targetPosition:{x:2,y:40}});
    expect((await page.locator('[data-window=bank]').boundingBox())!.x).toBeGreaterThanOrEqual(nav.x+nav.width-0.5);
  });
  test('rotating between landscape and portrait leaves the menus and control bar tappable',async({page})=>{
    await page.setViewportSize({width:844,height:390});
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    // Every heading and launcher is the topmost element at its centre, and a menu and a window open by tap.
    const reachable=async()=>{
      for(const id of ['file-menu-button','debug-menu-button','window-buy','window-expert','window-bank']){
        expect(await page.locator(`#${id}`).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),id).toBe(true);
      }
      await page.locator('#file-menu-button').tap();await expect(page.locator('#original-file-menu')).toBeVisible();
      await page.locator('#file-menu-button').tap();await expect(page.locator('#original-file-menu')).toHaveCount(0);
      await page.locator('#window-bank').tap();await expect(page.locator('[data-window=bank]')).toBeVisible();
      await page.locator('[data-window=bank]').getByRole('button',{name:/^Close /}).first().tap();await expect(page.locator('[data-window=bank]')).toBeHidden();
      // PLANT and SPRAY each open their own menu (on an iPhone a 1.2 viewport scale sent PLANT taps to SPRAY).
      await page.getByRole('button',{name:'PLANT',exact:true}).tap();await expect(page.getByRole('menu',{name:'Plant Field'})).toBeVisible();
      await page.keyboard.press('Escape');await expect(page.getByRole('menu',{name:'Plant Field'})).toHaveCount(0);
      await page.getByRole('button',{name:'SPRAY',exact:true}).tap();await expect(page.getByRole('menu',{name:'Spray Field'})).toBeVisible();
      await page.keyboard.press('Escape');await expect(page.getByRole('menu',{name:'Spray Field'})).toHaveCount(0);
    };
    await reachable();
    for(const size of [{width:390,height:844},{width:844,height:390},{width:390,height:844}]){
      await page.setViewportSize(size);
      const nav=(await page.getByRole('navigation',{name:'Original game menus'}).boundingBox())!;
      // Portrait: one bar across the top. Landscape: the left column.
      if(size.width<size.height)expect(nav.width).toBeGreaterThan(nav.height*4);else expect(nav.height).toBeGreaterThan(nav.width*2);
      await reachable();
    }
  });
  test('a window follows the finger one to one through the 1.2× zoom',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    await page.locator('#window-weather').tap();const weather=page.locator('[data-window=weather]'),title=weather.locator('.game-window-title');
    const drag=async(dx:number,dy:number)=>{
      const before=(await weather.boundingBox())!,grip=(await title.boundingBox())!,start={x:grip.x+grip.width/2,y:grip.y+grip.height/2};
      await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y+dy,{steps:4});await page.mouse.up();
      const after=(await weather.boundingBox())!;return [after.x-before.x,after.y-before.y];
    };
    // Portrait: the fitted window spans the screen width, so it can only move down.
    const down=await drag(0,60);expect(Math.abs(down[1]-60)).toBeLessThan(1.5);
    // Landscape: room to move sideways.
    await page.setViewportSize({width:844,height:390});
    // The window refits to the new size through a ResizeObserver; wait until it has settled before dragging.
    let last='';
    await expect.poll(async()=>{const b=(await weather.boundingBox())!,now=JSON.stringify(b),settled=now===last&&b.x+b.width<700;last=now;return settled;},{intervals:[100]}).toBe(true);
    const side=await drag(60,0);expect(Math.abs(side[0]-60)).toBeLessThan(1.5);
  });
  test('rotating the phone closes an open menu',async({page})=>{
    await page.setViewportSize({width:844,height:390});
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    await page.locator('#windows-menu-button').tap();await expect(page.locator('#original-windows-menu')).toBeVisible();
    await page.setViewportSize({width:390,height:844});await expect(page.locator('#original-windows-menu')).toHaveCount(0);
    await page.locator('#options-menu-button').tap();await expect(page.locator('#original-options-menu')).toBeVisible();
    await page.setViewportSize({width:844,height:390});await expect(page.locator('#original-options-menu')).toHaveCount(0);
  });
  test('a long press selects no UI text and shows no callout, while text fields stay editable',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    await page.locator('#window-bank').tap();
    const style=(selector:string)=>page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el) as CSSStyleDeclaration&{webkitUserSelect:string;webkitTouchCallout?:string};
      return [s.webkitUserSelect,s.userSelect,s.webkitTouchCallout??'none'];});
    for(const selector of ['#file-menu-button','#farm-date','.edit-caption','[data-window=bank] .game-window-title','#loan-balance'])
      expect(await style(selector),selector).toEqual(['none','none','none']);
    expect((await style('#loan-amount')).slice(0,2)).toEqual(['text','text']);
  });
  test('taps never wait for a double tap',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    // touch-action is not inherited; the browser applies the most restrictive value along the ancestors, so html covers the page.
    for(const selector of ['html','.game-desktop'])
      expect(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).touchAction),selector).toBe('manipulation');
  });
  test('Plant and Spray menus use two columns of taller rows and open beside their buttons inside the screen',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    const palette=page.getByRole('toolbar',{name:'Edit tools'});
    const open=async(name:'PLANT'|'SPRAY')=>{
      const button=(await palette.getByRole('button',{name,exact:true}).boundingBox())!;await palette.getByRole('button',{name,exact:true}).tap();
      const menu=page.getByRole('menu',{name:name==='PLANT'?'Plant Field':'Spray Field'});await expect(menu).toBeVisible();
      return {button,menu,box:(await menu.boundingBox())!,area:(await page.locator('.edit-workspace').boundingBox())!,strip:(await palette.boundingBox())!};
    };
    const inside=(box:{x:number;y:number;width:number;height:number},area:typeof box)=>{
      expect(box.x).toBeGreaterThanOrEqual(area.x-0.5);expect(box.y).toBeGreaterThanOrEqual(area.y-0.5);
      expect(box.x+box.width).toBeLessThanOrEqual(area.x+area.width+0.5);expect(box.y+box.height).toBeLessThanOrEqual(area.y+area.height+0.5);
    };
    // Portrait: above the strip, over the button, two columns of 12 rows, each 28px.
    let plant=await open('PLANT');inside(plant.box,plant.area);
    expect(Math.abs(plant.box.y+plant.box.height-plant.strip.y)).toBeLessThan(1);
    expect(plant.box.x).toBeLessThanOrEqual(plant.button.x+1);expect(plant.box.x+plant.box.width).toBeGreaterThanOrEqual(plant.button.x+plant.button.width-1);
    const items=plant.menu.getByRole('menuitem'),first=(await items.nth(0).boundingBox())!,second=(await items.nth(1).boundingBox())!;
    const lastOfFirst=(await items.nth(11).boundingBox())!,topOfSecond=(await items.nth(12).boundingBox())!;
    expect(Math.abs(first.height-28*Z)).toBeLessThan(1);expect(Math.abs(second.y-first.y-28*Z)).toBeLessThan(1);
    expect(Math.abs(topOfSecond.y-first.y)).toBeLessThan(1);expect(topOfSecond.x).toBeGreaterThan(lastOfFirst.x);
    expect(Math.abs(plant.box.width-224*Z)).toBeLessThan(1);
    // Arrow keys move by the twelve rows.
    await page.keyboard.press('ArrowRight');await expect(items.nth(12)).toBeFocused();
    await page.screenshot({path:'artifacts/browser-mobile-portrait-plant-menu.png'});
    await page.keyboard.press('Escape');
    const spray=await open('SPRAY');inside(spray.box,spray.area);expect(Math.abs(spray.box.y+spray.box.height-spray.strip.y)).toBeLessThan(1);
    expect(Math.abs(spray.box.width-112*Z)).toBeLessThan(1);expect(Math.abs(spray.box.x+spray.box.width/2-(spray.button.x+spray.button.width/2))).toBeLessThan(1);
    await page.keyboard.press('Escape');
    // Landscape: right of the side palette, level with the button where it fits, inside the workspace; Plant scrolls.
    await page.setViewportSize({width:844,height:390});
    plant=await open('PLANT');inside(plant.box,plant.area);expect(Math.abs(plant.box.x-(plant.strip.x+plant.strip.width))).toBeLessThan(1);
    expect(await plant.menu.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
    await page.screenshot({path:'artifacts/browser-mobile-landscape-plant-menu.png'});
    await page.keyboard.press('Escape');
    const side=await open('SPRAY');inside(side.box,side.area);expect(Math.abs(side.box.x-(side.strip.x+side.strip.width))).toBeLessThan(1);
    // Level with the button, or moved up only as far as the workspace bottom requires.
    expect(side.box.y).toBeLessThanOrEqual(side.button.y+1);
    expect(Math.min(Math.abs(side.box.y-side.button.y),Math.abs(side.box.y+side.box.height-side.area.y-side.area.height))).toBeLessThan(1);
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
    const inset=await page.locator('.game-desktop').evaluate(el=>parseFloat(getComputedStyle(el).paddingBottom))*Z;
    expect(inset).toBeGreaterThan(0);expect(Math.abs(strip.y+strip.height-(desk.y+desk.height-inset))).toBeLessThan(1.5);
    await session.send('Emulation.setSafeAreaInsetsOverride' as never,{insets:{left:44,right:44,top:0,bottom:21}} as never);await page.setViewportSize({width:844,height:390});
    await expect.poll(async()=>(await page.getByRole('toolbar',{name:'Edit tools'}).boundingBox())!.x).toBeGreaterThan(0);
  });
});

// Touch-screen pages are zoomed 1.2×, so these also check tile picking and panning through the zoom.
test.describe('touch screen',()=>{
test.use({hasTouch:true,isMobile:true,viewport:{width:1280,height:900}});
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
  await touch(session,[from,{x:from.x-40*Z,y:from.y-30*Z},{x:from.x-80*Z,y:from.y-60*Z}]);
  // Screen-px finger travel scrolls the same distance in layout px (80, 60) through the zoom.
  await expect.poll(()=>viewport.evaluate(v=>[Math.round(v.scrollLeft),Math.round(v.scrollTop)])).toEqual([80,60]);
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  // The highlight stayed on tile 25,25 while the map moved; pressing it paints and dragging continues the road.
  const a=await coords(page,25,25),b=await coords(page,27,25);
  await touch(session,[a,{x:(a.x+b.x)/2,y:a.y},b]);
  for(const x of [25,26,27])g.dispatch({type:'network',tool:'road-161',x,y:25});
  expect(await save(page)).toEqual(JSON.parse(g.save(4)));
  await session.detach();
});
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
  // The page scale stays 1 (a 1.2 initial-scale misaligned taps after rotating on iOS); touch screens zoom #app 1.2×.
  expect(await page.locator('meta[name=viewport]').getAttribute('content')).toContain('width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
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
      return [(v.scrollLeft+(m.x-r.left)/1.2)/z,(v.scrollTop+(m.y-r.top)/1.2)/z];},mid);
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
    expect(await world.evaluate(c=>c.getBoundingClientRect().width)).toBeCloseTo(1536*1.4*Z,0);
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

test.describe('tablet screen',()=>{
  test.use({hasTouch:true,isMobile:true,viewport:{width:820,height:1180}});
  test('tablets keep the desktop layout in both orientations',async({page})=>{
    await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
    for(const size of [{width:820,height:1180},{width:1180,height:820}]){
      await page.setViewportSize(size);
      const nav=(await page.getByRole('navigation',{name:'Original game menus'}).boundingBox())!,palette=(await page.getByRole('toolbar',{name:'Edit tools'}).boundingBox())!;
      const terrain=(await page.locator('#viewport').boundingBox())!;
      // Menu bar across the top, palette at the left of the terrain in its source two columns.
      expect(nav.width).toBeGreaterThan(nav.height*4);expect(Math.round(palette.width)).toBe(Math.round(49*Z));expect(palette.y).toBeLessThan(terrain.y+terrain.height);
      expect(Math.abs(palette.x+palette.width-terrain.x)).toBeLessThan(1.5);
    }
  });
});
