import { aircraftMapEntry } from '../../src/simulation/aircraft-view';
import { farmSnapshot, selectedFieldSlot } from './field-checkpoint';
import { expect, type Page } from '@playwright/test';

/** Existing subsystem tests acknowledge real informational dialogs before
 * continuing their next action. Dedicated message tests assert each notice. */
export async function acknowledgeFinanceMessages(page:Page){
  const ok=page.locator('#finance-message-ok,#disaster-message-ok,#field-message-ok,#building-message-ok');
  while(await ok.isVisible())await ok.click();
}

/** Existing subsystem flows use the real launchers before accessing a window.
 * Workspace/layout tests exercise discovery and window behavior directly. */
export async function openWindow(page: Page, key: string) {
  await acknowledgeFinanceMessages(page);
  // An open Speed menu (left by speedItem) overlays the launchers; close it like a user would.
  if(key!=='speed'&&await page.locator('#original-speed-menu').isVisible())await page.locator('#speed-menu-button').click();
  if(key==='schedule'){
    if(await page.locator('[data-window="schedule"]').isVisible()){await page.locator('[data-window="schedule"] .game-window-title').focus();return;}
    const snapshot=await farmSnapshot(page),selected=await selectedFieldSlot(page,snapshot);
    const field=snapshot.scenario.fields.find(f=>f.active&&f.slot===selected)??snapshot.scenario.fields.find(f=>f.active);
    if(!field)throw new Error('Schedule requires an existing field; create one with Plant first.');
    await viewField(page,field);return;
  }
  if (key === 'edit') { await focusEdit(page); return; }
  if (await page.locator(`[data-window="${key}"]`).isVisible()) {await page.locator(`[data-window="${key}"] .game-window-title`).focus();return;}
  if(key==='aircraft'){
    const snapshot=await farmSnapshot(page),world=snapshot.scenario;
    let parked:{x:number;y:number}|null=null;
    for(let x=0;x<96&&!parked;x++)for(let y=0;y<96;y++)if(aircraftMapEntry(world,x,y)?.slot){parked={x,y};break;}
    if(!parked)throw new Error('AIRPLANE requires a parked crop duster; buy one from the original catalog first.');
    await uncoverMap(page);
    const size=16*Number(await page.locator('#zoom').inputValue());
    await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-3)*p.size,Math.max(0,p.y-3)*p.size),{...parked,size});
    const bounds=(await page.locator('#world').boundingBox())!;
    await page.mouse.click(bounds.x+(parked.x+0.5)*size,bounds.y+(parked.y+0.5)*size);
    return;
  }
  if (key === 'options') { await page.locator('#options-menu-button').click(); await page.getByRole('menuitem', { name: 'Settings…', exact: true }).click(); return; }
  if (key === 'speed') { await openSpeedMenu(page); return; }
  if (['bank', 'sell', 'evaluation', 'balance'].includes(key)) { await page.locator(`#window-${key}`).click(); return; }
  if (key === 'expert') {
    await page.locator('#windows-menu-button').click();
    const item=page.getByRole('menuitemcheckbox', { name: 'Farm Expert', exact: true });
    const alreadyOpen=await item.getAttribute('aria-checked')==='true';await item.click();
    // A covered Expert is still open; its menu item closes it before reopening.
    if(alreadyOpen){await page.locator('#windows-menu-button').click();await item.click();}return;
  }

  if(['buy','map','weather','market'].includes(key)){await page.locator(`#window-${key}`).click();return;}
  throw new Error(`No original window entry for ${key}`);
}
/** Edit has no toolbar launcher or Windows-menu entry (user requests); focusing the permanent terrain selects it. */
export async function focusEdit(page:Page){
  if(await page.locator('#original-speed-menu').isVisible())await page.locator('#speed-menu-button').click();
  await page.locator('#viewport').focus();
}
/** Original field entry: View object, then click the field on the map; opens its Schedule window. */
async function viewField(page:Page,field:{x:number;y:number}){
  await uncoverMap(page);await page.getByRole('button',{name:'View object',exact:true}).click();
  const size=16*Number(await page.locator('#zoom').inputValue());
  await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-3)*p.size,Math.max(0,p.y-3)*p.size),{x:field.x,y:field.y,size});
  const bounds=(await page.locator('#world').boundingBox())!;
  await page.mouse.click(bounds.x+(field.x+0.5)*size,bounds.y+(field.y+0.5)*size);
}
/** Select a field by its slot through the map (the interim field chooser was removed). */
export async function chooseField(page:Page,slot:number){
  const field=(await farmSnapshot(page)).scenario.fields.find(f=>f.active&&f.slot===slot);
  if(!field)throw new Error(`No active field in slot ${slot}`);
  await viewField(page,field);await expectSelectedField(page,slot);
}
/** The Schedule window names the selected field ("Field N schedule"); null expects no selection. */
export async function expectSelectedField(page:Page,slot:number|null){
  const planner=page.locator('#field-planner');
  if(slot===null){if(await planner.count())await expect(planner).toHaveAttribute('aria-label','Field schedule');return;}
  const field=(await farmSnapshot(page)).scenario.fields.find(f=>f.active&&f.slot===slot);
  await expect(planner).toHaveAttribute('aria-label',`Field ${field?.number} schedule`);
}
async function uncoverMap(page:Page){
  await openWindow(page,'edit');
  // Edit is now a background, not a close-all command. Legacy subsystem flows
  // explicitly close their dialogs before selecting a map coordinate.
  for(let i=0;i<30;i++){
    const windows=page.locator('.game-window:visible').filter({has:page.locator('.game-window-title>button:enabled')});
    if(!await windows.count())break;
    const window=windows.last();await window.locator('.game-window-title').focus();await window.locator('.game-window-title>button').click();
  }
  await page.locator('#viewport').focus();
}
/** The Speed menu replaced the Speed window; its Pause/Resume and Next Day items exist only while it is open. */
export async function openSpeedMenu(page:Page){
  await acknowledgeFinanceMessages(page);
  if(!await page.locator('#original-speed-menu').isVisible())await page.locator('#speed-menu-button').click();
  await expect(page.locator('#original-speed-menu')).toBeVisible();
}
export async function reveal(page: Page, selector: string) {
  if (selector === '#world' || selector === '#viewport') { await uncoverMap(page); return; }
  if (selector === '#next-day' || selector === '#play-pause') { await openSpeedMenu(page); return; }
  const target = page.locator(selector).first();
  await target.waitFor({ state: "attached" });
  const key = await target.evaluate(el => el.closest<HTMLElement>('[data-window]')?.dataset.window);
  if (key) await openWindow(page, key);
  else if (await target.evaluate(el => Boolean(el.closest('.map-panel')))) await openWindow(page, 'edit');
  // A subsystem panel may still have an internal disclosure while its original
  // dialog contents are being reconstructed. Open it through its actual summary.
  const closed = await target.evaluate(el => {
    const details = el.closest('details');
    return details && !details.open && !el.closest('summary') ? details.id : null;
  });
  if (closed) await page.locator(`#${closed} > summary`).click();
}

/** Original File entry; native seed/year remain inside the source region chooser. */
export async function newGame(page:Page){
  await acknowledgeFinanceMessages(page);await page.locator('#file-menu-button').click();
  await page.getByRole('menuitem',{name:'New Game',exact:true}).click(); await page.locator('#replace-game-yes').click();
}

/** The depressed Edit palette button names the running map action (View object when idle). */
export async function expectPaletteAction(page:Page,name:string){
  await expect(page.getByRole('toolbar',{name:'Edit tools'}).getByRole('button',{pressed:true})).toHaveAccessibleName(name);
}
/** The control strip's Funds readout equals the expected simulation cash. */
export async function expectFarmCash(page:Page,cash:number){
  await expect(page.locator('#farm-cash')).toHaveText(`$${cash.toLocaleString('en-US')}`);
}
/** A Speed menu item (#play-pause or #next-day), opening the menu first. */
export async function speedItem(page:Page,selector:'#play-pause'|'#next-day'){
  await openSpeedMenu(page);return page.locator(selector);
}
