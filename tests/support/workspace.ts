import { farmSnapshot } from './field-checkpoint';
import type { Page } from '@playwright/test';

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
  if(key==='schedule'){
    if(await page.locator('[data-window="schedule"]').isVisible()){await page.locator('[data-window="schedule"] .game-window-title').focus();return;}
    const selected=Number(await page.locator('#planner-field').inputValue()),snapshot=await farmSnapshot(page);
    const field=snapshot.scenario.fields.find(f=>f.active&&f.slot===selected)??snapshot.scenario.fields.find(f=>f.active);
    if(!field)throw new Error('Schedule requires an existing field; create one with Plant first.');
    await uncoverMap(page);await page.getByRole('button',{name:'View object',exact:true}).click();
    const size=16*Number(await page.locator('#zoom').inputValue());
    await page.locator('#viewport').evaluate((v,p)=>v.scrollTo(Math.max(0,p.x-3)*p.size,Math.max(0,p.y-3)*p.size),{x:field.x,y:field.y,size});
    const bounds=(await page.locator('#world').boundingBox())!;
    await page.mouse.click(bounds.x+(field.x+0.5)*size,bounds.y+(field.y+0.5)*size);return;
  }
  if (key === 'edit') { await page.locator('#window-edit').click(); return; }
  if (await page.locator(`[data-window="${key}"]`).isVisible()) {await page.locator(`[data-window="${key}"] .game-window-title`).focus();return;}
  if (key === 'options') { await openWindow(page, 'tools'); await page.getByRole('button', { name: 'Audio and tools', exact: true }).click(); return; }
  if (key === 'speed') { await page.locator(`#${key}-menu-button`).click(); return; }
  if (['bank', 'sell', 'evaluation', 'balance'].includes(key)) { await page.locator(`#window-${key}`).click(); return; }
  if (key === 'expert') {
    await page.locator('#windows-menu-button').click();
    const item=page.getByRole('menuitemcheckbox', { name: 'Farm Expert', exact: true });
    const alreadyOpen=await item.getAttribute('aria-checked')==='true';await item.click();
    // A covered Expert is still open; its menu item closes it before reopening.
    if(alreadyOpen){await page.locator('#windows-menu-button').click();await item.click();}return;
  }
  if (key === 'session' || key === 'about-project') {
    await openWindow(page, 'options'); await page.getByRole('button', { name: key === 'session' ? 'Game files' : 'Preservation progress', exact: true }).click(); return;
  }
  await page.getByRole('button', { name: 'Edit tools and help', exact: true }).click();
  if(!await page.locator('[data-window=tools]').isVisible())await page.getByRole('button', { name: 'Advanced controls', exact: true }).click();
  await page.locator('[data-window=tools] .game-window-title').focus();
  if (key !== 'tools') await page.locator('[data-window=tools]').getByRole('button', { name: 'Aircraft', exact: true }).click();
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
export async function reveal(page: Page, selector: string) {
  if (selector === '#world' || selector === '#viewport') { await uncoverMap(page); return; }
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
