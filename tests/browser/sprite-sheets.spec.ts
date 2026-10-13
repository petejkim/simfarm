import {test,expect,type Page} from '@playwright/test';
import {newGame,openWindow,reveal} from '../support/workspace';

/** Every data: PNG URL in the document (inline styles, computed backgrounds and image sources). */
const dataImages=(page:Page)=>page.evaluate(()=>[...document.querySelectorAll('*')].flatMap(el=>[
  el.getAttribute('style')??'',getComputedStyle(el).backgroundImage,el instanceof HTMLImageElement?el.src:'']).filter(text=>text.includes('data:image/png')).length);
/** The distinct sprite-sheet paths used by sprites under a selector. */
const sheets=(page:Page,selector:string)=>page.evaluate(selector=>[...new Set([...document.querySelectorAll(`${selector} *`)]
  .map(el=>/url\("([^"]+)"\)/.exec(getComputedStyle(el).backgroundImage)?.[1]).filter(Boolean).map(url=>new URL(url!).pathname))].sort(),selector);

test('tile sprites share the imported sprite-sheet files and show each farm slot\'s own crop',async({page})=>{
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await page.getByRole('button',{name:'PLANT',exact:true}).click();
  const plant=page.getByRole('menu',{name:'Plant Field',exact:true});await expect(plant.locator('[data-field-tool]')).toHaveCount(24);
  expect(await sheets(page,'[role=menu]')).toEqual(['/assets/terrain-tiles.png']);
  // Scenario 1 slot 1 is grapes, fixed crop 7: its plant tile 832+7 sits at column 7, row 26 of the shared sheet.
  const icon=(slot:number)=>plant.locator(`[data-field-tool="${slot}"] .sprite`).first();
  await expect(plant.locator('[data-field-tool="1"]')).toContainText('Grapes');
  await expect(icon(1)).toHaveCSS('background-position','-112px -416px');
  await expect(icon(0)).toHaveCSS('background-position','0px -416px'); // almonds, fixed crop 0
  expect(await dataImages(page)).toBe(0);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'SPRAY',exact:true}).click();await expect(page.getByRole('menu',{name:'Spray Field',exact:true})).toBeVisible();
  for(const sheet of await sheets(page,'[role=menu]'))expect(['/assets/terrain-tiles.png','/assets/masked-tiles.png']).toContain(sheet);
  expect(await dataImages(page)).toBe(0);await page.keyboard.press('Escape');
  for(const key of ['market','evaluation','expert']){
    await openWindow(page,key);
    for(const sheet of await sheets(page,`[data-window="${key}"]`))expect(sheet,key).not.toMatch(/^blob:|^data:/);
    if(key!=='expert')expect(await sheets(page,`[data-window="${key}"]`),key).toContain('/assets/terrain-tiles.png'); // Expert's opening card has no tiles
  }
  expect(await dataImages(page)).toBe(0);
});

test('the region map and terrain preview use no data: PNGs',async({page})=>{
  await page.goto('/');await expect(page.locator('#world')).toBeVisible();
  await newGame(page);await reveal(page,'#region-map');
  await expect(page.locator('#region-map')).toHaveCSS('background-image',/region-map\.png"\)$/);
  expect(await sheets(page,'#region-map')).toEqual(['/assets/region-map.inverted.png']);
  expect(await dataImages(page)).toBe(0);
  await reveal(page,'#region-design');await page.locator('#region-design').click();
  await expect(page.locator('#terrain-preview')).toBeVisible();expect(await dataImages(page)).toBe(0);
});

test('the Map window overview and legend are drawn from the imported miniature sheets',async({page})=>{
  const requested:string[]=[];page.on('request',request=>{const path=new URL(request.url()).pathname;if(/map-tiles|far_mapc/.test(path))requested.push(path);});
  await page.goto('/');await expect(page.locator('#map-status')).toContainText('Scenario 1');
  await openWindow(page,'map');const panel=page.getByRole('region',{name:'Farm overview'}),canvas=panel.locator('.overview-viewport canvas');
  await expect(canvas).toBeVisible();
  expect(requested.sort()).toEqual(['/assets/map-tiles.inverted.png','/assets/map-tiles.png']); // the raw miniature is no longer fetched
  // Every one of the 192×192 pixels is painted, opaque, from the sheet.
  const opaque=()=>canvas.evaluate((el:HTMLCanvasElement)=>{const d=el.getContext('2d')!.getImageData(0,0,192,192).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]===255)n++;return n;});
  expect(await opaque()).toBe(192*192);
  const legend=panel.locator('.overview-gradient');
  await panel.getByRole('button',{name:'Soil Toxicity'}).click();await expect(legend).toBeVisible();
  expect(await legend.evaluate((el:HTMLCanvasElement)=>{const d=el.getContext('2d')!.getImageData(0,0,64,8).data;return d.every((v,i)=>i%4!==3||v===255);})).toBe(true);
  expect(await dataImages(page)).toBe(0);
});
