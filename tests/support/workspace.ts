import type { Page } from '@playwright/test';

/** Existing subsystem tests acknowledge real informational dialogs before
 * continuing their next action. Dedicated message tests assert each notice. */
export async function acknowledgeFinanceMessages(page:Page){
  while(await page.locator('#finance-message-ok').isVisible())await page.locator('#finance-message-ok').click();
}

/** Existing subsystem flows use the real launchers before accessing a window.
 * Workspace/layout tests exercise discovery and window behavior directly. */
export async function openWindow(page: Page, key: string) {
  await acknowledgeFinanceMessages(page);
  if (key === 'schedule') { if (!await page.locator('[data-window="schedule"]').isVisible()) {await openWindow(page,'navigation');await page.getByRole('button',{name:'Crop planner',exact:true}).click();} return; }
  if (key === 'taxes') { await openWindow(page,'balance'); await page.getByRole('button',{name:'View tax details',exact:true}).click(); return; }
  if (key === 'edit') { await page.locator('#window-edit').click(); return; }
  if (await page.locator(`[data-window="${key}"]`).isVisible()) return;
  if (key === 'options') { await openWindow(page, 'tools'); await page.getByRole('button', { name: 'Audio and tools', exact: true }).click(); return; }
  if (['speed', 'disasters'].includes(key)) { await page.locator(`#${key}-menu-button`).click(); return; }
  if (['bank', 'sell', 'evaluation', 'balance'].includes(key)) { await page.locator(`#window-${key}`).click(); return; }
  if (key === 'expert') {
    await page.locator('#windows-menu-button').click(); await page.getByRole('menuitem', { name: 'Farm Expert', exact: true }).click(); return;
  }
  if (key === 'session' || key === 'about-project') {
    await openWindow(page, 'options'); await page.getByRole('button', { name: key === 'session' ? 'Game files' : 'Preservation progress', exact: true }).click(); return;
  }
  await page.getByRole('button', { name: 'Edit tools and help', exact: true }).click();
  if (key === 'actions') {
    const tool = await page.locator('#map-tool').inputValue(); await page.locator('#map-tool').selectOption(tool);
  } else if (key !== 'tools') await page.getByRole('button', { name: key === 'navigation' ? 'Farm controls' : key === 'machinery' ? 'Machinery' : key === 'livestock' ? 'Livestock' : 'Aircraft', exact: true }).click();
}
export async function reveal(page: Page, selector: string) {
  if (selector === '#world' || selector === '#viewport') { await openWindow(page, 'edit'); return; }
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
