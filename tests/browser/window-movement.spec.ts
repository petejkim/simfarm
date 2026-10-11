import { test, expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function start(page: Page) {
  await page.clock.install({ time: new Date('1993-04-05T12:00:00Z') });
  await page.clock.pauseAt(new Date('1993-04-05T12:00:00Z'));
  await page.goto('/'); await expect(page.locator('#map-status')).toContainText('Scenario 1');
}
async function save(page: Page) {
  const pending = page.waitForEvent('download');
  await page.locator('#file-menu-button').click(); await page.getByRole('menuitem', { name: 'Save', exact: true }).click();
  return JSON.parse(readFileSync((await (await pending).path())!, 'utf8'));
}
async function drag(page: Page, title: Locator, dx: number, dy: number) {
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x + box.width/2, box.y + 8); await page.mouse.down();
  await page.mouse.move(box.x + box.width/2 + dx, box.y + 8 + dy, { steps: 4 }); await page.mouse.up();
}

test('source wooden titles use HTML text; dragging persists across closing without touching Edit or farm state', async ({ page }) => {
  await start(page); const before = await save(page), map = await page.locator('#viewport').boundingBox();
  await page.locator('#window-bank').click();
  const bank = page.getByRole('dialog', { name: 'Bank', exact: true }), title = bank.locator('.game-window-title');
  expect(await title.boundingBox()).toEqual({ x:176, y:96, width:288, height:16 });
  expect(await title.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('window-title.png');
  expect(await page.locator('.edit-title').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('window-title-inactive.png');
  const text = await title.locator('span').evaluate(el => { const r = document.createRange(); r.selectNodeContents(el); return r.toString(); });
  expect(text).toBe('Bank');
  await drag(page, title, 190, 110);
  expect(await bank.boundingBox()).toEqual({ x:366,y:206,width:288,height:240 });
  // Releasing outside the original title is captured; subsequent movement is inert.
  await page.mouse.move(800, 600); expect(await bank.boundingBox()).toMatchObject({ x:366,y:206 });
  expect(await page.locator('#viewport').boundingBox()).toEqual(map);
  await page.getByRole('button', { name: 'Close Bank', exact: true }).click();
  await expect(bank).toBeHidden(); await page.locator('#window-bank').click();
  expect(await bank.boundingBox()).toMatchObject({ x:366,y:206 });
  await title.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Shift+ArrowDown');
  expect(await bank.boundingBox()).toMatchObject({ x:376,y:207 });
  await page.screenshot({ path: 'artifacts/browser-movable-windows.png' });
  await page.keyboard.press('Escape');
  expect(await page.locator('.edit-title').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('window-title.png');
  await drag(page, page.locator('.edit-title'), 80, 80);
  expect(await page.locator('#viewport').boundingBox()).toEqual(map);
  await expect(page.getByRole('button', { name: 'Close Edit', exact: true })).toHaveCount(0);
  expect(await save(page)).toEqual(before);
});

test('dragging clamps at desktop edges, recovers after resize and leaves controls usable', async ({ page }) => {
  await start(page); await page.locator('#window-buy').click();
  const buy = page.getByRole('dialog', { name:'Buy', exact:true }), title = buy.locator('.game-window-title');
  await drag(page, title, -900, -900); expect(await buy.boundingBox()).toMatchObject({ x:0,y:48 });
  await drag(page, title, 2000, 2000); expect(await buy.boundingBox()).toEqual({ x:1024,y:660,width:256,height:240 });
  await page.setViewportSize({width:800,height:600});
  await expect.poll(async () => await buy.boundingBox()).toEqual({ x:544,y:360,width:256,height:240 });
  await buy.getByRole('button', { name:'Machinery',exact:true }).click();
  await expect(page.locator('#buy-description')).toContainText('Tractor');
  const before = await buy.boundingBox();
  // Secondary buttons cannot initiate a move.
  const box = (await title.boundingBox())!;
  await page.mouse.move(box.x+100,box.y+8); await page.mouse.down({button:'right'});
  await page.mouse.move(box.x+70,box.y+30); await page.mouse.up({button:'right'});
  expect(await buy.boundingBox()).toEqual(before);
  await page.getByRole('button', {name:'Close Buy',exact:true}).click(); await expect(buy).toBeHidden();
});

test('touch pointer cancellation stops movement and missing title artwork fails before play', async ({ page }) => {
  await start(page); await page.locator('#window-bank').click();
  const bank = page.getByRole('dialog', {name:'Bank',exact:true}), title = bank.locator('.game-window-title');
  // Real touch input exercises capture and touch-action without mobile rearrangement.
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:300,y:104}]});
  await session.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:360,y:164}]});
  await session.send('Input.dispatchTouchEvent', {type:'touchCancel',touchPoints:[]});
  expect(await bank.boundingBox()).toMatchObject({x:236,y:156});
  await title.dispatchEvent('pointermove', {pointerId:2,clientX:500,clientY:500,isPrimary:true,pointerType:'touch'});
  expect(await bank.boundingBox()).toMatchObject({x:236,y:156});
  await session.detach();
  await page.route('**/assets/window-title.png', route => route.abort()); await page.reload();
  await expect(page.getByRole('heading', {name:'SimFarm assets unavailable'})).toBeVisible();
  await expect(page.locator('.loading')).toContainText('window-title.png');
  await expect(page.locator('#world')).toHaveCount(0);
});

test('right title ends show source active/inactive pixels and drag without closing or resizing',async({page})=>{
  await start(page);const before=await save(page);
  await page.locator('#window-buy').click();
  const buy=page.locator('[data-window=buy]'),bank=page.locator('[data-window=bank]');
  const title=buy.locator('.game-window-title');
  await title.focus();for(let i=0;i<30;i++)await page.keyboard.press('ArrowRight');
  await page.locator('#window-bank').click();await page.mouse.move(0,0);
  const {PNG}=await import('pngjs');
  async function endPixels(window:Locator,name:string){
    const box=(await window.locator('.game-window-title').boundingBox())!;
    const actual=PNG.sync.read(await page.screenshot({clip:{x:box.x+box.width-16,y:box.y,width:16,height:16}}));
    const expected=PNG.sync.read(readFileSync(`public/assets/${name}.png`));
    expect(actual.data).toEqual(expected.data);
  }
  await endPixels(bank,'window-title-end');await endPixels(buy,'window-title-end-inactive');
  const old=(await buy.boundingBox())!,box=(await title.boundingBox())!;
  // This area is the same title drag surface, not an extra button/tab stop.
  await expect(title.getByRole('button')).toHaveCount(1);
  await page.mouse.move(box.x+box.width-8,box.y+8);await page.mouse.down();
  await page.mouse.move(box.x+box.width+32,box.y+38,{steps:3});await page.mouse.up();
  await expect(buy).toHaveAttribute('data-front','true');await expect(bank).toHaveAttribute('data-front','false');
  expect(await buy.boundingBox()).toEqual({...old,x:old.x+40,y:old.y+30});
  await title.evaluate(el=>(el as HTMLElement).blur());await page.mouse.move(0,0);
  await endPixels(buy,'window-title-end');await endPixels(bank,'window-title-end-inactive');
  await page.screenshot({path:'artifacts/browser-title-ends.png'});
  expect(await save(page)).toEqual(before);
});
