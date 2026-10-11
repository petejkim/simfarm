import { expect, type Page } from '@playwright/test';

/** A player declining invitations (or acknowledging results) during a longer
 * browser scenario. Do not bypass the real modal or disable Messages. */
export async function declineTownEventDialogs(page: Page): Promise<void> {
  const dialog = page.locator('[data-window=town-event-message]');
  for (let i = 0; i < 2 && await dialog.isVisible(); i++) {
    const no = page.locator('#town-event-1');
    await (await no.isVisible() ? no : page.locator('#town-event-0')).click();
  }
  await expect(dialog).toHaveCount(0);
}
