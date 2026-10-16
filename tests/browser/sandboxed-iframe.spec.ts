import { expect, test } from '@playwright/test';

for (const entry of ['/', '/xplayer.html']) test(`${entry} game actions work inside an iframe without form permission`, async ({ page }) => {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error('Browser test needs a base URL.');
  const blockedSubmissions: string[] = [], pageErrors: string[] = [];
  page.on('console', message => {
    if (message.text().includes('Blocked form submission')) blockedSubmissions.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.setContent(`<style>body{margin:0}iframe{width:100vw;height:100vh;border:0}</style><iframe sandbox="allow-scripts allow-same-origin" src="${new URL(entry, baseURL)}"></iframe>`);
  const game = page.frameLocator('iframe');
  await expect(game.locator('#map-status')).toContainText('Scenario 1');

  async function openNewGame() {
    await game.locator('#file-menu-button').click();
    await game.getByRole('menuitem', { name: 'New Game', exact: true }).click();
    await game.locator('#replace-game-yes').click();
    await expect(game.locator('#region-use')).toBeEnabled();
  }

  await openNewGame();
  await expect(game.locator('form, button:not([type="button"])')).toHaveCount(0);
  await game.locator('#new-farm-seed').fill('0');
  await game.locator('#region-use').click();
  await expect(game.locator('#geographic-chooser')).toBeVisible();
  await game.locator('#new-farm-seed').fill('9029');
  await game.locator('#new-farm-year').fill('70000');
  await game.locator('#region-design').click();
  await expect(game.locator('#geographic-chooser')).toBeVisible();
  await game.locator('#new-farm-year').fill('1993');
  if (entry === '/') await game.locator('#region-use').click();
  else await game.locator('#region-use').press('Enter');
  await expect(game.locator('#map-status')).toHaveText('Generated farm · original terrain');

  await game.locator('#window-bank').click();
  await expect(game.locator('form, button:not([type="button"])')).toHaveCount(0);
  await game.locator('#loan-amount').fill('1000');
  await game.locator('#loan-amount').press('Enter');
  await expect(game.locator('#loan-balance')).toHaveText('$1,000');

  await openNewGame();
  await game.locator('#new-farm-seed').fill('9029');
  await game.locator('#new-farm-seed').press('Enter');
  await expect(game.locator('#map-status')).toHaveText('Generated farm · original terrain');
  expect(blockedSubmissions).toEqual([]);
  expect(pageErrors).toEqual([]);
});
