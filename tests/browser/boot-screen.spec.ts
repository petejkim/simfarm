import {test,expect,webkit,type Page} from '@playwright/test';

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

/** Image and text boxes from index.html alone, then with the app's scripts and stylesheet running while the farm is
 * still loading (its scenario held). They must not move or rescale (user report: the title rescaled in WebKit). */
async function bootBoxes(page:Page){
  let releaseApp!:()=>void,releaseFarm!:()=>void;
  const app=new Promise<void>(resolve=>{releaseApp=resolve;}),farm=new Promise<void>(resolve=>{releaseFarm=resolve;});
  await page.route('**/src/main.tsx',async route=>{await app;await route.continue();});
  await page.route('**/assets/raw/SCEN0.SSM',async route=>{await farm;await route.continue();});
  await page.goto('/',{waitUntil:'commit'});
  await expect.poll(()=>page.locator('#boot img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth)).toBe(640);
  const measure=()=>page.locator('#boot').evaluate(boot=>{
    const box=(el:Element)=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
    return {image:box(boot.querySelector('img')!),text:box(boot.querySelector('p')!),font:getComputedStyle(boot).fontFamily};
  });
  const before=await measure();releaseApp();
  // The app stylesheet has applied once the desktop exists behind the overlay.
  await expect(page.locator('#app .game-desktop, #app .loading').first()).toBeAttached();
  const during=await measure();releaseFarm();
  await expect(page.locator('#boot')).toHaveCount(0);
  return {before,during};
}
for(const viewport of [{width:1280,height:900},{width:844,height:390},{width:390,height:844}])
  test(`the boot title keeps its size and place while the app loads (Chromium and WebKit, ${viewport.width}×${viewport.height})`,async({page,baseURL})=>{
    await page.setViewportSize(viewport);
    const chromium=await bootBoxes(page);
    const browser=await webkit.launch();
    try{
      const webkitPage=await browser.newPage({baseURL,viewport,storageState:{cookies:[],origins:[{origin:baseURL!,localStorage:[{name:'simfarm.startup.v1',value:'scenario-1'}]}]}});
      for(const {before,during} of [chromium,await bootBoxes(webkitPage)]){
        expect(during).toEqual(before);
        expect(before.image[2]/before.image[3]).toBeCloseTo(4/3,3); // never stretched (the 24px WebKit stretch was 1.27)
        expect(before.font).toBe('system-ui, -apple-system, sans-serif'); // not Roboto, which loads with the app
      }
    }finally{await browser.close();}
  });
