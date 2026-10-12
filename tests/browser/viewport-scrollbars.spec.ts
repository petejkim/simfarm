import {test,expect} from '@playwright/test';
// Headless Chromium hides scrollbars unless --hide-scrollbars is dropped; this file checks the real ones.
test.use({launchOptions:{args:['--disable-blink-features=FileSystemAccessLocal'],ignoreDefaultArgs:['--hide-scrollbars']}});

test('terrain viewport keeps both styled browser scrollbars visible, like the Schedule scroll bar',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  const viewport=page.locator('#viewport');
  const box=await viewport.evaluate((v:HTMLElement)=>({ow:v.offsetWidth,cw:v.clientWidth,oh:v.offsetHeight,ch:v.clientHeight,overflow:getComputedStyle(v).overflow}));
  // overflow:scroll keeps both bars present; ::-webkit-scrollbar gives them 16px, like the Schedule scroll bar.
  expect(box.overflow).toBe('scroll');expect([box.ow-box.cw,box.oh-box.ch]).toEqual([16,16]);
  // The track is the 1px face/shadow checker between ink edges; buttons are framed bevel faces with ink arrows.
  const r=(await viewport.boundingBox())!,shot=await page.screenshot({clip:{x:r.x+r.width-16,y:r.y,width:16,height:40}});
  const {PNG}=await import('pngjs'),png=PNG.sync.read(shot),px=(x:number,y:number)=>Array.from(png.data.subarray((y*16+x)*4,(y*16+x)*4+3));
  expect(px(0,0)).toEqual([0,0,0]);expect(px(1,1)).toEqual([255,255,255]);expect(px(14,14)).toEqual([130,130,130]); // up button frame and bevel
  expect(px(0,20)).toEqual([0,0,0]);expect(px(15,20)).toEqual([0,0,0]); // track ink edges
  expect([px(1,20),px(2,20)].map(c=>c.join())).toEqual(px(1,20)[0]===194?['194,194,194','130,130,130']:['130,130,130','194,194,194']); // checker
});

test('the scrollbar style is global: an overflowing Buy description gets the same 16px bar, only when needed',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');await page.locator('#window-buy').click();
  const d=page.locator('#buy-description');await expect(d).toBeVisible();
  const width=()=>d.evaluate((e:HTMLElement)=>e.offsetWidth-e.clientWidth);
  if(await d.evaluate((e:HTMLElement)=>e.scrollHeight<=e.clientHeight))expect(await width()).toBe(0);
  await d.evaluate(e=>{e.textContent=(e.textContent+' ').repeat(6);});expect(await width()).toBe(16);
  const r=(await d.boundingBox())!,{PNG}=await import('pngjs'),png=PNG.sync.read(await page.screenshot({clip:{x:r.x+r.width-16,y:r.y,width:16,height:16}}));
  const px=(x:number,y:number)=>Array.from(png.data.subarray((y*16+x)*4,(y*16+x)*4+3));
  expect([px(0,0),px(1,1),px(14,14)]).toEqual([[0,0,0],[255,255,255],[130,130,130]]); // framed bevel arrow button
});
