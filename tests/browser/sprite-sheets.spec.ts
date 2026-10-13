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
