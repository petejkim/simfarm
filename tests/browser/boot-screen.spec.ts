import {test,expect} from '@playwright/test';

test('the original title screen and Loading... show before any script runs and leave once the farm is shown',async({page})=>{
  // Hold the app's entry script until the boot screen has been checked: it must come from index.html alone.
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/src/main.tsx',async route=>{await held;await route.continue();});
  await page.goto('/',{waitUntil:'commit'});
  const boot=page.locator('#boot');
  await expect(boot).toBeVisible();await expect(boot.getByText('Loading...',{exact:true})).toBeVisible();
  const image=boot.locator('img');await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth)).toBe(640);
  expect(await image.evaluate(img=>new URL((img as HTMLImageElement).src).pathname)).toBe('/assets/sftitle.png');
  const box=(await image.boundingBox())!,text=(await boot.getByText('Loading...').boundingBox())!;
  expect([box.width,box.height]).toEqual([640,480]);expect(text.y).toBeGreaterThan(box.y+box.height);
  release();
  await expect(page.locator('#world')).toBeVisible();await expect(boot).toHaveCount(0);
});

test('a startup error replaces the boot screen',async({page})=>{
  await page.route('**/assets/balance-window.png',route=>route.abort());await page.goto('/');
  await expect(page.getByRole('heading',{name:'SimFarm assets unavailable'})).toBeVisible();await expect(page.locator('#boot')).toHaveCount(0);
});

test('a farm load error replaces the boot screen and its retry stays usable',async({page})=>{
  await page.route('**/assets/scenario0.tiles.png',route=>route.abort());await page.goto('/');
  await expect(page.getByRole('button',{name:'Retry loading farm',exact:true})).toBeVisible();await expect(page.locator('#boot')).toHaveCount(0);
});
